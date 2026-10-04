import { test, expect } from "@playwright/test";
import { progressionFlow } from "./progression-flow";
import { overviewFlow } from "./overview-flow";
import { studyFlow } from "./study-flow";
import { assessmentFlow } from "./assessment-flow";
import { campusAIFlow } from "./campus-ai-flow";
test.use({ actionTimeout: 10000 });

test("campusAI erreicht das echte lokale Sprachmodell", async ({ page }) => {
  test.skip(
    process.env.CAMPUS_AI_LIVE_TEST !== "1",
    "Optionaler Test des installierten lokalen Modells",
  );
  test.setTimeout(150000);
  await page.goto("/");
  await page.getByLabel("Passwort", { exact: true }).fill("Campuszeit2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page
    .getByRole("button", { name: "Freddy öffnen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Chat-Optionen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Lokale KI nutzen" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Chat-Optionen", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Wie lege ich einen neuen Jahrgang an?",
      exact: true,
    }),
  ).toBeEnabled();
  const before = await (
    await page.request.get("/api/campusai/context/")
  ).json();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/campusai/chat/") &&
      response.request().method() === "POST",
    { timeout: 120000 },
  );
  await page
    .getByRole("button", {
      name: "Wie lege ich einen neuen Jahrgang an?",
      exact: true,
    })
    .click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const reply = await response.json();
  expect(reply.mode).toBe("local");
  expect(reply.changed).toBe(false);
  expect(reply.service_note).toBeUndefined();
  expect(reply.answer).toMatch(/Schritt 5|Jahrgänge/);
  await expect(page.locator(".campus-ai-message.assistant")).toContainText(
    "lokale KI",
  );
  expect(
    await (await page.request.get("/api/campusai/context/")).json(),
  ).toEqual(before);
  console.log("Lokale Modellantwort:", reply.answer);
  await page.screenshot({
    path: "test-results/campus-ai-local-model.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("campusAI beantwortet Fragen ohne Datenänderungen", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.getByLabel("Passwort", { exact: true }).fill("Campuszeit2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Freddy öffnen", exact: true }),
  ).toBeVisible();
  const before = await (
    await page.request.get("/api/campusai/context/")
  ).json();
  await campusAIFlow(page);
  const after = await (await page.request.get("/api/campusai/context/")).json();
  expect(after).toEqual(before);
});

test("Prüfungsanforderungen werden zu Prüfungsvorlagen und gespeicherten Abgabefristen", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.getByLabel("Passwort", { exact: true }).fill("Campuszeit2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(
    page.getByRole("navigation").getByRole("button", {
      name: "Einrichtung & Studienstruktur",
      exact: true,
    }),
  ).toBeVisible();
  await studyFlow(page);
  await assessmentFlow(page);
});

test("Separate Studierendenübersicht zeigt freigegebene Termine mit Kursfiltern", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.getByLabel("Passwort", { exact: true }).fill("Campuszeit2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  const { sharedUrl } = await overviewFlow(page);
  const anonymous = await page.context().browser()!.newContext();
  try {
    const visitor = await anonymous.newPage();
    await visitor.goto(sharedUrl);
    await expect(
      visitor.getByRole("heading", {
        name: "Stundenplanübersicht",
        exact: true,
      }),
    ).toBeVisible();
    await expect(visitor.locator(".student-grid")).toContainText(
      "Mathematik I",
    );
    await expect(visitor.getByLabel("Passwort", { exact: true })).toHaveCount(
      0,
    );
  } finally {
    await anonymous.close();
  }
});

test("Jahrgangsverlauf wird geprüft, balanciert und separat gespeichert", async ({
  page,
}) => {
  test.setTimeout(60000);
  const code = `BAL-E2E-${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Passwort", { exact: true }).fill("Campuszeit2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  try {
    await progressionFlow(page, code);
  } finally {
    const csrf =
      (await page.context().cookies()).find(
        (cookie) => cookie.name === "csrftoken",
      )?.value || "";
    const response = await page.request.get(`/api/cohorts/?search=${code}`);
    for (const record of (await response.json()).results || [])
      if (record.code === code)
        await page.request.delete(`/api/cohorts/${record.id}/`, {
          headers: { "X-CSRFToken": csrf },
        });
  }
});
test("Studienverwaltung pflegt Lehrende mit mehreren Zeitfenstern", async ({
  page,
}) => {
  const code = `TEACH-E2E-${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Passwort", { exact: true }).fill("Campuszeit2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Einrichtung & Studienstruktur", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Schritt 4: Studienstruktur", exact: true })
    .click();
  await expect(page.locator(".study-facts")).toContainText("180.0 / 180.0 CP");
  await expect(page.locator(".study-unit")).toHaveCount(36);
  await page
    .getByRole("button", { name: "Schritt 2: Lehrende", exact: true })
    .click();
  try {
    await page
      .getByRole("button", { name: "Lehrende hinzufügen", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^Kennung/).fill(code);
    await dialog.getByLabel(/^Name/).fill(code);
    while (
      (await dialog.locator(".availability-window:not(.exclusions)").count()) >
      1
    )
      await dialog
        .getByRole("button", { name: "Zeitfenster 2 entfernen", exact: true })
        .click();
    await dialog
      .getByLabel("Zeitfenster 1: Wochentag", { exact: true })
      .selectOption("0");
    await dialog
      .getByLabel("Zeitfenster 1: Beginn", { exact: true })
      .fill("09:00");
    await dialog
      .getByLabel("Zeitfenster 1: Ende", { exact: true })
      .fill("11:00");
    await dialog
      .getByRole("button", { name: "Zeitfenster hinzufügen", exact: true })
      .click();
    await dialog
      .getByLabel("Zeitfenster 2: Wochentag", { exact: true })
      .selectOption("3");
    await dialog
      .getByLabel("Zeitfenster 2: Beginn", { exact: true })
      .fill("14:00");
    await dialog
      .getByLabel("Zeitfenster 2: Ende", { exact: true })
      .fill("17:00");
    await dialog
      .getByRole("button", { name: "Sperrzeit hinzufügen", exact: true })
      .click();
    await dialog
      .getByLabel("Sperrzeit 1: Beginn", { exact: true })
      .fill("2026-11-05T14:00");
    await dialog
      .getByLabel("Sperrzeit 1: Ende", { exact: true })
      .fill("2026-11-05T15:00");
    await dialog
      .getByRole("button", { name: "Speichern", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: new RegExp(code) }).click();
    await expect(
      dialog.getByLabel("Zeitfenster 2: Wochentag", { exact: true }),
    ).toHaveValue("3");
    await expect(
      dialog.getByLabel("Zeitfenster 2: Ende", { exact: true }),
    ).toHaveValue("17:00");
    await expect(
      dialog.getByLabel("Sperrzeit 1: Beginn", { exact: true }),
    ).toHaveValue("2026-11-05T14:00");
    await expect(dialog.locator("textarea")).toHaveCount(0);
    await page.screenshot({
      path: "test-results/study-availability.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await dialog
      .getByRole("button", { name: "Abbrechen", exact: true })
      .click();
  } finally {
    const csrf =
      (await page.context().cookies()).find(
        (cookie) => cookie.name === "csrftoken",
      )?.value || "";
    const response = await page.request.get(`/api/people/?search=${code}`);
    for (const record of (await response.json()).results || [])
      if (record.code === code)
        await page.request.delete(`/api/people/${record.id}/`, {
          headers: { "X-CSRFToken": csrf },
        });
  }
});
test("Raumverwaltung: Bereich, Stockwerk und Raum pflegen", async ({
  page,
}) => {
  const code = `ROOM-E2E-${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Passwort", { exact: true }).fill("Campuszeit2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Räume", exact: true })
    .click();
  try {
    await page
      .getByRole("button", { name: "Bereich hinzufügen", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByText("Längengrad")).toHaveCount(
      0,
    );
    await page.getByRole("dialog").getByLabel("Kennung").fill(code);
    await page.getByRole("dialog").getByLabel(/^Name/).fill(code);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.getByRole("button", { name: code, exact: true }).click();
    await page
      .getByRole("button", { name: "Stockwerk hinzufügen", exact: true })
      .click();
    await page.getByRole("dialog").getByLabel("Kennung").fill(code);
    await page.getByRole("dialog").getByLabel(/^Name/).fill("Teststockwerk");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page
      .getByRole("button", { name: "Teststockwerk", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Raum hinzufügen", exact: true })
      .click();
    await page.getByRole("dialog").getByLabel("Kennung").fill(code);
    await page.getByRole("dialog").getByLabel(/^Name/).fill("Testräumchen 101");
    await page.getByRole("dialog").getByLabel("Kapazität").fill("36");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page
      .getByRole("button", { name: "Testräumchen 101", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Testräumchen 101", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Raum bearbeiten", exact: true })
      .click();
    await page.getByRole("dialog").getByLabel("Kapazität").fill("40");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(page.locator(".room-tile-capacity")).toHaveText("40 Plätze");
    await page.getByLabel("Raum suchen", { exact: true }).fill("Kein Treffer");
    await expect(page.locator(".room-tile")).toHaveCount(0);
    await page.getByLabel("Raum suchen", { exact: true }).fill("101");
    await expect(page.locator(".room-tile")).toHaveCount(1);
    await page.screenshot({
      path: "test-results/rooms-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: "test-results/rooms-mobile.png",
      fullPage: true,
    });
  } finally {
    const csrf =
      (await page.context().cookies()).find(
        (cookie) => cookie.name === "csrftoken",
      )?.value || "";
    for (const resource of ["rooms", "floors", "buildings"]) {
      const response = await page.request.get(
        `/api/${resource}/?search=${code}`,
      );
      for (const record of (await response.json()).results || []) {
        if (record.code === code)
          await page.request.delete(`/api/${resource}/${record.id}/`, {
            headers: { "X-CSRFToken": csrf },
          });
      }
    }
  }
});
test("Verwaltung: Kalender, Pflege, Raumkacheln und öffentliche Anzeige", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Passwort", { exact: true }).fill("Campuszeit2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Automatisch planen", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Konfliktfrei", { exact: true })).toBeVisible();
  await expect(page.locator(".calendar-event")).toHaveCount(10);
  await page.screenshot({
    path: "test-results/stundenplan.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Stammdaten", exact: true }).click();
  await page
    .getByRole("button", { name: "Gruppen & Klassen", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "dWI25 A1", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Planungsbereiche", exact: true })
    .click();
  await page.getByRole("button", { name: "Hinzufügen", exact: true }).click();
  const code = "E2E-" + Date.now();
  await page.getByRole("dialog").getByLabel("Kennung").fill(code);
  await page.getByRole("dialog").getByLabel("Name").fill("Browser-Testbereich");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page
      .getByRole("cell", { name: "Browser-Testbereich", exact: true })
      .first(),
  ).toBeVisible();
  await page.getByRole("cell", { name: code, exact: true }).click();
  await page.getByRole("button", { name: "Löschen", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Räume", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hörsaal H.101", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Hörsaal H.101", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/campus.png", fullPage: true });
  await page
    .getByRole("button", { name: "Öffentliche Anzeige", exact: true })
    .click();
  const href = await page
    .getByRole("link", { name: "Anzeige öffnen" })
    .first()
    .getAttribute("href");
  await page.goto(href!);
  await expect(
    page.getByRole("heading", { name: "Campus Nord · Wochenübersicht" }),
  ).toBeVisible();
  await expect(page.locator(".calendar-event")).toHaveCount(10);
  await expect(page.getByText("Demo Studierende")).toHaveCount(0);
});
test("Mobiler Einstieg bleibt bedienbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Passwort", { exact: true }).fill("Campuszeit2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Automatisch planen", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Menü öffnen" }).click();
  await page.getByRole("button", { name: "Prüfungen", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Prüfungen", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/mobil.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("Anzeigen haben einen festen Zeitraum, den nur die Verwaltung ändert", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Passwort", { exact: true }).fill("Campuszeit2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page
    .getByRole("button", { name: "Öffentliche Anzeige", exact: true })
    .click();
  await page.getByRole("button", { name: "Hinzufügen", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const code = "E2E-DAY-" + Date.now();
  const name = "Browser-Test Tagesanzeige";
  await dialog.getByLabel("Kennung").fill(code);
  await dialog.getByLabel(/^Name/).fill(name);
  await dialog
    .getByLabel("Anzeigezeitraum", { exact: true })
    .selectOption("tomorrow");
  await dialog
    .locator("label")
    .filter({ hasText: "Stundenpläne" })
    .locator("select")
    .selectOption({ label: "Campusprogramm · Heute, morgen & Wochenende" });
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const card = page
    .locator(".display-cards article")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await expect(card).toContainText("Morgen · 1 Planbereiche");
  const href = await card
    .getByRole("link", { name: "Anzeige öffnen" })
    .getAttribute("href");
  try {
    await page.goto(href!);
    await expect(page.locator(".week-nav strong")).toContainText("Morgen");
    for (const label of ["Woche", "Heute", "Morgen"])
      await expect(
        page.getByRole("button", { name: label, exact: true }),
      ).toHaveCount(0);
    await expect(page.locator(".calendar-heading > div")).toHaveCount(2);
    const token = href!.split("/").pop();
    const payload = await (
      await page.request.get(`/api/public/${token}/?view=today`)
    ).json();
    expect(payload.view_mode).toBe("tomorrow");
    await expect(page.locator(".calendar-event")).toHaveCount(
      payload.rows.length,
    );
    await page.reload();
    await expect(page.locator(".week-nav strong")).toContainText("Morgen");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: "test-results/anzeige-morgen-mobil.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Only administration can change the configured mode for this link.
    for (const [mode, label, columns] of [
      ["today", "Heute", 2],
      ["week", "", 8],
    ] as const) {
      await page.goto("/");
      await page
        .getByRole("navigation")
        .getByRole("button", { name: "Öffentliche Anzeige", exact: true })
        .click();
      await page.getByRole("cell", { name: code, exact: true }).click();
      await page
        .getByRole("dialog")
        .getByLabel("Anzeigezeitraum", { exact: true })
        .selectOption(mode);
      await page
        .getByRole("button", { name: "Speichern", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.goto(href!);
      await expect(page.locator(".calendar-heading > div")).toHaveCount(
        columns,
      );
      if (label)
        await expect(page.locator(".week-nav strong")).toContainText(label);
      for (const label of ["Woche", "Heute", "Morgen"])
        await expect(
          page.getByRole("button", { name: label, exact: true }),
        ).toHaveCount(0);
    }
  } finally {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Öffentliche Anzeige", exact: true })
      .click();
    await page.getByRole("cell", { name: code, exact: true }).click();
    await page.getByRole("button", { name: "Löschen", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});
