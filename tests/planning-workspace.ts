import { test, expect } from "@playwright/test";

test.describe("Terminbearbeitung", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date("2026-10-07T08:00:00Z") });
  });

  test("Planungszentrale: Kalender und Terminbearbeitung bleiben nebeneinander bedienbar", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("complementary", { name: "Termindetails" }),
    ).toBeVisible();
    const event = page
      .locator(".calendar-event")
      .filter({ hasText: "Mathematik I" })
      .first();
    await event.click();
    const editor = page.getByRole("region", {
      name: "Termin bearbeiten",
      exact: true,
    });
    await expect(editor).toBeVisible();
    await expect(page.locator(".modal-backdrop")).toHaveCount(0);
    await expect(event).toHaveAttribute("aria-pressed", "true");
    const saveBounds = await editor
      .getByRole("button", { name: "Speichern", exact: true })
      .boundingBox();
    expect(saveBounds!.y + saveBounds!.height).toBeLessThanOrEqual(1000);
    const calendarBounds = await page.locator(".schedule-panel").boundingBox();
    const editorBounds = await editor.boundingBox();
    expect(editorBounds!.x).toBeGreaterThanOrEqual(
      calendarBounds!.x + calendarBounds!.width,
    );
    const calendarWidth = await page
      .locator(".calendar-scroll")
      .evaluate((element) => ({
        client: element.clientWidth,
        content: element.scrollWidth,
      }));
    expect(calendarWidth.content).toBeLessThanOrEqual(calendarWidth.client);
    await page
      .getByLabel("Raum filtern")
      .selectOption({ label: "Hörsaal H.101" });
    await expect(editor).toBeVisible();
    await page.getByLabel("Raum filtern").selectOption("");
    await expect(page.locator(".calendar-event")).toHaveCount(10);
    const fixed = editor.getByLabel("Termin fixieren");
    const previous = await fixed.isChecked();
    await fixed.setChecked(!previous);
    await editor
      .getByRole("button", { name: "Speichern", exact: true })
      .click();
    await expect(editor).toHaveCount(0);
    await expect(event).toBeFocused();
    await page.reload();
    await event.click();
    await expect(fixed).toBeChecked({ checked: !previous });
  });

  test("Planungszentrale: Ungespeicherte Eingaben bleiben beim Termin- und Seitenwechsel erhalten", async ({
    page,
  }) => {
    await page.goto("/");
    const first = page
      .locator(".calendar-event")
      .filter({ hasText: "Mathematik I" })
      .first();
    await first.click();
    const editor = page.getByRole("region", {
      name: "Termin bearbeiten",
      exact: true,
    });
    await editor
      .getByLabel("Name", { exact: true })
      .fill("Nicht gespeicherter Termin");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .locator(".calendar-event")
      .filter({ hasText: "Programmierung" })
      .first()
      .click();
    await expect(editor.getByLabel("Name", { exact: true })).toHaveValue(
      "Nicht gespeicherter Termin",
    );
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Räume", exact: true })
      .click();
    await expect(editor).toBeVisible();
    const saved = await page.evaluate(() =>
      localStorage.getItem("campustime-browser-demo-v1"),
    );
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .getByRole("button", { name: "Demo zurücksetzen", exact: true })
      .click();
    await expect(editor.getByLabel("Name", { exact: true })).toHaveValue(
      "Nicht gespeicherter Termin",
    );
    expect(
      await page.evaluate(() =>
        localStorage.getItem("campustime-browser-demo-v1"),
      ),
    ).toEqual(saved);
    page.once("dialog", (dialog) => dialog.accept());
    await editor
      .getByRole("button", { name: "Abbrechen", exact: true })
      .click();
    await expect(editor).toHaveCount(0);
    await first.click();
    await expect(editor.getByLabel("Name", { exact: true })).not.toHaveValue(
      "Nicht gespeicherter Termin",
    );
    await page.keyboard.press("Escape");
    await expect(editor).toHaveCount(0);
    await expect(first).toBeFocused();
  });

  test("Planungszentrale: Neuer Termin wird validiert, gespeichert und wieder geladen", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Termin", exact: true }).click();
    const editor = page.getByRole("region", {
      name: "Termin hinzufügen",
      exact: true,
    });
    await expect(editor).toBeVisible();
    const before = await page.evaluate(() =>
      localStorage.getItem("campustime-browser-demo-v1"),
    );
    await editor.getByLabel("Beginn").fill("");
    await editor
      .getByRole("button", { name: "Speichern", exact: true })
      .click();
    await expect(editor).toBeVisible();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("campustime-browser-demo-v1"),
      ),
    ).toEqual(before);
    const end = await editor.getByLabel("Ende").inputValue();
    const date = end.split("T")[0];
    await editor.getByLabel("Beginn").fill(`${date}T16:00`);
    await editor.getByLabel("Ende").fill(`${date}T15:00`);
    await editor
      .getByLabel("Name", { exact: true })
      .fill("Planungszentrale Testtermin");
    await editor
      .getByRole("combobox", { name: "Veranstaltungen", exact: true })
      .selectOption({ label: "Mathematik I" });
    await editor
      .getByRole("combobox", { name: "Räume", exact: true })
      .selectOption({ label: "Hörsaal H.101" });
    await editor
      .getByRole("button", { name: "Speichern", exact: true })
      .click();
    await expect(editor.getByRole("alert")).toContainText(
      "Ende muss nach Beginn liegen",
    );
    await editor.getByLabel("Beginn").fill(`${date}T15:00`);
    await editor.getByLabel("Ende").fill(`${date}T16:30`);
    await editor
      .getByRole("button", { name: "Speichern", exact: true })
      .click();
    await expect(editor).toHaveCount(0);
    await expect(
      page
        .locator(".calendar-event")
        .filter({ hasText: "Planungszentrale Testtermin" }),
    ).toHaveCount(1);
    await page.reload();
    await expect(
      page
        .locator(".calendar-event")
        .filter({ hasText: "Planungszentrale Testtermin" }),
    ).toHaveCount(1);
  });

  test("Planungszentrale: Mobile Bearbeitung bleibt ohne Seitenüberlauf erreichbar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page
      .locator(".calendar-event")
      .filter({ hasText: "Mathematik I" })
      .first()
      .click();
    const editor = page.getByRole("region", {
      name: "Termin bearbeiten",
      exact: true,
    });
    await expect(editor.getByRole("heading")).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await expect(editor.getByLabel("Beginn")).toBeVisible();
    await page.clock.runFor(60000);
    await expect(editor.getByLabel("Beginn")).toBeInViewport();
    await editor
      .getByRole("button", { name: "Abbrechen", exact: true })
      .click();
    await expect(editor).toHaveCount(0);
    await expect(page.locator(".calendar-event")).toHaveCount(10);
  });
});
