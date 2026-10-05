import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutEvents } from "../src/timetable-layout.ts";

const event = (id: string, start: string, end: string) => ({
  id,
  start: `2026-10-05T${start}:00+02:00`,
  end: `2026-10-05T${end}:00+02:00`,
});

test("isolated exams keep full width despite parallel afternoon courses", () => {
  const placed = layoutEvents([
    event("exam", "08:00", "09:00"),
    event("a", "13:00", "16:00"),
    event("b", "13:00", "16:00"),
  ]);
  assert.equal(placed[0].lanes, 1);
  assert.equal(placed[1].lanes, 2);
  assert.equal(placed[2].lanes, 2);
  assert.notEqual(placed[1].lane, placed[2].lane);
});

test("back-to-back events do not count as overlaps", () => {
  const placed = layoutEvents([
    event("b", "09:00", "10:00"),
    event("a", "08:00", "09:00"),
  ]);
  assert.deepEqual(
    placed.map(({ row, lanes }) => [row.id, lanes]),
    [
      ["a", 1],
      ["b", 1],
    ],
  );
});

test("chained overlaps cannot share horizontal space while intersecting", () => {
  const placed = layoutEvents([
    event("a", "09:00", "12:00"),
    event("b", "09:30", "10:30"),
    event("c", "10:00", "11:00"),
    event("d", "11:00", "12:00"),
  ]);
  for (const a of placed)
    for (const b of placed) {
      if (
        a !== b &&
        Date.parse(a.row.start) < Date.parse(b.row.end) &&
        Date.parse(b.row.start) < Date.parse(a.row.end)
      )
        assert.ok(a.lane + a.span <= b.lane || b.lane + b.span <= a.lane);
    }
  assert.equal(placed.find(({ row }) => row.id === "d")?.span, 2);
});

test("empty day and separated overlap groups remain independent", () => {
  assert.deepEqual(layoutEvents([]), []);
  const placed = layoutEvents([
    event("a", "08:00", "09:00"),
    event("b", "08:00", "09:00"),
    event("c", "11:00", "12:00"),
    event("d", "11:00", "12:00"),
    event("e", "11:00", "12:00"),
    event("f", "16:00", "17:00"),
  ]);
  assert.deepEqual(
    placed.map(({ lanes }) => lanes),
    [2, 2, 3, 3, 3, 1],
  );
});
