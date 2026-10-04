import { expect, type Page } from "@playwright/test";

export async function campusAIFlow(page: Page) {
  const launcher = page.getByRole("button", {
    name: "campusAI öffnen",
    exact: true,
  });
  await expect(launcher).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "campusAI", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "campusAI", exact: true }),
  ).toHaveCount(0);
  await launcher.click();
  const chat = page.getByRole("dialog", { name: "campusAI", exact: true });
  await expect(chat).toBeVisible();
  await expect(page.getByLabel("Deine Frage an campusAI")).toBeFocused();
  await page.getByText("Plan und Hinweise", { exact: false }).first().click();
  await expect(
    page.getByRole("heading", { name: "campusAI", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Wie lege ich einen neuen Jahrgang an?",
      exact: true,
    }),
  ).toBeEnabled();
  const model = page.getByRole("checkbox", { name: "Lokale KI nutzen" });
  if (await model.isEnabled()) await model.uncheck();
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
    .getByLabel("Deine Frage an campusAI")
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
  await page.getByLabel("Semesterplan für campusAI").selectOption("");
  await expect(answer).toHaveCount(0);
  await expect(page.getByLabel("Jahrgang für campusAI")).toBeVisible();
  await page
    .getByRole("button", { name: "Hinweise aktualisieren", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Wie lege ich einen neuen Jahrgang an?",
      exact: true,
    }),
  ).toBeEnabled();
  if (await model.isEnabled()) await model.uncheck();
  await page
    .getByLabel("Deine Frage an campusAI")
    .fill("Was ist die Hauptstadt von Kanada?");
  await page.getByRole("button", { name: "Frage senden", exact: true }).click();
  await expect(answer).toContainText("keine passende Schnellhilfe");
  await page.locator(".campus-ai-options summary").click();
  await page.screenshot({
    path: "test-results/campus-ai-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const scrim = page.locator(".sidebar-scrim");
  if (await scrim.isVisible()) await scrim.click();
  await expect(page.getByLabel("Deine Frage an campusAI")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/campus-ai-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByLabel("Deine Frage an campusAI")
    .fill("Diese Nachricht noch nicht senden.");
  await page
    .getByRole("button", { name: "Gespräch leeren", exact: true })
    .click();
  await expect(answer).toHaveCount(0);
  await expect(page.getByLabel("Deine Frage an campusAI")).toHaveValue(
    "Diese Nachricht noch nicht senden.",
  );
  const box = await chat.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  await page.getByLabel("Deine Frage an campusAI").press("Escape");
  await expect(chat).not.toBeVisible();
  await expect(launcher).toBeFocused();
  await launcher.click();
  await expect(chat).toBeVisible();
  await page.locator(".campus-ai-options summary").click();
}
