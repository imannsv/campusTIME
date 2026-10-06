import { test, expect } from "@playwright/test";
import { studyFlow } from "./study-flow";
import { progressionFlow } from "./progression-flow";
import { overviewFlow } from "./overview-flow";
import { assessmentFlow } from "./assessment-flow";
import { campusAIFlow } from "./campus-ai-flow";
test.use({ actionTimeout: 10000 });

test("Stundenplanung öffnet die aktuelle Woche und folgt der roten Zeitlinie", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-14T13:15:00+02:00") });
  await page.goto("/");
  await expect(page.locator(".calendar-event")).toHaveCount(10);
  await page.evaluate(() => {
    const key = "campustime-browser-demo-v1";
    const state = JSON.parse(localStorage.getItem(key)!);
    const plan = state.data.plans[0];
    state.data.periods.find((item: any) => item.id === plan.period).start =
      "2026-08-03";
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(page.locator(".week-nav")).toContainText(
    "12. Okt. – 16. Okt. 2026",
  );
  const marker = page.locator(".calendar-now-line");
  const scroller = page.locator(".calendar-scroll");
  await expect(marker).toHaveAttribute("aria-label", "Aktuelle Uhrzeit 13:15");
  await expect(marker).toHaveCSS("height", "1px");
  await expect(marker).toBeInViewport();
  await scroller.evaluate((element) => (element.scrollTop = 0));
  await page.clock.runFor(61000);
  await expect(marker).toHaveAttribute("aria-label", "Aktuelle Uhrzeit 13:16");
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Jetzt folgen", exact: true }).click();
  await scroller.evaluate((element) => (element.scrollTop = 0));
  await page.clock.runFor(60000);
  await expect(scroller).toHaveJSProperty("scrollTop", 0);
  await expect(marker).toHaveAttribute("aria-label", "Aktuelle Uhrzeit 13:17");
  await page.getByRole("button", { name: "Vorherige Woche" }).click();
  await expect(marker).toHaveCount(0);
  await page.getByRole("button", { name: "Diese Woche", exact: true }).click();
  await expect(marker).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Jetzt folgen", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  // The time marker remains visible even outside the institution's teaching hours.
  await page.clock.setSystemTime(new Date("2026-10-14T22:30:00+02:00"));
  await page.clock.runFor(15000);
  await expect(marker).toHaveAttribute("aria-label", "Aktuelle Uhrzeit 22:30");
  await expect(marker).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".calendar-now-line")).toHaveAttribute(
    "aria-label",
    "Aktuelle Uhrzeit 22:30",
  );
  await expect(page.locator(".calendar-now-line")).toBeInViewport();
  await page.clock.setSystemTime(new Date("2026-10-18T23:59:45+02:00"));
  await page.clock.runFor(60000);
  await expect(page.locator(".week-nav")).toContainText(
    "19. Okt. – 23. Okt. 2026",
  );
  await expect(page.locator(".calendar-now-line")).toHaveAttribute(
    "aria-label",
    "Aktuelle Uhrzeit 00:00",
  );
});


test("campusAI Schnellhilfe bleibt ohne Server und ohne Datenänderung verfügbar", async ({
  page,
}) => {
  test.setTimeout(60000);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      requests.push(request.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Freddy öffnen", exact: true }),
  ).toBeVisible();
  const before = await page.evaluate(() =>
    localStorage.getItem("campustime-browser-demo-v1"),
  );
  await campusAIFlow(page);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("campustime-browser-demo-v1"),
    ),
  ).toEqual(before);
  expect(requests).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Lokale KI nutzen" }),
  ).toBeDisabled();
});

test("Studierendenübersicht filtert Kurse, bleibt teilbar und aktualisiert sich", async ({
  page,
}) => {
  test.setTimeout(60000);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      requests.push(request.url());
  });
  await page.clock.install();
  await page.goto("/");
  const { mathKey, sharedUrl } = await overviewFlow(page);
  await page.evaluate((key) => {
    const storageKey = "campustime-browser-demo-v1";
    const state = JSON.parse(localStorage.getItem(storageKey)!);
    for (const publication of state.publications)
      for (const row of publication.snapshot)
        if (row.overview_scope.course === key)
          row.name = "Mathematik I · aktualisiert";
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, mathKey);
  await page.clock.runFor(10000);
  await expect(page.locator(".student-agenda")).toContainText(
    "Mathematik I · aktualisiert",
  );
  await expect(page.getByLabel("Kurs", { exact: true })).toHaveValue(mathKey);
  expect(page.url()).toBe(sharedUrl);
  expect(requests).toEqual([]);
});

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
  test.setTimeout(120000);
  await studyFlow(page);
  await assessmentFlow(page);
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
    for (const publication of saved.publications)
      for (const row of publication.snapshot) delete row.overview_scope;
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
  expect(
    saved.publications.every((publication: any) =>
      publication.snapshot.every(
        (row: any) => row.overview_scope?.groups && row.overview_scope.course,
      ),
    ),
  ).toBeTruthy();
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
  const originalExam = withAssessments.data.exams[0];
  await page.evaluate(() => {
    const key = "campustime-browser-demo-v1";
    const state = JSON.parse(localStorage.getItem(key)!);
    delete state.schema.assessments;
    delete state.data.assessments;
    state.schema.exams = state.schema.exams.filter(
      (field: any) =>
        ![
          "assessment_template",
          "assessment_type",
          "assessment_notes",
        ].includes(field.name),
    );
    for (const exam of state.data.exams) {
      delete exam.assessment_template;
      delete exam.assessment_type;
      delete exam.assessment_notes;
    }
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Automatisch planen", exact: true }),
  ).toBeVisible();
  const templatesUpgrade = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("campustime-browser-demo-v1")!),
  );
  expect(templatesUpgrade.data.rooms[0].capacity).toBe(777);
  expect(templatesUpgrade.data.assessments).toEqual([]);
  expect(
    templatesUpgrade.schema.assessments.some(
      (field: any) => field.name === "due_at",
    ),
  ).toBeTruthy();
  expect(templatesUpgrade.data.exams[0]).toEqual({
    ...originalExam,
    assessment_template: null,
    assessment_type: "exam",
    assessment_notes: "",
  });
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
