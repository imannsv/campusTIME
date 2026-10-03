import { test, expect } from "@playwright/test";
import { studyFlow } from "./study-flow";
import { progressionFlow } from "./progression-flow";
test.use({ actionTimeout: 10000 });

test("Jahrgangsverlauf verschieben, Voraussetzungen und Ausgleich prüfen", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await progressionFlow(page, "BAL-DEMO-2028");
});

test("Geführte Einrichtung: Studienstruktur, Jahrgang und Semester übernehmen", async ({
  page,
}) => {
  test.setTimeout(60000);
  await studyFlow(page);
});

test("Bestehende Browser-Demo wird ohne Verlust von Raumänderungen ergänzt", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Automatisch planen", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const key = "campustime-browser-demo-v1";
    const saved = JSON.parse(localStorage.getItem(key)!);
    saved.data.rooms[0].capacity = 777;
    for (const resource of ["studyversions", "modules", "teachingunits"]) {
      delete saved.data[resource];
      delete saved.schema[resource];
    }
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Automatisch planen", exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("campustime-browser-demo-v1")!),
  );
  expect(saved.data.rooms[0].capacity).toBe(777);
  expect(saved.data.modules).toHaveLength(37);
  await page.evaluate(() => {
    const key = "campustime-browser-demo-v1";
    const saved = JSON.parse(localStorage.getItem(key)!);
    saved.schema.modules = saved.schema.modules.filter(
      (field: any) => field.name !== "difficulty",
    );
    for (const module of saved.data.modules) delete module.difficulty;
    for (const cohort of saved.data.cohorts) {
      delete cohort.study_schedule;
      for (const key of [
        "semester_credit_limit",
        "semester_weekly_limit",
        "semester_difficulty_limit",
      ])
        delete cohort[key];
    }
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Automatisch planen", exact: true }),
  ).toBeVisible();
  const upgraded = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("campustime-browser-demo-v1")!),
  );
  expect(upgraded.data.rooms[0].capacity).toBe(777);
  expect(
    upgraded.data.modules.every((module: any) => module.difficulty === 2),
  ).toBeTruthy();
  expect(
    upgraded.data.cohorts.every(
      (cohort: any) =>
        cohort.study_schedule && cohort.semester_credit_limit === 0,
    ),
  ).toBeTruthy();
  expect(
    saved.data.cohorts.filter((row: any) => row.code === "STUDY-JG27"),
  ).toHaveLength(1);
  await page.evaluate(() => {
    const key = "campustime-browser-demo-v1";
    const state = JSON.parse(localStorage.getItem(key)!);
    state.schema.modules = state.schema.modules.filter(
      (field: any) => !field.name.startsWith("assessment_"),
    );
    for (const module of state.data.modules) {
      delete module.assessment_type;
      delete module.assessment_duration_minutes;
      delete module.assessment_notes;
    }
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Automatisch planen", exact: true }),
  ).toBeVisible();
  const withAssessments = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("campustime-browser-demo-v1")!),
  );
  expect(withAssessments.data.rooms[0].capacity).toBe(777);
  expect(
    withAssessments.data.modules.every(
      (module: any) =>
        module.assessment_type === "unspecified" &&
        module.assessment_duration_minutes === null &&
        module.assessment_notes === "",
    ),
  ).toBeTruthy();
});

test("Demo funktioniert ohne Backend, Raumänderungen bleiben im Browser", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });
  await page.route("**/api/**", (route) => route.abort());
  await page.goto("/");
  await expect(
    page.getByText("Demo mit Beispieldaten", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Automatisch planen", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".calendar-event")).toHaveCount(10);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Räume", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hörsaal H.101", exact: true })
    .click();
  await expect(page.getByText("Belegung laden …")).toHaveCount(0);
  await expect(page.locator(".room-occupancy-list .occupancy")).not.toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Raum bearbeiten", exact: true })
    .click();
  await page.getByRole("dialog").getByLabel("Kapazität").fill("62");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Hörsaal H.101", exact: true }),
  ).toContainText("62 Plätze");
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Räume", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Hörsaal H.101", exact: true }),
  ).toContainText("62 Plätze");
  await page
    .getByRole("button", { name: "1. Obergeschoss", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Hörsaal H.101", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Labor H.201", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Alle Stockwerke", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Raum hinzufügen", exact: true })
    .click();
  await page.getByRole("dialog").getByLabel("Kennung").fill("DEMO-TEST-101");
  await page.getByRole("dialog").getByLabel(/^Name/).fill("Testraum 101");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Testraum 101", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/demo-rooms.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page
    .getByRole("button", { name: "Demo zurücksetzen", exact: true })
    .click();
  await page.getByRole("button", { name: "Menü öffnen", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Räume", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Hörsaal H.101", exact: true }),
  ).toContainText("60 Plätze");
  await expect(
    page.getByRole("button", { name: "Testraum 101", exact: true }),
  ).toHaveCount(0);
  expect(apiRequests).toEqual([]);
});

test("Demoanzeigen bleiben fest auf Woche, Heute oder Morgen eingestellt", async ({
  page,
}) => {
  for (const [name, label, daily] of [
    ["Campus Nord · Heute", "Heute", true],
    ["Campus Nord · Morgen", "Morgen", true],
    ["Produkttest · alle Jahrgänge", "", false],
  ] as const) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Öffentliche Anzeige", exact: true })
      .click();
    const card = page
      .locator(".display-cards article")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
    const link = await card
      .getByRole("link", { name: "Anzeige öffnen" })
      .getAttribute("href");
    await page.goto(link! + "?view=tomorrow");
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".timetable.single-day")).toHaveCount(
      daily ? 1 : 0,
    );
    await expect(page.locator(".calendar-event")).not.toHaveCount(0);
    for (const button of ["Woche", "Heute", "Morgen"])
      await expect(
        page.getByRole("button", { name: button, exact: true }),
      ).toHaveCount(0);
    if (label)
      await expect(page.locator(".week-nav strong")).toContainText(label);
    await page.reload();
    await expect(page.locator(".timetable.single-day")).toHaveCount(
      daily ? 1 : 0,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  }
});
