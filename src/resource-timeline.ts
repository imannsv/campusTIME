import { DateTime } from "luxon";
import type { Row } from "./api";

export type Segment = {
  row: Row;
  day: string;
  start: number;
  end: number;
  lane: number;
};

/** Clip at local midnights, including DST days, then keep overlaps in separate lanes. */
export function resourceSegments(
  rows: Row[],
  resourceId: number,
  kind: "teachers" | "rooms",
  days: string[],
  zone: string,
): Segment[] {
  const field = kind === "teachers" ? "teacher_ids" : "room_ids";
  return days.flatMap((day) => {
    const midnight = DateTime.fromISO(day, { zone }).startOf("day");
    const next = midnight.plus({ days: 1 });
    const segments: Segment[] = rows
      .filter((row) => row[field]?.includes(resourceId))
      .flatMap((row) => {
        const start = DateTime.fromISO(row.start).setZone(zone);
        const end = DateTime.fromISO(row.end).setZone(zone);
        if (
          !start.isValid ||
          !end.isValid ||
          start >= next ||
          end <= midnight ||
          end <= start
        )
          return [];
        const from = start < midnight ? midnight : start;
        const to = end >= next ? next : end;
        return [
          {
            row,
            day,
            start: from.diff(midnight, "minutes").minutes,
            end: to.diff(midnight, "minutes").minutes,
            lane: 0,
          },
        ];
      })
      .sort((a, b) => a.start - b.start || b.end - a.end);
    const ends: number[] = [];
    for (const segment of segments) {
      let lane = ends.findIndex((end) => end <= segment.start);
      if (lane < 0) lane = ends.length;
      segment.lane = lane;
      ends[lane] = segment.end;
    }
    return segments;
  });
}

export function timelineHours(rows: Row[], days: string[], zone: string) {
  const segments = resourceSegments(
    rows.map((row) => ({ ...row, room_ids: [0] })),
    0,
    "rooms",
    days,
    zone,
  );
  const clockMinutes = (segment: Segment, value: number) => {
    const midnight = DateTime.fromISO(segment.day, { zone }).startOf("day");
    const time = midnight.plus({ minutes: value });
    return time.toISODate() !== segment.day
      ? 1440
      : time.hour * 60 + time.minute;
  };
  return {
    start: Math.min(
      8,
      ...segments.map((segment) =>
        Math.floor(clockMinutes(segment, segment.start) / 60),
      ),
    ),
    end: Math.max(
      18,
      ...segments.map((segment) =>
        Math.ceil(clockMinutes(segment, segment.end) / 60),
      ),
    ),
  };
}

/** Real elapsed minutes keep both occurrences of the autumn 02:00 hour distinct. */
export function dayAxis(
  day: string,
  hours: { start: number; end: number },
  zone: string,
) {
  const midnight = DateTime.fromISO(day, { zone }).startOf("day");
  const from = midnight.set({ hour: hours.start });
  const to =
    hours.end === 24
      ? midnight.plus({ days: 1 })
      : midnight.set({ hour: hours.end });
  const start = from.diff(midnight, "minutes").minutes;
  const duration = to.diff(from, "minutes").minutes;
  return {
    start,
    duration,
    ticks: Array.from({ length: Math.ceil(duration / 60) }, (_, index) =>
      from.plus({ minutes: index * 60 }),
    ),
  };
}
