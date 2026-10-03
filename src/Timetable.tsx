import { DateTime } from "luxon";
import { LockKeyhole, MapPin, Users, GraduationCap } from "lucide-react";
import { Row, fmt } from "./api";
export default function Timetable({
  rows,
  week,
  zone,
  onSelect,
  publicMode = false,
  dayStart = 8,
  dayEnd = 18,
  weekdays = [0, 1, 2, 3, 4],
  date,
}: {
  rows: Row[];
  week: string;
  zone: string;
  onSelect?: (row: Row) => void;
  publicMode?: boolean;
  dayStart?: number;
  dayEnd?: number;
  weekdays?: number[];
  date?: string;
}) {
  const start = DateTime.fromISO(week, { zone }).startOf("week");
  const days = date
    ? [DateTime.fromISO(date, { zone })]
    : [...weekdays].sort((a, b) => a - b).map((i) => start.plus({ days: i }));
  const columns = `58px repeat(${days.length}, minmax(0, 1fr))`;
  const height = (dayEnd - dayStart) * 76;
  const eventsOn = (day: DateTime) =>
    rows.filter(
      (r) =>
        DateTime.fromISO(r.start, { zone }).toISODate() === day.toISODate(),
    );
  // Large public overviews need readable cards even when many groups run in parallel.
  const agenda =
    publicMode &&
    (Boolean(date) ||
      days.some((day) => {
        const edges = eventsOn(day)
          .flatMap((r) => [
            [DateTime.fromISO(r.start).toMillis(), 1],
            [DateTime.fromISO(r.end).toMillis(), -1],
          ])
          .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        let active = 0;
        return edges.some(([, change]) => (active += change) > 3);
      }));
  return (
    <div
      className={
        "timetable" + (date ? " single-day" : "") + (agenda ? " agenda" : "")
      }
    >
      <div
        className="calendar-heading"
        style={{ gridTemplateColumns: columns }}
      >
        <div className="time-label">{agenda ? "Termine" : "Zeit"}</div>
        {days.map((day) => (
          <div
            key={day.toISODate()}
            className={
              day.toISODate() === DateTime.now().setZone(zone).toISODate()
                ? "today"
                : ""
            }
          >
            <span>{day.setLocale("de").toFormat("cccc")}</span>
            <strong>{day.toFormat("dd")}</strong>
            {day.toISODate() === DateTime.now().setZone(zone).toISODate() && (
              <i />
            )}
          </div>
        ))}
      </div>
      <div
        className="calendar-body"
        style={{ height, gridTemplateColumns: columns }}
      >
        <div className="time-axis">
          {Array.from({ length: Math.ceil(dayEnd - dayStart) + 1 }, (_, i) => (
            <span key={i} style={{ top: i * 76 }}>
              {DateTime.fromObject({ hour: 0 })
                .plus({ minutes: (dayStart + i) * 60 })
                .toFormat("HH:mm")}
            </span>
          ))}
        </div>
        {days.map((day) => {
          const events = eventsOn(day).sort((a, b) =>
            a.start.localeCompare(b.start),
          );
          const placed: Row[] = [],
            ends: number[] = [];
          events.forEach((row) => {
            const s = DateTime.fromISO(row.start, { zone }).toMillis(),
              e = DateTime.fromISO(row.end, { zone }).toMillis();
            let lane = ends.findIndex((end) => end <= s);
            if (lane < 0) lane = ends.length;
            ends[lane] = e;
            placed.push({ ...row, lane });
          });
          const lanes = Math.max(1, ends.length);
          return (
            <div className="day-column" key={day.toISODate()}>
              {Array.from({ length: Math.ceil(dayEnd - dayStart) }, (_, i) => (
                <div key={i} className="hour-line" style={{ top: i * 76 }} />
              ))}
              {placed.map((row, i) => {
                const s = DateTime.fromISO(row.start, { zone }),
                  e = DateTime.fromISO(row.end, { zone });
                const top = (s.hour + s.minute / 60 - dayStart) * 76,
                  eventHeight = Math.max(
                    38,
                    (e.diff(s, "minutes").minutes / 60) * 76 - 5,
                  );
                return (
                  <button
                    key={row.id || `${row.start}-${i}`}
                    disabled={publicMode}
                    className={`calendar-event ${row.color || "blue"} ${row.blocked ? "blocked" : ""}`}
                    onClick={() => onSelect?.(row)}
                    style={{
                      top,
                      height: eventHeight,
                      left: `calc(${(row.lane / lanes) * 100}% + 5px)`,
                      width: `calc(${100 / lanes}% - 10px)`,
                    }}
                  >
                    <div className="event-time">
                      {fmt(row.start, zone)} – {fmt(row.end, zone)}
                      {row.locked && <LockKeyhole size={11} />}
                    </div>
                    <strong>{row.name}</strong>
                    <span className="event-group">
                      <Users size={12} />
                      {row.group_names?.join(" & ") || "Teilnehmerauswahl"}
                    </span>
                    <span className="event-room">
                      <MapPin size={12} />
                      {row.room_names?.join(", ")}
                    </span>
                    {(agenda || eventHeight > 98) &&
                      row.teacher_names?.length > 0 && (
                        <span className="event-teacher">
                          <GraduationCap size={12} />
                          {row.teacher_names.join(", ")}
                        </span>
                      )}
                    {row.blocked && (
                      <span className="blocked-label">
                        Raum gesperrt · Änderung ausstehend
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
