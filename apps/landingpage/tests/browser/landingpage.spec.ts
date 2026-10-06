import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("product benefits and honest demo link are present", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Ein Stundenplan, der alles zusammenbringt.",
  );
  const demo = page.getByRole("link", { name: "Browser-Demo öffnen" }).first();
  await expect(demo).toHaveAttribute(
    "href",
    "https://campustime-flame.vercel.app",
  );
  await expect(
    page
      .getByText("Die Browser-Demo verwendet fiktive Testdaten.", {
        exact: false,
      })
      .first(),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
});

test("product view selector exposes meaningful room and exam examples", async ({
  page,
}) => {
  await page.goto("/#produkt");
  const preview = page.getByRole("region", { name: "Produktvorschau" });
  await preview.getByRole("button", { name: "Räume", exact: true }).click();
  await expect(preview.getByText("Seminarraum A.204")).toBeVisible();
  await preview.getByRole("button", { name: "Prüfungen", exact: true }).click();
  await expect(preview.getByText("Statistik · Klausur")).toBeVisible();
  await preview
    .getByRole("button", { name: "Stundenplan", exact: true })
    .click();
  await expect(preview.getByText("Wochenplanung")).toBeVisible();
});

test("mobile navigation supports Escape, focus return and closes after navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Menü öffnen" });
  await menu.click();
  await expect(
    page.getByRole("button", { name: "Menü schließen" }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await menu.click();
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("link", { name: "Ablauf", exact: true })
    .click();
  await expect(page).toHaveURL(/#ablauf$/);
  await expect(menu).toHaveAttribute("aria-expanded", "false");
});

test("FAQ can be opened with the keyboard and does not overpromise backend functions", async ({
  page,
}) => {
  await page.goto("/#fragen");
  const question = page.getByText(
    "Was kann ich in der Browser-Demo ausprobieren?",
    { exact: true },
  );
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(
      "Automatische Planung und Dateiimporte benötigen das Backend.",
      { exact: false },
    ),
  ).toBeVisible();
});

test("legal drafts, contact fallback and unknown routes are honest and reachable", async ({
  page,
}) => {
  await page.goto("/#kontakt");
  await expect(
    page.getByText("Der persönliche Kontaktweg wird gerade eingerichtet.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
  await page.getByRole("link", { name: "Impressum", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Impressum");
  await expect(
    page.getByText("Noch nicht zur Veröffentlichung freigegeben.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/datenschutz/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Datenschutz",
  );
  await page.goto("/diese-seite-gibt-es-nicht");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Hier geht es nicht weiter.",
  );
});

test("complete content and FAQ remain usable without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4180/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Ein Stundenplan",
  );
  await page
    .getByText("Was kann ich in der Browser-Demo ausprobieren?", {
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      "Automatische Planung und Dateiimporte benötigen das Backend.",
      { exact: false },
    ),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("link", { name: "Ablauf", exact: true })
    .click();
  const heading = await page.locator("#workflow-title").boundingBox();
  const header = await page.locator(".site-header").boundingBox();
  expect(heading!.y).toBeGreaterThanOrEqual(
    Math.max(0, header!.y + header!.height),
  );
  await context.close();
});

test("mobile, tablet and desktop fit the viewport and meet accessibility checks", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
  }
});
