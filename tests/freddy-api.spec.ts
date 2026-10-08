import { test, expect, type Page } from "@playwright/test";
import example from "../src/demo-data.json" with { type: "json" };

async function freddyAPI(page: Page, hold = false) {
  await page.clock.install({ time: new Date("2026-10-07T08:00:00+02:00") });
  const fixture = structuredClone(example);
  const requests: any[] = [];
  const contexts: URLSearchParams[] = [];
  const releases: (() => void)[] = [];
  const row = {
    id: 1,
    plan_id: fixture.data.plans[0].id,
    course: 1,
    exam: null,
    name: "Mathematik I",
    start: "2026-10-05T08:30:00+02:00",
    end: "2026-10-05T10:00:00+02:00",
    color: "blue",
    room_ids: [1],
    room_names: ["Hörsaal H.101"],
    teacher_ids: [],
    teacher_names: [],
    group_names: [],
    locked: false,
  };
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\//, "");
    let body: unknown;
    if (path === "auth/me/")
      body = {
        authenticated: true,
        role: "admin",
        user: "Testverwaltung",
        institution: fixture.institution,
      };
    else if (path === "bootstrap/")
      body = {
        schema: fixture.schema,
        counts: { people: 1, rooms: 1 },
        audit: [],
      };
    else if (/^plans\/\d+\/check\/$/.test(path))
      body = { rows: [row], conflicts: [], publication: null };
    else if (path === "campusai/status/")
      body = { ready: true, model: "fixture-local", reason: "Verbunden" };
    else if (path === "campusai/context/") {
      contexts.push(url.searchParams);
      body = {
        revision: 1,
        facts: { plan: fixture.data.plans[0] },
        semesters: [],
        notices: [],
        notice_count: 0,
        action_requirements: {},
        view: {
          label:
            url.searchParams.get("page") === "map" ? "Räume" : "Stundenplanung",
        },
        proactive: { notices: [], actions: [] },
        calendar: {
          week: url.searchParams.get("week"),
          selected_session: url.searchParams.get("session_id")
            ? { id: 1, name: "Mathematik I", start: row.start, end: row.end }
            : null,
        },
      };
    } else if (path === "campusai/chat/") {
      const payload = route.request().postDataJSON();
      requests.push(payload);
      if (hold) await new Promise<void>((resolve) => releases.push(resolve));
      body = {
        answer: `Antwort auf ${payload.question}`,
        mode: "local",
        revision: 1,
        model: "fixture-local",
        sources: [],
        actions: [],
        auto_action: null,
        changed: false,
      };
    } else {
      const [resource, id] = path.split("/");
      const entries = (fixture.data as Record<string, any[]>)[resource] || [];
      body = id
        ? entries.find((entry) => entry.id === Number(id)) || {}
        : { results: entries, count: entries.length, next: null };
    }
    await route.fulfill({ json: body }).catch(() => {
      /* Request may have been aborted by the real HTTP client. */
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Freddy öffnen", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Wie lege ich einen neuen Jahrgang an?",
      exact: true,
    }),
  ).toBeEnabled();
  return { requests, contexts, release: () => releases.shift()?.() };
}

test("Freddy API: Abbrechen behält die Frage und verwirft eine verspätete Antwort", async ({
  page,
}) => {
  const api = await freddyAPI(page, true);
  await page
    .getByLabel("Deine Frage an Freddy")
    .fill("Eine langsame Planungsfrage");
  await page.getByRole("button", { name: "Frage senden", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Antwort abbrechen", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Antwort abbrechen", exact: true })
    .click();
  await expect(page.getByLabel("Deine Frage an Freddy")).toHaveValue(
    "Eine langsame Planungsfrage",
  );
  await expect(
    page.getByRole("button", { name: "Frage senden", exact: true }),
  ).toBeEnabled();
  api.release();
  await expect(page.locator(".campus-ai-message.assistant")).toHaveCount(0);
  await page.getByLabel("Deine Frage an Freddy").fill("Eine neue Frage");
  await page.getByRole("button", { name: "Frage senden", exact: true }).click();
  await expect.poll(() => api.requests.length).toBe(2);
  api.release();
  await expect(page.locator(".campus-ai-message.assistant")).toContainText(
    "Eine neue Frage",
  );
  await expect(page.locator(".campus-ai-message.assistant")).not.toContainText(
    "langsame Planungsfrage",
  );
});

test("Freddy API: Ansichtwechsel bricht ab und Kalenderkontext enthält Termin und Filter", async ({
  page,
}) => {
  const api = await freddyAPI(page, true);
  await page.locator(".calendar-event").first().click();
  await page
    .getByRole("combobox", { name: "Raum filtern", exact: true })
    .selectOption({ label: "Hörsaal H.101" });
  await expect.poll(() => api.contexts.at(-1)?.get("session_id")).toBe("1");
  await expect
    .poll(() => api.contexts.at(-1)?.get("room_filter"))
    .toBe("Hörsaal H.101");
  await page
    .getByLabel("Deine Frage an Freddy")
    .fill("Warum passt dieser Termin nicht?");
  await page.getByRole("button", { name: "Frage senden", exact: true }).click();
  await expect.poll(() => api.requests.length).toBe(1);
  expect(api.requests[0].session_id).toBe(1);
  expect(api.requests[0].week).toBe("2026-10-05");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Räume", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Antwort abbrechen", exact: true }),
  ).toHaveCount(0);
  api.release();
  await expect(page.getByLabel("Deine Frage an Freddy")).toHaveValue(
    "Warum passt dieser Termin nicht?",
  );
  await expect(page.locator(".campus-ai-message.assistant")).toHaveCount(0);
});

test("Freddy API: Zeitlimit gibt die Eingabe frei ohne spätere Antwort einzufügen", async ({
  page,
}) => {
  const api = await freddyAPI(page, true);
  await page
    .getByLabel("Deine Frage an Freddy")
    .fill("Diese Frage dauert zu lange");
  await page.getByRole("button", { name: "Frage senden", exact: true }).click();
  await expect.poll(() => api.requests.length).toBe(1);
  await page.clock.runFor(46000);
  await expect(
    page.getByRole("button", { name: "Antwort abbrechen", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Deine Frage an Freddy")).toHaveValue(
    "Diese Frage dauert zu lange",
  );
  await expect(
    page.getByRole("button", { name: "Frage senden", exact: true }),
  ).toBeEnabled();
  api.release();
  await expect(page.locator(".campus-ai-message.assistant")).toHaveCount(0);
});

test("Freddy API: Verlauf enthält vollständige frühere Fragen innerhalb des Budgets", async ({
  page,
}) => {
  const api = await freddyAPI(page);
  const first =
    "Frage mit wichtigen Details: " +
    "a".repeat(1050) +
    " Abschließende Bedingung";
  const questions = [
    first,
    ...Array.from({ length: 7 }, (_, index) => `Folgefrage ${index}`),
  ];
  for (const [index, question] of questions.entries()) {
    await page.getByLabel("Deine Frage an Freddy").fill(question);
    await page
      .getByRole("button", { name: "Frage senden", exact: true })
      .click();
    await expect(page.locator(".campus-ai-message.assistant")).toHaveCount(
      index + 1,
    );
    if (index === 0) {
      const answer = page.locator(".campus-ai-message.assistant").first();
      await expect(answer).not.toContainText("Abschließende Bedingung");
      await answer
        .getByRole("button", {
          name: "Vollständige Antwort lesen",
          exact: true,
        })
        .click();
      await expect(answer).toContainText("Abschließende Bedingung");
    }
  }
  expect(api.requests[1].history[0].content).toBe(first);
  expect(api.requests.at(-1).history).toHaveLength(12);
  expect(
    api.requests
      .at(-1)
      .history.reduce(
        (size: number, item: any) => size + item.content.length,
        0,
      ),
  ).toBeLessThanOrEqual(12000);
});
