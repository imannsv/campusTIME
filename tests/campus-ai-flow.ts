import { expect, type Page } from "@playwright/test";

export async function campusAIFlow(page: Page) {
  const launcher = page.getByRole("button", {
    name: "Freddy öffnen",
    exact: true,
  });
  await expect(launcher).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Freddy", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "Freddy", exact: true }),
  ).toHaveCount(0);
  await launcher.click();
  const chat = page.getByRole("dialog", { name: "Freddy", exact: true });
  await expect(chat).toBeVisible();
  await expect(page.getByLabel("Deine Frage an Freddy")).toBeFocused();
  await expect(chat).toContainText(
    "Hi, ich bin Freddy, dein CampusAI-Assistent. Wie kann ich dir helfen?",
  );
  expect(
    await page
      .locator(".campus-ai-questions")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/freddy-welcome-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Kontext für Freddy auswählen" })
    .click();
  await page.screenshot({
    path: "test-results/freddy-context-picker.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Kontext für Freddy auswählen" })
    .click();
  await expect(page.locator(".campus-ai select")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Chat-Optionen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Schnellhilfe nutzen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Freddy", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Wie lege ich einen neuen Jahrgang an?",
      exact: true,
    }),
  ).toBeEnabled();

  await page
    .getByRole("button", {
      name: "Wie lege ich einen neuen Jahrgang an?",
      exact: true,
    })
    .click();
  const answer = page.locator(".campus-ai-message.assistant");
  await expect(answer).toContainText("Schnellhilfe");
  await expect(answer).toContainText("Schritt 5: Jahrgänge");
  await expect(answer).toContainText("Keine Daten geändert");
  await page
    .getByLabel("Deine Frage an Freddy")
    .fill("Wie prüfe ich die Semesterbelastung?");
  await page.getByRole("button", { name: "Frage senden", exact: true }).click();
  await expect(answer).toHaveCount(2);
  await expect(answer.last()).toContainText("Voraussetzungen");
  await page
    .getByRole("button", { name: "Chat schließen", exact: true })
    .click();
  await expect(chat).not.toBeVisible();
  await expect(launcher).toBeFocused();
  await launcher.click();
  await expect(answer).toHaveCount(2);
  await answer
    .first()
    .getByRole("button", { name: "Jahrgang und Gruppen", exact: true })
    .click();
  await expect(chat).toBeVisible();
  await expect(answer).toHaveCount(2);
  await page
    .getByRole("button", { name: "Kontext für Freddy auswählen" })
    .click();
  await page
    .getByRole("group", { name: "Kontext auswählen", exact: true })
    .getByRole("button", { name: "Allgemeine Einrichtung", exact: true })
    .click();
  await expect(answer).toHaveCount(0);
  await expect(page.locator(".campus-ai-context-line")).toContainText(
    "Allgemeine Einrichtung",
  );
  await page
    .getByRole("button", { name: "Chat-Optionen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hinweise aktualisieren", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Wie lege ich einen neuen Jahrgang an?",
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Chat-Optionen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Schnellhilfe nutzen", exact: true })
    .click();
  await page
    .getByLabel("Deine Frage an Freddy")
    .fill("Was ist die Hauptstadt von Kanada?");
  await page.getByRole("button", { name: "Frage senden", exact: true }).click();
  await expect(answer).toContainText("keine passende Schnellhilfe");
  await page.screenshot({
    path: "test-results/campus-ai-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const scrim = page.locator(".sidebar-scrim");
  if (await scrim.isVisible()) await scrim.click();
  await expect(page.getByLabel("Deine Frage an Freddy")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/campus-ai-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByLabel("Deine Frage an Freddy")
    .fill("Diese Nachricht noch nicht senden.");
  await page
    .getByRole("button", { name: "Chat-Optionen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Gespräch leeren", exact: true })
    .click();
  await expect(answer).toHaveCount(0);
  await expect(page.getByLabel("Deine Frage an Freddy")).toHaveValue(
    "Diese Nachricht noch nicht senden.",
  );
  const box = await chat.boundingBox();
  expect(
    await page
      .locator(".campus-ai-questions")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/freddy-welcome-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  await page.getByLabel("Deine Frage an Freddy").press("Escape");
  await expect(chat).not.toBeVisible();
  await expect(launcher).toBeFocused();
  await launcher.click();
  await expect(chat).toBeVisible();
  await page
    .getByRole("button", { name: "Kontext für Freddy auswählen" })
    .click();
  await page
    .getByRole("group", { name: "Kontext auswählen", exact: true })
    .getByRole("button", { name: "Allgemeine Einrichtung", exact: true })
    .focus();
  await page.keyboard.press("Escape");
  await expect(chat).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Kontext auswählen", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Kontext für Freddy auswählen" }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Chat-Optionen", exact: true })
    .click();
}
