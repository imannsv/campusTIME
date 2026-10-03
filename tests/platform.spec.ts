import { test, expect } from "@playwright/test";
test("Verwaltung: Kalender, Pflege, Raumkarte und öffentliche Anzeige", async ({
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
  await page.getByRole("button", { name: "Planbereiche", exact: true }).click();
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
    .getByRole("button", { name: "Campus & Räume", exact: true })
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

test("Tagesanzeigen lassen sich speichern und zwischen Heute, Morgen und Woche wechseln", async ({
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
    await expect(
      page.getByRole("button", { name: "Morgen", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".calendar-heading > div")).toHaveCount(2);
    const token = href!.split("/").pop();
    const payload = await (
      await page.request.get(`/api/public/${token}/`)
    ).json();
    await expect(page.locator(".calendar-event")).toHaveCount(
      payload.rows.length,
    );
    await page.getByRole("button", { name: "Heute", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Heute", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".calendar-heading > div")).toHaveCount(2);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: "test-results/anzeige-heute-mobil.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Morgen", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Morgen", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({
      path: "test-results/anzeige-morgen.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Woche", exact: true }).click();
    await expect(page.locator(".calendar-heading > div")).toHaveCount(8);
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
