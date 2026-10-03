import { test, expect } from "@playwright/test";

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
