import { test, expect, type Page } from "@playwright/test";
import example from "../src/demo-data.json" with { type: "json" };

// Exercise the production HTTP client against deterministic API fixtures.
// No running backend or real institution data is needed for these editor flows.
async function planningAPI(page: Page, delaySave = false) {
  await page.clock.install({ time: new Date("2026-10-07T08:00:00Z") });
  const fixture = structuredClone(example);
  let authenticated = true;
  let logouts = 0;
  let releaseSave: (() => void) | undefined;
  const session = () => ({
    authenticated,
    role: "admin",
    user: "Testverwaltung",
    institution: fixture.institution,
  });
  const day = "2026-10-05";
  const row = {
    id: 1,
    plan_id: fixture.data.plans[0].id,
    course: 1,
    exam: null,
    name: "Mathematik I",
    start: `${day}T08:30:00+02:00`,
    end: `${day}T10:00:00+02:00`,
    color: "blue",
    room_ids: [1],
    room_names: ["Hörsaal H.101"],
    teacher_ids: [],
    teacher_names: [],
    group_names: [],
    locked: false,
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(
      /^\/api\//,
      "",
    );
    let body: unknown;
    if (path === "auth/me/") body = session();
    else if (path === "auth/logout/") {
      logouts++;
      authenticated = false;
      body = {};
    } else if (path === "auth/login/") {
      authenticated = true;
      body = session();
    } else if (path === "bootstrap/")
      body = {
        schema: fixture.schema,
        counts: { people: 1, rooms: 1 },
        audit: [],
      };
    else if (/^plans\/\d+\/check\/$/.test(path))
      body = { rows: [row], conflicts: [], publication: null };
    else if (path === "sessions/1/" && route.request().method() === "PATCH") {
      if (delaySave)
        await new Promise<void>((resolve) => {
          releaseSave = resolve;
        });
      Object.assign(row, route.request().postDataJSON());
      body = row;
    } else {
      const [resource, id] = path.split("/");
      const entries = (fixture.data as Record<string, any[]>)[resource] || [];
      body = id
        ? entries.find((entry) => entry.id === Number(id)) || {}
        : { results: entries, count: entries.length, next: null };
    }
    await route.fulfill({ json: body });
  });
  return { logouts: () => logouts, release: () => releaseSave?.() };
}

test("Popup API: Abbrechen schützt Eingaben; danach ist Abmelden möglich", async ({
  page,
}) => {
  const api = await planningAPI(page);
  await page.goto("/");
  await page.locator(".calendar-event").first().click();
  const editor = page.getByRole("dialog", {
    name: "Termin bearbeiten",
    exact: true,
  });
  await editor.getByLabel("Name", { exact: true }).fill("Ungespeichert");
  page.once("dialog", (dialog) => dialog.dismiss());
  await editor.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(editor.getByLabel("Name", { exact: true })).toHaveValue(
    "Ungespeichert",
  );
  expect(api.logouts()).toBe(0);
  page.once("dialog", (dialog) => dialog.accept());
  await editor.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.getByRole("button", { name: "Abmelden", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Anmelden", exact: true }),
  ).toBeVisible();
  expect(api.logouts()).toBe(1);
  await page.getByLabel("Passwort", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.locator(".calendar-event")).toHaveCount(1);
  await expect(editor).toHaveCount(0);
});

test("Popup API: Laufender Speichervorgang ist gegen Schließen geschützt", async ({
  page,
}) => {
  const api = await planningAPI(page, true);
  await page.goto("/");
  await page.locator(".calendar-event").first().click();
  const editor = page.getByRole("dialog", {
    name: "Termin bearbeiten",
    exact: true,
  });
  await editor.getByLabel("Name", { exact: true }).fill("Gespeicherter Termin");
  const request = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/sessions/1/") &&
      request.method() === "PATCH",
  );
  await editor.getByRole("button", { name: "Speichern", exact: true }).click();
  await request;
  await expect(
    editor.getByRole("button", { name: "Abbrechen", exact: true }),
  ).toBeDisabled();
  await expect(editor.getByLabel("Name", { exact: true })).toBeDisabled();
  await expect(
    editor.getByRole("button", { name: "Schließen", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.mouse.click(4, 4);
  expect(api.logouts()).toBe(0);
  await expect(editor).toBeVisible();
  api.release();
  await expect(editor).toHaveCount(0);
  await expect(page.locator(".calendar-event")).toContainText(
    "Gespeicherter Termin",
  );
});
