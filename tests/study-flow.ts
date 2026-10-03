import { expect, Page } from "@playwright/test";

export async function studyFlow(page: Page) {
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Einrichtung & Studienstruktur", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Schritt 3: Studiengänge", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Studiengang hinzufügen", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Name/).fill("Teststudiengang 2028");
  await dialog
    .getByLabel("Regelstudienzeit (Semester)", { exact: true })
    .fill("2");
  await dialog.getByLabel("Credit Points gesamt", { exact: true }).fill("10");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .locator(".study-context")
    .getByLabel("Studien-/Bildungsgang", { exact: true })
    .selectOption({ label: "Teststudiengang 2028" });
  await page
    .getByRole("button", { name: "Lehrplanversion hinzufügen", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Name/).fill("Testlehrplan 2028");
  await dialog.getByLabel(/^Versionsbezeichnung/).fill("2028");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Schritt 4: Studienstruktur", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Lehrplan freigeben", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Obermodul hinzufügen", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Name/).fill("Informatik-Grundlagen");
  await dialog.getByLabel("Credit Points", { exact: true }).fill("10");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  for (const [name, semester] of [
    ["Programmierung", 1],
    ["Datenbanken", 2],
  ] as const) {
    await page
      .getByRole("button", { name: "Teilmodul hinzufügen", exact: true })
      .first()
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^Name/).fill(name);
    await dialog.getByLabel("Credit Points", { exact: true }).fill("5");
    await dialog
      .getByRole("button", { name: "Speichern", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    const heading = page
      .locator(".study-module-heading")
      .filter({ has: page.getByText(name, { exact: true }) });
    await heading
      .getByRole("button", {
        name: "Lehrveranstaltung hinzufügen",
        exact: true,
      })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^Name/).fill(name + " Vorlesung");
    await dialog
      .getByLabel("Fachsemester", { exact: true })
      .fill(String(semester));
    await dialog
      .getByLabel("Durchführung für Gruppen", { exact: true })
      .selectOption(semester === 1 ? "per_group" : "combined");
    await expect(
      dialog.getByLabel("Soll (Unterrichtseinheiten)", { exact: true }),
    ).toHaveValue("2");
    await dialog
      .getByLabel("Personen", { exact: true })
      .selectOption({ index: 1 });
    await dialog
      .getByRole("button", { name: "Speichern", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
  }
  await expect(page.locator(".study-facts")).toContainText("10 / 10 CP");
  await expect(
    page.getByRole("button", { name: "Lehrplan freigeben", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Lehrplan freigeben", exact: true })
    .click();
  await expect(page.locator(".study-facts")).toContainText("Inhalte geschützt");
  await expect(
    page.getByRole("button", { name: "Obermodul hinzufügen", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Schritt 5: Jahrgänge", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Jahrgang hinzufügen", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Name/).fill("Testjahrgang 2028");
  await dialog.getByLabel("Aufnahmejahr", { exact: true }).fill("2028");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  for (const group of ["A1", "A2"]) {
    await page
      .getByRole("button", { name: "Gruppe hinzufügen", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^Name/).fill("Testjahrgang " + group);
    await dialog.getByLabel("Gruppengröße", { exact: true }).fill("20");
    await dialog
      .getByRole("button", { name: "Speichern", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
  }
  await page
    .getByRole("button", { name: "Studierende hinzufügen", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Name/).fill("Fiktive Testperson");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Studierendenliste verwalten", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("cell", { name: "Fiktive Testperson", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Dr. Anna Berger", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Einrichtung & Studienstruktur", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Schritt 6: Semester planen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Zeitraum hinzufügen", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Name/).fill("Testzeitraum 2028");
  await dialog.getByLabel(/^Beginn/).fill("2028-10-02");
  await dialog.getByLabel(/^Ende/).fill("2028-10-06");
  await dialog
    .getByLabel("Unterrichtsfrei ab", { exact: true })
    .fill("2028-10-03");
  await dialog
    .getByLabel("Unterrichtsfrei bis", { exact: true })
    .fill("2028-10-03");
  await dialog
    .getByRole("button", { name: "Freie Tage hinzufügen", exact: true })
    .click();
  await expect(dialog.locator("textarea")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .locator(".study-context")
    .getByLabel("Studien-/Bildungsgang", { exact: true })
    .selectOption({ label: "Teststudiengang 2028" });
  await page
    .getByRole("button", { name: "Semesterplan hinzufügen", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Name/).fill("Testsemester 1");
  await dialog
    .getByLabel("Planungszeiträume", { exact: true })
    .selectOption({ label: "Testzeitraum 2028" });
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Veranstaltungen übernehmen", exact: true })
    .click();
  await expect(page.locator(".study-message")).toContainText(
    "2 Veranstaltungen übernommen",
  );
  await page
    .getByRole("button", { name: "Veranstaltungen übernehmen", exact: true })
    .click();
  await expect(page.locator(".study-message")).toContainText(
    "0 Veranstaltungen übernommen; 2 vorhandene erhalten",
  );
  await page.screenshot({
    path: "test-results/study-semester.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/study-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Stundenplanung öffnen", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Stundenplan auswählen", exact: true }),
  ).toHaveValue(/\d+/);
}
