import { test, expect, Page } from "@playwright/test";
import {
  dayAxis,
  resourceSegments,
  timelineHours,
} from "../src/resource-timeline";

async function fixture(page: Page) {
  await page.clock.install({ time: new Date("2026-10-09T08:00:00Z") });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Lehrendenübersicht", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const key = "campustime-browser-demo-v1";
    const state = JSON.parse(localStorage.getItem(key)!);
    const teacher = state.data.people.find(
      (person: any) => person.kind === "teacher",
    );
    teacher.name = "Testlehrende Lange Namen";
    const second = state.data.people.find(
      (person: any) => person.kind === "teacher" && person.id !== teacher.id,
    );
    const room = state.data.rooms[0];
    room.name = "Testräumlichkeit mit langem Namen";
    const base = state.data.courses[0];
    state.data.courses = [
      base,
      ...[9001, 9002, 9003, 9004].map((id) => ({
        ...base,
        id,
        name: `Timeline ${id}`,
        teachers: [teacher.id, second.id],
      })),
    ];
    state.data.sessions = [
      {
        id: 9001,
        name: "Parallel A",
        course: 9001,
        start: "2026-10-09T09:00:00+02:00",
        end: "2026-10-09T11:00:00+02:00",
      },
      {
        id: 9002,
        name: "Parallel B mit sehr langem Veranstaltungstitel",
        course: 9002,
        start: "2026-10-09T10:00:00+02:00",
        end: "2026-10-09T12:00:00+02:00",
      },
      {
        id: 9003,
        name: "Samstagstermin",
        course: 9003,
        start: "2026-10-10T10:00:00+02:00",
        end: "2026-10-10T11:30:00+02:00",
      },
      {
        id: 9004,
        name: "Kurztermin",
        course: 9004,
        start: "2026-10-09T12:30:00+02:00",
        end: "2026-10-09T12:45:00+02:00",
      },
    ].map((row) => ({
      ...row,
      plan: base.plan,
      exam: null,
      rooms: [room.id],
      teachers: [],
      locked: false,
    }));
    state.data.blocks = [
      {
        id: 9001,
        code: "TESTBLOCK",
        name: "Bauarbeiten",
        rooms: [room.id],
        start: "2026-10-09T13:00:00+02:00",
        end: "2026-10-09T15:00:00+02:00",
        repeat_weekly: false,
        repeat_until: null,
      },
    ];
    state.publications = [
      {
        plan_id: base.plan,
        number: 1,
        created: "2026-10-09T08:00:00+02:00",
        snapshot: [
          {
            id: 9001,
            plan_id: base.plan,
            name: "Parallel A",
            course: 9001,
            exam: null,
            start: "2026-10-09T09:00:00+02:00",
            end: "2026-10-09T11:00:00+02:00",
            room_ids: [room.id],
            room_names: [room.name],
            teacher_ids: [teacher.id, second.id],
            teacher_names: [teacher.name, second.name],
            group_names: [],
            color: "blue",
          },
        ],
      },
    ];
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
}

test("Lehrendenübersicht: Woche, Heute, Morgen, Kalender und Termindetails", async ({
  page,
}) => {
  await fixture(page);
  await page
    .getByRole("button", { name: "Lehrendenübersicht", exact: true })
    .click();
  const overview = page.getByRole("region", {
    name: "Lehrendenübersicht",
    exact: true,
  });
  await expect(overview.locator(".resource-day-header")).toHaveCount(7);
  await expect(overview.locator(".resource-period-summary")).toContainText(
    "05. Okt",
  );
  await overview.getByRole("button", { name: "Heute", exact: true }).click();
  await expect(overview.locator(".resource-day-header")).toHaveCount(1);
  const teacherRow = overview
    .locator(".resource-timeline-row")
    .filter({ hasText: "Testlehrende Lange Namen" });
  await expect(teacherRow.locator(".resource-event")).toHaveCount(3);
  const topA = await teacherRow
    .locator(".resource-event")
    .filter({ hasText: "Parallel A" })
    .evaluate((el) => el.style.top);
  const topB = await teacherRow
    .locator(".resource-event")
    .filter({ hasText: "Parallel B" })
    .evaluate((el) => el.style.top);
  expect(topA).not.toBe(topB);
  await teacherRow.getByRole("button", { name: /Parallel B/ }).click();
  const popup = page.getByRole("dialog", {
    name: "Termindetails",
    exact: true,
  });
  await expect(popup).toContainText(
    "Parallel B mit sehr langem Veranstaltungstitel",
  );
  await expect(popup).toContainText("Testräumlichkeit mit langem Namen");
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(
    teacherRow.getByRole("button", { name: /Parallel B/ }),
  ).toBeFocused();
  await overview.getByRole("button", { name: "Morgen", exact: true }).click();
  await expect(overview.locator(".resource-period-summary")).toContainText(
    "10. Okt",
  );
  await expect(teacherRow.locator(".resource-event")).toHaveCount(1);
  await overview
    .getByRole("button", { name: "Datum auswählen", exact: true })
    .click();
  const calendar = page.getByRole("dialog", { name: "Kalender", exact: true });
  await calendar
    .getByRole("button", { name: "Mittwoch, 14. Oktober 2026", exact: true })
    .click();
  await expect(overview.locator(".resource-period-summary")).toContainText(
    "14. Okt",
  );
  await overview
    .getByRole("button", { name: "Diese Woche", exact: true })
    .click();
  await expect(overview.locator(".resource-day-header")).toHaveCount(7);
  await overview
    .getByLabel("Lehrende suchen", { exact: true })
    .fill("nicht existent");
  await expect(overview).toContainText("Keine Lehrenden gefunden.");
});

test("Raumbelegung bleibt eine Tagesansicht und zeigt Blockierungen und Freigaben", async ({
  page,
}) => {
  await fixture(page);
  await page.getByRole("button", { name: "Räume", exact: true }).click();
  await page.getByRole("button", { name: "Raumbelegung", exact: true }).click();
  const overview = page.getByRole("region", {
    name: "Raumbelegung",
    exact: true,
  });
  await expect(overview.locator(".resource-day-header")).toHaveCount(1);
  await expect(overview.locator(".resource-period-summary")).toContainText(
    "09. Okt",
  );
  await expect(
    overview.getByRole("button", { name: "Morgen", exact: true }),
  ).toHaveCount(0);
  await expect(
    overview.getByRole("button", { name: "Diese Woche", exact: true }),
  ).toHaveCount(0);
  await overview
    .getByLabel("Belegung: Raum suchen", { exact: true })
    .fill("Testräumlichkeit");
  await expect(overview.locator(".resource-timeline-row")).toHaveCount(1);
  await expect(overview.locator(".resource-event")).toHaveCount(4);
  const areas = page.getByRole("group", { name: "Bereiche", exact: true });
  if ((await areas.getByRole("button").count()) > 1) {
    await areas.getByRole("button").nth(1).click();
    await expect(overview).toBeVisible();
    await expect(overview.locator(".resource-period-summary")).toContainText(
      "09. Okt",
    );
    await areas.getByRole("button").first().click();
    await expect(overview.locator(".resource-event")).toHaveCount(4);
  }
  await overview.getByRole("button", { name: /Bauarbeiten/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Raumblockierung", exact: true }),
  ).toContainText("Blockiert");
  await page.keyboard.press("Escape");
  await overview
    .getByLabel("Planungsstand", { exact: true })
    .selectOption("published");
  await expect(overview.locator(".resource-event")).toHaveCount(2);
  await overview
    .getByRole("button", { name: "Datum auswählen", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Kalender", exact: true })
    .getByRole("button", { name: "Samstag, 10. Oktober 2026", exact: true })
    .click();
  await expect(overview.locator(".resource-day-header")).toHaveCount(1);
  await expect(overview).toContainText("Keine Belegung im gewählten Zeitraum.");
  await overview
    .getByLabel("Planungsstand", { exact: true })
    .selectOption("planning");
  await expect(overview.locator(".resource-event")).toHaveCount(1);
  await expect(overview.locator(".resource-event")).toContainText(
    "Samstagstermin",
  );
  await overview.getByRole("button", { name: "Heute", exact: true }).click();
  await expect(overview.locator(".resource-event")).toHaveCount(4);
});

test("Belegung: Kalender per Tastatur und schmale Ansichten ohne Seitenüberlauf", async ({
  page,
}) => {
  await fixture(page);
  await page
    .getByRole("button", { name: "Lehrendenübersicht", exact: true })
    .click();
  const overview = page.getByRole("region", {
    name: "Lehrendenübersicht",
    exact: true,
  });
  await overview.getByRole("button", { name: "Heute", exact: true }).click();
  await overview
    .getByRole("button", { name: "Datum auswählen", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Freitag, 09. Oktober 2026",
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", {
      name: "Samstag, 10. Oktober 2026",
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(overview.locator(".resource-period-summary")).toContainText(
    "10. Okt",
  );
  await expect(
    overview.getByRole("button", { name: "Datum auswählen", exact: true }),
  ).toBeFocused();
  await overview
    .getByRole("button", { name: "Datum auswählen", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Kalender", exact: true }),
  ).toHaveCount(0);
  for (const width of [390, 768, 1280, 1440, 1920, 720]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(overview).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width < 1000) {
      expect(
        await overview
          .locator(".resource-timeline-scroll")
          .evaluate((el) => el.scrollWidth > el.clientWidth),
      ).toBe(true);
    }
  }
});

test("Zeitleistenlayout: lokale Tage, kurze Termine und Überlappungen", () => {
  const rows = [
    {
      name: "Nacht",
      room_ids: [1],
      teacher_ids: [2, 3],
      start: "2026-10-24T23:00:00+02:00",
      end: "2026-10-25T04:00:00+01:00",
    },
    {
      name: "Kurz",
      room_ids: [1],
      teacher_ids: [2],
      start: "2026-10-25T03:30:00+01:00",
      end: "2026-10-25T03:45:00+01:00",
    },
    {
      name: "Anschluss",
      room_ids: [1],
      teacher_ids: [2],
      start: "2026-10-25T04:00:00+01:00",
      end: "2026-10-25T05:00:00+01:00",
    },
  ];
  const segments = resourceSegments(
    rows,
    1,
    "rooms",
    ["2026-10-24", "2026-10-25"],
    "Europe/Berlin",
  );
  expect(segments.map(({ start, end, lane }) => [start, end, lane])).toEqual([
    [1380, 1440, 0],
    [0, 300, 0],
    [270, 285, 1],
    [300, 360, 0],
  ]);
  expect(
    resourceSegments(rows, 3, "teachers", ["2026-10-25"], "Europe/Berlin"),
  ).toHaveLength(1);
  expect(
    timelineHours(rows, ["2026-10-24", "2026-10-25"], "Europe/Berlin"),
  ).toEqual({ start: 0, end: 24 });
  const axis = dayAxis("2026-10-25", { start: 0, end: 24 }, "Europe/Berlin");
  expect(axis.duration).toBe(1500);
  expect(axis.ticks.slice(1, 5).map((time) => time.toFormat("HH:mm"))).toEqual([
    "01:00",
    "02:00",
    "02:00",
    "03:00",
  ]);
});
