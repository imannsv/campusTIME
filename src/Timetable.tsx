import { DateTime } from "luxon";
import {
  useEffect,
  useId,
  useState,
  useRef,
  type CSSProperties,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import { LockKeyhole, MapPin, Users, GraduationCap } from "lucide-react";
import { Row, fmt } from "./api";
import { layoutEvents } from "./timetable-layout";

const HOUR_HEIGHT = 76;
function previewPosition(rect: DOMRect): CSSProperties {
  const width = Math.min(320, window.innerWidth - 24);
  const below = window.innerHeight - rect.bottom >= 250;
  return {
    width,
    left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
    ...(below
      ? { top: rect.bottom + 8 }
      : { bottom: Math.max(12, window.innerHeight - rect.top + 8) }),
    maxHeight: below
      ? window.innerHeight - rect.bottom - 20
      : Math.max(160, rect.top - 20),
  };
}
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
  showNow = false,
  followNow = false,
  selectedId,
  compactColumns = false,
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
  showNow?: boolean;
  followNow?: boolean;
  selectedId?: number;
  compactColumns?: boolean;
}) {
  const table = useRef<HTMLDivElement>(null);
  const nowMarker = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (!showNow || publicMode) return;
    const update = () => setClock(Date.now());
    const timer = window.setInterval(update, 15000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, [showNow, publicMode]);
  const previewId = useId();
  const [preview, setPreview] = useState<{
    row: Row;
    style: CSSProperties;
    keyboard: boolean;
  } | null>(null);
  useEffect(() => {
    const dismiss = () => setPreview(null);
    const scroll = () =>
      setPreview((current) => {
        const focused = document.activeElement;
        if (
          current?.keyboard &&
          focused instanceof HTMLElement &&
          focused.matches(".calendar-event")
        )
          return {
            ...current,
            style: previewPosition(focused.getBoundingClientRect()),
          };
        return null;
      });
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("keydown", key);
    };
  }, []);
  useEffect(() => setPreview(null), [week, date, rows.length]);
  const showPreview = (
    row: Row,
    event: SyntheticEvent<HTMLButtonElement>,
    keyboard = false,
  ) => {
    if (publicMode) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPreview({
      row,
      keyboard,
      style: previewPosition(rect),
    });
  };
  const start = DateTime.fromISO(week, { zone }).startOf("week");
  const now = DateTime.fromMillis(clock, { zone });
  const currentWeek =
    showNow &&
    !publicMode &&
    start.toISODate() === now.startOf("week").toISODate();
  // Show the current time even before or after the institution's teaching hours.
  // This only extends the view, never the configured planning constraints.
  const viewStart = currentWeek ? Math.min(dayStart, now.hour) : dayStart;
  const viewEnd = currentWeek ? Math.max(dayEnd, now.hour + 1) : dayEnd;
  const nowPosition = (now.hour + now.minute / 60 - viewStart) * HOUR_HEIGHT;
  const minute = now.toFormat("yyyy-MM-dd HH:mm");
  useEffect(() => {
    if (!currentWeek || !followNow) return;
    const focusNow = () => {
      const marker = nowMarker.current;
      const scroller = table.current?.closest<HTMLElement>(".calendar-scroll");
      if (!marker || !scroller) return;
      const bounds = scroller.getBoundingClientRect();
      scroller.scrollTop +=
        marker.getBoundingClientRect().top -
        bounds.top -
        scroller.clientHeight * 0.45;
      if (table.current) {
        const day = table.current?.querySelector<HTMLElement>(
          ".calendar-heading .today",
        );
        if (day) {
          const rect = day.getBoundingClientRect();
          if (rect.left < bounds.left + 58 || rect.right > bounds.right) {
            scroller.scrollLeft +=
              rect.left -
              bounds.left -
              58 -
              Math.max(0, (scroller.clientWidth - 58 - rect.width) / 2);
          }
        }
      }
      const rect = marker.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        marker.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "instant",
        });
      }
    };
    const frame = requestAnimationFrame(focusNow);
    const scroller = table.current?.closest<HTMLElement>(".calendar-scroll");
    const observer = new ResizeObserver(focusNow);
    if (scroller) observer.observe(scroller);
    window.addEventListener("resize", focusNow);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", focusNow);
    };
  }, [currentWeek, followNow, minute, week, dayStart, dayEnd, rows.length]);
  const days = date
    ? [DateTime.fromISO(date, { zone })]
    : [...weekdays].sort((a, b) => a - b).map((i) => start.plus({ days: i }));
  if (currentWeek && !days.some((day) => day.toISODate() === now.toISODate())) {
    days.push(now.startOf("day"));
    days.sort((a, b) => a.toMillis() - b.toMillis());
  }
  const height = (viewEnd - viewStart) * HOUR_HEIGHT;
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
  const layouts = days.map((day) => layoutEvents(eventsOn(day)));
  // Give simultaneous events enough horizontal space. Only the calendar itself
  // scrolls on smaller screens, never the surrounding page or its actions.
  const dayWidths = layouts.map((events) =>
    Math.max(
      compactColumns ? 132 : 180,
      ...events.map((event) =>
        compactColumns && event.lanes === 1 ? 132 : event.lanes * 156,
      ),
    ),
  );
  const columns = agenda
    ? `58px repeat(${days.length}, minmax(0, 1fr))`
    : `58px ${dayWidths.map((width) => `minmax(${width}px, 1fr)`).join(" ")}`;
  return (
    <>
      <div
        ref={table}
        className={
          "timetable" +
          (date ? " single-day" : "") +
          (agenda ? " agenda" : "") +
          (showNow ? " with-current-time" : "")
        }
        style={
          agenda
            ? undefined
            : {
                minWidth: 58 + dayWidths.reduce((sum, width) => sum + width, 0),
              }
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
            {Array.from(
              { length: Math.ceil(viewEnd - viewStart) + 1 },
              (_, i) => (
                <span key={i} style={{ top: i * HOUR_HEIGHT }}>
                  {DateTime.fromObject({ hour: 0 })
                    .plus({ minutes: (viewStart + i) * 60 })
                    .toFormat("HH:mm")}
                </span>
              ),
            )}
          </div>
          {days.map((day, dayIndex) => {
            const placed = layouts[dayIndex];
            return (
              <div className="day-column" key={day.toISODate()}>
                {Array.from(
                  { length: Math.ceil(viewEnd - viewStart) },
                  (_, i) => (
                    <div
                      key={i}
                      className="hour-line"
                      style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                    />
                  ),
                )}
                {placed.map(({ row, lane, lanes, span }, i) => {
                  const s = DateTime.fromISO(row.start, { zone }),
                    e = DateTime.fromISO(row.end, { zone });
                  const top =
                      (s.hour + s.minute / 60 - viewStart) * HOUR_HEIGHT,
                    eventHeight = Math.max(
                      38,
                      (e.diff(s, "minutes").minutes / 60) * HOUR_HEIGHT - 5,
                    );
                  const compact = !agenda && eventHeight < 116;
                  const brief = !agenda && eventHeight < 190;
                  const details = [
                    row.name,
                    `${fmt(row.start, zone)} – ${fmt(row.end, zone)}`,
                    row.group_names?.join(" & "),
                    row.room_names?.join(", "),
                    row.teacher_names?.join(", "),
                    row.locked ? "Termin fixiert" : "",
                    row.blocked ? "Raum gesperrt · Änderung ausstehend" : "",
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <button
                      type="button"
                      key={row.id || `${row.start}-${i}`}
                      disabled={publicMode}
                      className={`calendar-event ${row.color || "blue"} ${compact ? "compact" : brief ? "brief" : ""} ${!agenda && eventHeight < 64 ? "tiny" : ""} ${row.blocked ? "blocked" : ""}`}
                      aria-label={details}
                      aria-pressed={
                        onSelect ? row.id === selectedId : undefined
                      }
                      aria-describedby={
                        preview?.row === row ? previewId : undefined
                      }
                      onMouseEnter={(event) => showPreview(row, event)}
                      onMouseLeave={() =>
                        setPreview((current) =>
                          current?.keyboard ? current : null,
                        )
                      }
                      onFocus={(event) => showPreview(row, event, true)}
                      onBlur={() => setPreview(null)}
                      onClick={() => {
                        setPreview(null);
                        onSelect?.(row);
                      }}
                      style={{
                        top,
                        height: eventHeight,
                        left: `calc(${(lane / lanes) * 100}% + 5px)`,
                        width: `calc(${(span / lanes) * 100}% - 10px)`,
                      }}
                    >
                      <div className="event-time">
                        <span>
                          {fmt(row.start, zone)} – {fmt(row.end, zone)}
                        </span>
                        {row.locked && <LockKeyhole size={11} />}
                      </div>
                      <strong>{row.name}</strong>
                      {(agenda || !compact) && (
                        <span className="event-group">
                          <Users size={12} />
                          <span>
                            {row.group_names?.join(" & ") ||
                              "Teilnehmerauswahl"}
                          </span>
                        </span>
                      )}
                      {(agenda || eventHeight >= 92) && (
                        <span className="event-room">
                          <MapPin size={12} />
                          <span>{row.room_names?.join(", ")}</span>
                        </span>
                      )}
                      {(agenda || !brief) && row.teacher_names?.length > 0 && (
                        <span className="event-teacher">
                          <GraduationCap size={12} />
                          <span>{row.teacher_names.join(", ")}</span>
                        </span>
                      )}
                      {row.blocked && !compact && (
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
          {currentWeek && !agenda && (
            <div
              ref={nowMarker}
              className="calendar-now-line"
              style={{ top: nowPosition }}
              aria-label={`Aktuelle Uhrzeit ${now.toFormat("HH:mm")}`}
            >
              <span>{now.toFormat("HH:mm")}</span>
            </div>
          )}
        </div>
      </div>
      {preview &&
        createPortal(
          <div
            id={previewId}
            role="tooltip"
            className="event-preview"
            style={preview.style}
          >
            <div className="event-preview-date">
              {DateTime.fromISO(preview.row.start, { zone })
                .setLocale("de")
                .toFormat("cccc, dd. MMMM")}
            </div>
            <strong>{preview.row.name}</strong>
            <div className="event-preview-time">
              {fmt(preview.row.start, zone)} – {fmt(preview.row.end, zone)}
              {preview.row.locked && (
                <span>
                  <LockKeyhole size={12} /> Fixiert
                </span>
              )}
            </div>
            <p>
              <Users size={14} />
              <span>
                {preview.row.group_names?.join(" & ") || "Teilnehmerauswahl"}
              </span>
            </p>
            <p>
              <MapPin size={14} />
              <span>
                {preview.row.room_names?.join(", ") ||
                  "Noch kein Raum zugeordnet"}
              </span>
            </p>
            {preview.row.teacher_names?.length > 0 && (
              <p>
                <GraduationCap size={14} />
                <span>{preview.row.teacher_names.join(", ")}</span>
              </p>
            )}
            {preview.row.blocked && (
              <p className="blocked-label">
                Raum gesperrt · Änderung ausstehend
              </p>
            )}
            {onSelect && (
              <div className="event-preview-hint">Anklicken zum Bearbeiten</div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
