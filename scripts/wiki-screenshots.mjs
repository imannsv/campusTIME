// Capture only the disposable Wiki fixture, never a customer's live database.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
const baseURL = "http://127.0.0.1:5186";
const directory = path.resolve(import.meta.dirname, "../shared/wiki/images");
await fs.mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
try {
  await page.goto(baseURL);
  await page.getByLabel("Passwort", { exact: true }).fill("WikiBuildOnly2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page.getByRole("navigation", { name: "Arbeitsbereiche" }).waitFor();
  await page.getByRole("button", { name: "Termin", exact: true }).waitFor();
  const capture = async (...names) => {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const main = page.locator("main.main-content");
    await main
      .evaluate((el) => (el.scrollTop = 0), { timeout: 1000 })
      .catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 0));
    const bytes = await page.screenshot({ animations: "disabled" });
    for (const name of names)
      await fs.writeFile(path.join(directory, name + ".png"), bytes);
    console.log(names.join(", "));
  };
  const nav = async (name) => {
    await page
      .getByRole("navigation", { name: "Arbeitsbereiche" })
      .getByRole("button", { name, exact: true })
      .click();
  };
  const step = async (index, name) => {
    await nav("Einrichtung & Studienstruktur");
    await page
      .getByRole("button", { name: `Schritt ${index}: ${name}`, exact: true })
      .click();
  };
  const cancel = async () => {
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Abbrechen", exact: true })
      .click();
  };
  await capture("schedule", "start-10", "periods", "ui");
  await page.getByRole("button", { name: "Termin", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await capture("manual");
  await cancel();
  await page
    .getByRole("button", { name: "Veröffentlichen", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await capture("publication");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Schließen", exact: true })
    .first()
    .click();
  await nav("Räume");
  await capture("rooms", "start-02", "definitions");
  await step(2, "Lehrende");
  await page
    .getByRole("button", { name: "Lehrende hinzufügen", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await capture("teachers", "start-03");
  await cancel();
  await step(3, "Studiengänge");
  await capture("start-04");
  await step(4, "Studienstruktur");
  await page
    .getByRole("button", { name: "Neue Version aus Kopie", exact: true })
    .click();
  const copy = page.getByRole("dialog", { name: "Neue Lehrplanversion" });
  await copy.getByLabel("Kennung", { exact: true }).fill(`WIKI-${Date.now()}`);
  await copy.getByLabel("Versionsbezeichnung", { exact: true }).fill("2028");
  await copy
    .getByLabel("Name", { exact: true })
    .fill("Wirtschaftsinformatik · Entwurf 2028");
  await copy
    .getByRole("button", { name: "Kopie anlegen", exact: true })
    .click();
  await copy.waitFor({ state: "hidden" });
  await capture("study", "start-05");
  const approve = page.getByRole("button", {
    name: "Lehrplan freigeben",
    exact: true,
  });
  await approve.scrollIntoViewIfNeeded();
  await page
    .locator(".study-report")
    .getByRole("heading", { name: "Vollständigkeitsprüfung" })
    .waitFor();
  await fs.writeFile(
    path.join(directory, "start-06.png"),
    await page.screenshot({ animations: "disabled" }),
  );
  await page
    .getByLabel("Lehrplanversion", { exact: true })
    .selectOption({
      label: "Wirtschaftsinformatik · Beispiel 2027 · Freigegeben",
    });
  await page.getByText("Semesterübersicht", { exact: true }).click();
  await capture("schools");
  await step(5, "Jahrgänge");
  await capture("cohort", "start-07");
  const progression = page.getByText("Studienverlauf und Semesterbelastung", {
    exact: true,
  });
  if (await progression.count()) await progression.click();
  await capture("progression", "start-08");
  await step(6, "Semester planen");
  await capture("start-09");
  await nav("Prüfungen");
  await capture("assessments", "start-11");
  await nav("Öffentliche Anzeige");
  await capture("display", "start-12");
  await nav("Studierendenübersicht");
  await capture("students");
  await nav("Stammdaten");
  await page
    .locator(".resource-tabs")
    .getByRole("button", { name: "Raumblockierungen", exact: true })
    .click();
  await capture("blocks");
  await page
    .locator(".resource-tabs")
    .getByRole("button", { name: "Veranstaltungen", exact: true })
    .click();
  await capture("electives");
  await page.getByRole("button", { name: "Importieren", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await capture("imports");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Schließen", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  await capture("settings", "accounts", "start-01");
  await page
    .getByRole("button", { name: "Freddy öffnen", exact: true })
    .click();
  await capture("freddy", "troubleshooting");
  await page.goto(baseURL + "/wiki/setup");
  await page.locator(".wiki-article").waitFor();
} finally {
  await browser.close();
}
