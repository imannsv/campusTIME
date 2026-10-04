import { expect, Page } from "@playwright/test";

export async function assessmentFlow(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Prüfungen", exact: true })
    .click();
  const board = page.getByRole("region", {
    name: "Prüfungsanforderungen des Semesterplans",
  });
  await board
    .getByRole("button", {
      name: "Prüfungsanforderungen übernehmen",
      exact: true,
    })
    .click();
  await expect(board).toContainText(
    "1 Vorlagen übernommen; 0 vorhandene erhalten.",
  );
  const card = board.getByRole("article", {
    name: "Programmierung",
    exact: true,
  });
  await expect(card).toContainText("Klausur · 120 Min.");
  await card
    .getByRole("button", { name: "Prüfung anlegen", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(/^Termindauer \(Minuten\)/)).toHaveValue(
    "120",
  );
  await expect(dialog).toContainText(
    "Gruppenliste unvollständig; Teilnehmer prüfen.",
  );
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(card).toContainText("Prüfung angelegt");
  await expect(card).toContainText("1 Teilnehmer");
  await expect(
    card.getByRole("button", { name: "Prüfung anlegen", exact: true }),
  ).toHaveCount(0);
  await board
    .getByRole("button", {
      name: "Prüfungsanforderungen übernehmen",
      exact: true,
    })
    .click();
  await expect(board).toContainText(
    "0 Vorlagen übernommen; 1 vorhandene erhalten.",
  );
  await expect(board.locator(".assessment-cards article")).toHaveCount(1);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Einrichtung & Studienstruktur", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Schritt 6: Semester planen", exact: true })
    .click();
  await page
    .locator(".study-context")
    .getByLabel("Studien-/Bildungsgang", { exact: true })
    .selectOption({ label: "Teststudiengang 2028" });
  await page
    .getByRole("button", { name: "Semesterplan hinzufügen", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Name/).fill("Testsemester 2");
  await dialog.getByLabel("Fachsemester", { exact: true }).fill("2");
  await dialog
    .getByLabel("Planungszeiträume", { exact: true })
    .selectOption({ label: "Testzeitraum 2028" });
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .locator(".study-card")
    .filter({
      has: page.getByText("Testsemester 2", { exact: true }),
    })
    .getByRole("button", { name: "Prüfungen und Abgaben öffnen", exact: true })
    .click();
  await board
    .getByRole("button", {
      name: "Prüfungsanforderungen übernehmen",
      exact: true,
    })
    .click();
  await board
    .getByRole("button", { name: "Abgaben & Fristen (1)", exact: true })
    .click();
  const paper = board.getByRole("article", {
    name: "Datenbanken",
    exact: true,
  });
  await expect(paper).toContainText("Abgabe vier Wochen nach Themenausgabe");
  await expect(
    paper.getByRole("button", { name: "Prüfung anlegen", exact: true }),
  ).toHaveCount(0);
  await paper
    .getByRole("button", { name: "Abgabefrist bearbeiten", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Abgabefrist", { exact: true })
    .fill("2028-10-20T23:59");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(paper).toContainText("20.10.2028 · 23:59");
  await board
    .getByRole("button", {
      name: "Prüfungsanforderungen übernehmen",
      exact: true,
    })
    .click();
  await expect(paper).toContainText("20.10.2028 · 23:59");
  await page.screenshot({
    path: "test-results/assessment-deadlines.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Prüfungen", exact: true })
    .click();
  await page
    .getByLabel("Semesterplan für Prüfungen", { exact: true })
    .selectOption({ label: "Testsemester 2" });
  await board
    .getByRole("button", { name: "Abgaben & Fristen (1)", exact: true })
    .click();
  await expect(paper).toContainText("20.10.2028 · 23:59");
  await expect(
    board.getByRole("button", {
      name: "Prüfungsanforderungen übernehmen",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    page.getByRole("cell", { name: "Datenbanken", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const scrim = page.locator(".sidebar-scrim");
  if (await scrim.isVisible())
    await scrim.click({ position: { x: 350, y: 20 } });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/assessment-deadlines-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
}
