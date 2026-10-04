import { expect, type Page } from "@playwright/test";

export async function overviewFlow(page: Page) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Studierendenübersicht", exact: true })
    .click();
  const card = page.locator(".display-cards article").filter({
    has: page.getByRole("heading", {
      name: "Produkttest · alle Jahrgänge",
      exact: true,
    }),
  });
  const href = await card
    .getByRole("link", { name: "Studierendenübersicht öffnen" })
    .getAttribute("href");
  expect(href).toMatch(/^\/overview\//);
  await page.goto(href!);
  await expect(
    page.getByRole("heading", { name: "Stundenplanübersicht", exact: true }),
  ).toBeVisible();
  for (const name of ["Heute", "Morgen", "Woche"])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
  await page
    .getByLabel("Jahrgang", { exact: true })
    .selectOption({ label: "dWI25" });
  await page
    .getByLabel("Gruppe / Klasse", { exact: true })
    .selectOption({ label: "dWI25 A1" });
  const openFirst = page.getByRole("button", {
    name: "Erste geplante Woche öffnen",
  });
  // The local fixture and the date-shifted browser demo can start in different weeks.
  await expect(page.getByRole("status")).not.toContainText("werden geladen");
  if (await openFirst.isVisible()) await openFirst.click();
  await expect(page.locator(".student-grid .calendar-event")).not.toHaveCount(
    0,
  );
  await expect(page.locator(".student-grid")).toContainText("Mathematik I");
  await expect(page.locator(".student-grid")).toContainText(
    "Programmierung · A1",
  );
  await expect(page.locator(".student-grid")).not.toContainText(
    "Programmierung · A2",
  );
  await expect(
    page.getByLabel("Kurs", { exact: true }).locator("option"),
  ).toContainText(["Wahlpflicht: UX & Design"]);
  const mathOption = page
    .getByLabel("Kurs", { exact: true })
    .locator("option")
    .filter({ hasText: /^Mathematik I ·/ })
    .first();
  const mathKey = await mathOption.getAttribute("value");
  await page.getByLabel("Kurs", { exact: true }).selectOption(mathKey!);
  await expect(page.locator(".student-grid .calendar-event")).not.toHaveCount(
    0,
  );
  for (const name of await page
    .locator(".student-grid .calendar-event strong")
    .allTextContents())
    expect(name).toContain("Mathematik");
  await expect(page).toHaveURL(/cohort=\d+.*group=\d+.*course=course%3A\d+/);
  const sharedUrl = page.url();
  const groupKey = await page
    .getByLabel("Gruppe / Klasse", { exact: true })
    .inputValue();
  await page.reload();
  await expect(page.getByLabel("Kurs", { exact: true })).toHaveValue(mathKey!);
  await expect(page.getByLabel("Gruppe / Klasse", { exact: true })).toHaveValue(
    groupKey,
  );
  await expect(page.locator(".student-grid .calendar-event")).not.toHaveCount(
    0,
  );
  await page.screenshot({
    path: "test-results/student-overview-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".student-agenda")).toBeVisible();
  await expect(page.locator(".student-grid")).not.toBeVisible();
  await expect(page.locator(".student-agenda")).toContainText("Mathematik I");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/student-overview-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Nächste Woche", exact: true })
    .click();
  await expect(page.getByLabel("Kurs", { exact: true })).toHaveValue(mathKey!);
  await expect(page.getByRole("status")).not.toContainText("werden geladen");
  await page
    .getByRole("button", { name: "Vorherige Woche", exact: true })
    .click();
  await page.getByLabel("Woche auswählen", { exact: true }).fill("2030-01-07");
  await expect(page.locator(".display-empty")).toContainText(
    "keine veröffentlichten Termine",
  );
  await expect(page.getByLabel("Kurs", { exact: true })).toHaveValue(mathKey!);
  await page
    .getByRole("button", { name: "Erste geplante Woche öffnen" })
    .click();
  await page
    .getByLabel("Jahrgang", { exact: true })
    .selectOption({ label: "dWI24" });
  await expect(page.getByLabel("Gruppe / Klasse", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByLabel("Kurs", { exact: true })).toHaveValue("");
  await expect(
    page.getByLabel("Gruppe / Klasse", { exact: true }).locator("option"),
  ).toContainText(["dWI24 A1"]);
  await expect(
    page.getByLabel("Gruppe / Klasse", { exact: true }).locator("option"),
  ).not.toContainText(["dWI25 A1"]);
  await page.getByRole("button", { name: "Filter zurücksetzen" }).click();
  await expect(page.getByLabel("Jahrgang", { exact: true })).toHaveValue("");
  await page.goto(sharedUrl);
  await expect(page.getByLabel("Kurs", { exact: true })).toHaveValue(mathKey!);
  await expect(page.locator(".student-agenda")).toContainText("Mathematik I");
  return { href: href!, mathKey: mathKey!, sharedUrl };
}
