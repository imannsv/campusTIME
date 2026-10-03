import { expect, Page } from "@playwright/test";

export async function progressionFlow(page: Page, code: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Einrichtung & Studienstruktur", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Schritt 5: Jahrgänge", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Jahrgang hinzufügen", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Name/).fill(code);
  await dialog.getByLabel(/^Kennung/).fill(code);
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByLabel("Jahrgang", { exact: true })
    .selectOption({ label: code });
  await page
    .getByText("Studienverlauf und Semesterbelastung", { exact: true })
    .click();
  const progression = page.locator(".cohort-progression");
  await expect(
    progression.getByLabel("Semester für Programmierung", { exact: true }),
  ).toHaveValue("1");
  // Impossible prerequisite chain cannot be saved or disguised as a suggestion.
  await progression
    .getByLabel("Semester für Programmierung", { exact: true })
    .selectOption("6");
  await expect(
    progression.getByLabel("Prüfung des Studienverlaufs", { exact: true }),
  ).toContainText("Voraussetzungen prüfen");
  await expect(
    progression.getByRole("button", {
      name: "Studienverlauf speichern",
      exact: true,
    }),
  ).toBeDisabled();
  await progression
    .getByRole("button", { name: "Ausgleich vorschlagen", exact: true })
    .click();
  await expect(
    progression.getByLabel("Ausgleichsvorschlag", { exact: true }),
  ).toContainText("nicht erfüllen");
  await progression
    .getByRole("button", { name: "Vorschlag verwerfen", exact: true })
    .click();
  await progression
    .getByRole("button", { name: "Standard wiederherstellen", exact: true })
    .click();
  await expect(
    progression.getByLabel("Semester für Programmierung", { exact: true }),
  ).toHaveValue("1");
  // Shift a two-semester parent module, preserving its relative semester spacing.
  await progression
    .getByLabel("Modul verschieben", { exact: true })
    .selectOption({ label: "Grundlagen Informatik" });
  await progression
    .getByLabel("Neues Startsemester", { exact: true })
    .selectOption("4");
  await progression
    .getByRole("button", { name: "Modul verschieben", exact: true })
    .click();
  await expect(
    progression.getByLabel("Semester für Programmierung", { exact: true }),
  ).toHaveValue("4");
  await expect(
    progression.getByLabel("Semester für Datenbanken", { exact: true }),
  ).toHaveValue("5");
  await expect(
    progression.getByLabel("Programmierung fixieren", { exact: true }),
  ).toBeChecked();
  await expect(
    progression.getByLabel("Studienverlauf Semester 4", { exact: true }),
  ).toContainText("35 CP-Anteile");
  await progression
    .getByRole("button", { name: "Ausgleich vorschlagen", exact: true })
    .click();
  await expect(
    progression.getByLabel("Ausgleichsvorschlag", { exact: true }),
  ).toContainText("0 nach dem Vorschlag");
  await progression
    .getByRole("button", {
      name: "Vorschlag in Vorschau übernehmen",
      exact: true,
    })
    .click();
  await expect(
    progression.getByLabel("Semester für Programmierung", { exact: true }),
  ).toHaveValue("4");
  await expect(
    progression.getByLabel("Semester für Datenbanken", { exact: true }),
  ).toHaveValue("5");
  await expect(
    progression.locator(".progression-semester.overloaded"),
  ).toHaveCount(0);
  await progression
    .getByRole("button", { name: "Studienverlauf speichern", exact: true })
    .click();
  await expect(
    progression.getByRole("button", {
      name: "Studienverlauf speichern",
      exact: true,
    }),
  ).toBeDisabled();
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Einrichtung & Studienstruktur", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Schritt 5: Jahrgänge", exact: true })
    .click();
  await page
    .getByLabel("Jahrgang", { exact: true })
    .selectOption({ label: code });
  await page
    .getByText("Studienverlauf und Semesterbelastung", { exact: true })
    .click();
  await expect(
    progression.getByLabel("Semester für Programmierung", { exact: true }),
  ).toHaveValue("4");
  await page.screenshot({
    path: "test-results/cohort-progression.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/cohort-progression-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
}
