import { test, expect, Page } from "@playwright/test";
import { DateTime } from "luxon";

async function login(page: Page, path = "/wiki") {
  await page.goto(path);
  await page.getByLabel("Passwort", { exact: true }).fill("WikiBuildOnly2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.locator(".wiki-navigation")).toBeVisible();
}

test("resource timelines use the authenticated backend and save appointments in a popup", async ({
  page,
}) => {
  await login(page);
  const response = await page.request.get(
    "/api/resource-occupancy/?start=2026-10-05&end=2026-10-11",
  );
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.rows.length).toBeGreaterThan(0);
  expect(data.teachers.length).toBeGreaterThan(0);
  expect(data.rows.every((row: any) => row.learner_ids === undefined)).toBe(
    true,
  );
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Arbeitsbereiche" })
    .getByRole("button", { name: "Lehrendenübersicht", exact: true })
    .click();
  const overview = page.getByRole("region", {
    name: "Lehrendenübersicht",
    exact: true,
  });
  await expect(overview.locator(".resource-day-header")).toHaveCount(7);
  await overview
    .getByRole("button", { name: "Datum auswählen", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Kalender", exact: true })
    .getByRole("button", { name: "Freitag, 09. Oktober 2026", exact: true })
    .click();
  const event = overview.locator(".resource-event").first();
  await event.click();
  const details = page.getByRole("dialog", {
    name: "Termindetails",
    exact: true,
  });
  await expect(details).toBeVisible();
  await details
    .getByRole("button", { name: "Termin bearbeiten", exact: true })
    .click();
  const form = page.getByRole("dialog", {
    name: "Termin bearbeiten",
    exact: true,
  });
  await expect(form).toBeVisible();
  const fixed = form.getByLabel("Termin fixieren");
  const previous = await fixed.isChecked();
  await fixed.setChecked(!previous);
  await form.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(event).toBeVisible();
  await event.click();
  await details
    .getByRole("button", { name: "Termin bearbeiten", exact: true })
    .click();
  await expect(fixed).toBeChecked({ checked: !previous });
  await fixed.setChecked(previous);
  await form.getByRole("button", { name: "Speichern", exact: true }).click();
  const context = await page.request.get(
    "/api/campusai/context/?page=teachers",
  );
  expect(context.status()).toBe(200);
  expect((await context.json()).view.label).toBe("Lehrendenübersicht");
});

test("teacher block times cancel real appointments without deleting them", async ({
  page,
}) => {
  await login(page);
  const data = await (
    await page.request.get(
      "/api/resource-occupancy/?start=2026-10-09&end=2026-10-09",
    )
  ).json();
  const session = data.rows.find(
    (row: any) =>
      row.teacher_ids.length && row.kind === "teaching" && !row.cancelled,
  );
  const teacher = data.teachers.find(
    (person: any) => person.id === session.teacher_ids[0],
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Lehrendenübersicht", exact: true })
    .click();
  const overview = page.getByRole("region", {
    name: "Lehrendenübersicht",
    exact: true,
  });
  await overview
    .getByLabel("Lehrende suchen", { exact: true })
    .fill(teacher.name);
  const row = overview
    .locator(".resource-timeline-row")
    .filter({ hasText: teacher.name });
  await row.getByRole("button", { name: /Blockzeit hinzufügen/ }).click();
  const popup = page.getByRole("dialog", {
    name: "Blockzeit hinzufügen",
    exact: true,
  });
  await popup
    .getByLabel("Beginn", { exact: true })
    .fill(
      DateTime.fromISO(session.start)
        .setZone("Europe/Berlin")
        .toFormat("yyyy-MM-dd'T'HH:mm"),
    );
  await popup
    .getByLabel("Ende", { exact: true })
    .fill(
      DateTime.fromISO(session.end)
        .setZone("Europe/Berlin")
        .toFormat("yyyy-MM-dd'T'HH:mm"),
    );
  await expect(popup).toContainText("aktive Termine betroffen.");
  await popup.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(popup).toHaveCount(0);
  await expect(row.locator(".resource-event.cancelled")).not.toHaveCount(0);
  const saved = await (
    await page.request.get(`/api/sessions/${session.id}/`)
  ).json();
  expect(saved.cancelled).toBe(true);
  expect(Date.parse(saved.start)).toBe(Date.parse(session.start));
});

test("deep links require login, preserve destination, and show protected images", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "/wiki/setup");
  await expect(page.locator(".wiki-article")).toBeVisible();
  await expect(page).toHaveURL(/\/wiki\/setup$/);
  const images = page.locator(".wiki-article img");
  await expect(images).toHaveCount(12);
  await images.first().scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      images.first().evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: /Bild vergrößern/ })
    .first()
    .click();
  await expect(page.getByRole("dialog", { name: "Bildansicht" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("full text search, missing results, navigation, history and anchors", async ({
  page,
}) => {
  await login(page);
  const search = page.getByRole("textbox", { name: "Wiki durchsuchen" });
  await search.fill("Nachschreib");
  await expect(page.locator(".wiki-results")).toContainText("Prüfung");
  await search.fill("gibtkeinenartikelxyz");
  await expect(
    page.getByText("Keine passende Anleitung gefunden.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Suche leeren" }).click();
  await page.locator('.wiki-navigation a[href="/wiki/rooms"]').click();
  await expect(page.locator(".wiki-article")).toBeVisible();
  await page.locator('.wiki-navigation a[href="/wiki/teachers"]').click();
  await expect(page.locator(".wiki-article")).toContainText("Verfügbarkeit");
  await page.goBack();
  await expect(page).toHaveURL(/\/wiki\/rooms$/);
  await expect(page.locator(".wiki-article")).toContainText("Kapazität");
  const toc = page.locator(".wiki-toc a").first();
  const href = await toc.getAttribute("href");
  await toc.click();
  await expect(page).toHaveURL(new RegExp(href! + "$"));
  await page.reload();
  await expect(page.locator(".wiki-article")).toBeVisible();
  await page.goto("/wiki/unknown");
  await expect(
    page.getByRole("heading", { name: "Artikel nicht gefunden" }),
  ).toBeVisible();
});

test("Wiki opens in another tab and clears content on application logout", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByLabel("Passwort", { exact: true }).fill("WikiBuildOnly2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  const tabEvent = context.waitForEvent("page");
  await page.getByRole("link", { name: "Wiki & Hilfe", exact: true }).click();
  const wiki = await tabEvent;
  await expect(wiki.locator(".wiki-navigation")).toBeVisible();
  await wiki.goto("/wiki/setup");
  await expect(wiki.locator(".wiki-article")).toBeVisible();
  await page.getByRole("button", { name: "Abmelden", exact: true }).click();
  await expect(
    wiki.getByRole("heading", { name: "Anmelden", exact: true }),
  ).toBeVisible();
  await expect(wiki.locator(".wiki-article")).toHaveCount(0);
  const denied = await context.request.get("/api/wiki/assets/start-01.png");
  expect(denied.status()).toBe(403);
});

test("responsive layouts, mobile focus trap and keyboard search", async ({
  page,
}) => {
  await login(page, "/wiki/rooms");
  for (const width of [390, 768, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator(".wiki-article")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  }
  // Equivalent CSS viewport to a 1440px screen at 200% browser zoom.
  await page.setViewportSize({ width: 720, height: 500 });
  await page.locator(".wiki-inline-toc summary").click();
  await expect(
    page.getByRole("navigation", { name: "Artikelabschnitte" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Themen öffnen" }).click();
  const close = page
    .locator(".wiki-navigation")
    .getByRole("button", { name: "Themen schließen" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect
    .poll(() =>
      page
        .locator(".wiki-navigation")
        .evaluate((el) => el.contains(document.activeElement)),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Themen öffnen" }),
  ).toBeFocused();
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("textbox", { name: "Wiki durchsuchen" }),
  ).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
});

test("Freddy links to the same protected guide in a new tab", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Passwort", { exact: true }).fill("WikiBuildOnly2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  // Wait for the initial plan selection before typing into its chat draft.
  await expect(
    page.getByRole("button", { name: "Termin", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Freddy öffnen", exact: true })
    .click();
  await page
    .getByLabel("Deine Frage an Freddy")
    .fill("Wie lege ich einen Jahrgang an?");
  await page.getByRole("button", { name: "Frage senden", exact: true }).click();
  await page.getByText("Verwendete Anleitung", { exact: true }).last().click();
  const guide = page
    .getByRole("link", { name: "Anleitung lesen", exact: true })
    .first();
  await expect(guide).toHaveAttribute("href", /^\/wiki\/[a-z0-9-]+$/);
  await expect(guide).toHaveAttribute("target", "_blank");
});

test("article renderer ignores executable HTML and external images", async ({
  page,
}) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("example.invalid"))
      externalRequests.push(request.url());
  });
  await page.route("**/api/wiki/articles/rooms/", (route) =>
    route.fulfill({
      json: {
        id: "rooms",
        markdown:
          "## Sicherheit\n\n<script>window.wikiUnsafe=true</script>\n\n![Extern](https://example.invalid/tracking.png)\n\n[Link](javascript:alert(1))\n\nNormaler Text.",
      },
    }),
  );
  await login(page, "/wiki/rooms");
  await expect(page.locator(".wiki-article")).toContainText("Normaler Text.");
  await expect(
    page.locator(".wiki-article script, .wiki-article img"),
  ).toHaveCount(0);
  expect(await page.evaluate(() => "wikiUnsafe" in window)).toBe(false);
  expect(
    await page.locator(".wiki-article a").getAttribute("href"),
  ).not.toContain("javascript:");
  expect(externalRequests).toEqual([]);
});
