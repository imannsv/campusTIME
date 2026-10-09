import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { api, Row } from "./api";
import { Modal } from "./components";
import MiniCalendar from "./MiniCalendar";
import TeacherAvailabilityDialog from "./TeacherAvailabilityDialog";
import { dayAxis, resourceSegments, timelineHours } from "./resource-timeline";
import "./resource-overview.css";

type Props = {
  kind: "teachers" | "rooms";
  zone: string;
  data: Record<string, Row[]>;
  revision: number;
  query?: string;
  roomIds?: number[];
  onEdit: (resource: string, record?: Row, defaults?: Row) => void;
  onChanged?: () => void;
};
const statusLabels: Record<string, string> = {
  published: "Freigegeben",
  draft: "Entwurf",
  blocked: "Blockiert",
};
const fmt = (value: string, zone: string, format = "HH:mm") =>
  DateTime.fromISO(value, { zone })
    .setZone(zone)
    .setLocale("de")
    .toFormat(format);

export default function ResourceOverview({
  kind,
  zone,
  data,
  revision,
  query = "",
  roomIds,
  onEdit,
  onChanged,
}: Props) {
  const [date, setDate] = useState(() =>
    DateTime.now().setZone(zone).toISODate()!,
  );
  const [mode, setMode] = useState<"week" | "day">(
    kind === "teachers" ? "week" : "day",
  );
  const [source, setSource] = useState("planning");
  const [search, setSearch] = useState("");
  const [onlyOccupied, setOnlyOccupied] = useState(false);
  const [result, setResult] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<Row | null>(null);
  const [teacherEditor, setTeacherEditor] = useState<{
    teacher: Row;
    mode: "availability" | "block";
  } | null>(null);
  const [notice, setNotice] = useState("");
  const closeTeacherEditor = useCallback(() => setTeacherEditor(null), []);
  const [openingEditor, setOpeningEditor] = useState(false);
  const editorRequest = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const focusedRange = useRef("");
  const [availableWidth, setAvailableWidth] = useState(800);
  const [now, setNow] = useState(() => DateTime.now().setZone(zone));
  const anchor = DateTime.fromISO(date, { zone });
  const start = (
    mode === "week" ? anchor.startOf("week") : anchor
  ).toISODate()!;
  const end = DateTime.fromISO(start, { zone })
    .plus({ days: mode === "week" ? 6 : 0 })
    .toISODate()!;
  const days = useMemo(
    () =>
      Array.from({ length: mode === "week" ? 7 : 1 }, (_, index) =>
        DateTime.fromISO(start, { zone }).plus({ days: index }).toISODate()!,
      ),
    [start, zone, mode],
  );
  useEffect(() => {
    setDate(DateTime.now().setZone(zone).toISODate()!);
  }, [zone]);
  useEffect(() => {
    let previousDay = DateTime.now().setZone(zone).toISODate()!;
    const update = () => {
      const current = DateTime.now().setZone(zone);
      const currentDay = current.toISODate()!;
      if (currentDay !== previousDay) {
        const prior = previousDay;
        setDate((value) => (value === prior ? currentDay : value));
        previousDay = currentDay;
      }
      setReload((value) => value + 1);
      setNow(current);
    };
    const timer = window.setInterval(update, 30000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, [zone]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api(
      `resource-occupancy/?start=${start}&end=${end}&source=${source}`,
      "GET",
      undefined,
      { signal: controller.signal },
    )
      .then((response) => {
        if (!controller.signal.aborted) setResult(response);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [start, end, source, revision, reload]);
  const currentResult =
    result?.start === start && result?.end === end && result?.source === source
      ? result
      : null;
  const rows: Row[] = currentResult?.rows || [];
  const resources: Row[] = (currentResult?.[kind] || [])
    .filter(
      (resource: Row) =>
        (kind !== "rooms" || !roomIds || roomIds.includes(resource.id)) &&
        `${resource.name} ${resource.code} ${(resource.equipment || []).join(" ")}`
          .toLocaleLowerCase("de")
          .includes(search.trim().toLocaleLowerCase("de")) &&
        `${resource.name} ${resource.code}`
          .toLocaleLowerCase("de")
          .includes(query.trim().toLocaleLowerCase("de")),
    )
    .sort((a: Row, b: Row) =>
      a.name.localeCompare(b.name, "de", { numeric: true }),
    );
  const displayed = resources
    .map((resource) => ({
      resource,
      segments: resourceSegments(rows, resource.id, kind, days, zone),
    }))
    .filter((item) => !onlyOccupied || item.segments.length);
  const visibleRows = rows.filter((row) =>
    (kind === "teachers" ? row.teacher_ids : row.room_ids)?.some((id: number) =>
      resources.some((resource) => resource.id === id),
    ),
  );
  const hours = timelineHours(visibleRows, days, zone);
  const axes = Object.fromEntries(
    days.map((day) => [day, dayAxis(day, hours, zone)]),
  );
  const axisWidth = Math.max(
    800,
    ...days.map((day) => (axes[day].duration / 60) * 80),
  );
  const dayWidth =
    mode === "week" ? axisWidth : Math.max(availableWidth, axisWidth);
  const timelineWidth = days.length * dayWidth;
  const today = now.toISODate()!;
  const preset = (offset: number, nextMode: "week" | "day") => {
    setMode(nextMode);
    setDate(DateTime.now().setZone(zone).plus({ days: offset }).toISODate()!);
  };
  const move = (offset: number) =>
    setDate(
      anchor.plus({ days: offset * (mode === "week" ? 7 : 1) }).toISODate()!,
    );
  const dateLabel =
    mode === "week"
      ? `${fmt(start, zone, "dd. MMM")} – ${fmt(end, zone, "dd. MMM yyyy")}`
      : fmt(date, zone, "cccc, dd. MMM yyyy");
  const close = useCallback(() => {
    editorRequest.current?.abort();
    setOpeningEditor(false);
    setSelected(null);
  }, []);
  useEffect(() => close(), [start, end, source, close]);
  useEffect(() => () => editorRequest.current?.abort(), []);
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const label =
        parseFloat(
          getComputedStyle(element).getPropertyValue("--resource-label-width"),
        ) || 200;
      setAvailableWidth(Math.max(0, element.clientWidth - label));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [!!currentResult, !!displayed.length, !!error]);
  useEffect(() => {
    if (!currentResult || !scroller.current) return;
    const key = `${date}:${mode}:${source}`;
    if (focusedRange.current === key) return;
    focusedRange.current = key;
    scroller.current.scrollLeft =
      mode === "week" ? Math.max(0, days.indexOf(date)) * dayWidth : 0;
  }, [date, mode, source, !!currentResult, days, dayWidth]);
  return (
    <section
      className={`resource-overview ${mode === "week" ? "resource-week" : "resource-day"}`}
      aria-label={kind === "teachers" ? "Lehrendenübersicht" : "Raumbelegung"}
    >
      <div className="resource-overview-title">
        <h1>{kind === "teachers" ? "Lehrendenübersicht" : "Raumbelegung"}</h1>
        <span>
          {mode === "week" ? "Woche" : "Tag"} ·{" "}
          {source === "planning" ? "Aktuelle Planung" : "Veröffentlichte Pläne"}
        </span>
      </div>
      <div className="resource-overview-card">
        {notice && (
          <p className="resource-empty" role="status">
            {notice}
          </p>
        )}
        <div className="resource-period-controls">
          <div role="group" aria-label="Zeitraum" className="resource-presets">
            {kind === "teachers" && (
              <button
                aria-pressed={
                  mode === "week" &&
                  start ===
                    DateTime.now().setZone(zone).startOf("week").toISODate()
                }
                onClick={() => preset(0, "week")}
              >
                Diese Woche
              </button>
            )}
            <button
              aria-pressed={mode === "day" && date === today}
              onClick={() => preset(0, "day")}
            >
              Heute
            </button>
            {kind === "teachers" && (
              <button
                aria-pressed={
                  mode === "day" && date === now.plus({ days: 1 }).toISODate()
                }
                onClick={() => preset(1, "day")}
              >
                Morgen
              </button>
            )}
          </div>
          <div className="resource-date-controls">
            <button
              className="icon-button"
              aria-label={
                mode === "week" ? "Vorherige Woche" : "Vorheriger Tag"
              }
              onClick={() => move(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <MiniCalendar value={date} zone={zone} onChange={setDate} />
            <button
              className="icon-button"
              aria-label={mode === "week" ? "Nächste Woche" : "Nächster Tag"}
              onClick={() => move(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          {kind === "teachers" && (
            <label className="resource-mode-label">
              Ansicht
              <select
                aria-label="Ansicht"
                value={mode}
                onChange={(event) =>
                  setMode(event.target.value as "week" | "day")
                }
              >
                <option value="week">Woche</option>
                <option value="day">Tag</option>
              </select>
            </label>
          )}
        </div>
        <div className="resource-overview-filters">
          <label className="resource-find">
            <Search size={17} />
            <input
              type="search"
              aria-label={
                kind === "teachers"
                  ? "Lehrende suchen"
                  : "Belegung: Raum suchen"
              }
              placeholder={
                kind === "teachers" ? "Lehrende suchen" : "Raum suchen"
              }
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            Planungsstand
            <select
              aria-label="Planungsstand"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="planning">Aktuelle Planung</option>
              <option value="published">Nur freigegebene Pläne</option>
            </select>
          </label>
          <label className="resource-occupied">
            <input
              type="checkbox"
              checked={onlyOccupied}
              onChange={(event) => setOnlyOccupied(event.target.checked)}
            />
            Nur mit Belegung
          </label>
          <button
            className="icon-button"
            aria-label="Belegung aktualisieren"
            onClick={() => setReload((value) => value + 1)}
            disabled={loading}
          >
            <RefreshCw size={17} />
          </button>
        </div>
        <div className="resource-period-summary">
          <strong aria-live="polite">{dateLabel}</strong>
          <span>
            {displayed.length} {kind === "teachers" ? "Lehrende" : "Räume"}
          </span>
          <div className="resource-legend">
            {Object.entries(statusLabels).map(([status, label]) => (
              <span key={status} className={status}>
                {label}
              </span>
            ))}
          </div>
        </div>
        {error ? (
          <div className="error-box" role="alert">
            {error}
            <button
              className="text-button"
              onClick={() => setReload((value) => value + 1)}
            >
              Erneut versuchen
            </button>
          </div>
        ) : loading && !currentResult ? (
          <p className="resource-empty" role="status">
            Belegung laden …
          </p>
        ) : !displayed.length ? (
          <p className="resource-empty">
            {resources.length
              ? "Keine Belegung im gewählten Zeitraum."
              : kind === "teachers"
                ? "Keine Lehrenden gefunden."
                : "Keine Räume gefunden."}
          </p>
        ) : (
          <div
            className="resource-timeline-scroll"
            ref={scroller}
            tabIndex={0}
            aria-label="Belegungszeitleiste, horizontal scrollbar"
          >
            <div
              className="resource-timeline"
              role="table"
              aria-label={`${kind === "teachers" ? "Lehrendenbelegung" : "Raumbelegung"}: ${dateLabel}`}
              style={{
                width: `calc(var(--resource-label-width) + ${timelineWidth}px)`,
              }}
            >
              <div className="resource-timeline-heading" role="row">
                <div
                  className="resource-label resource-heading-label"
                  role="columnheader"
                >
                  {kind === "teachers" ? "Lehrende" : "Räume"}
                </div>
                <div className="resource-day-headings">
                  {days.map((day) => (
                    <div
                      className={`resource-day-header ${day === today ? "today" : ""}`}
                      key={day}
                      role="columnheader"
                      style={{ width: dayWidth }}
                    >
                      <strong>{fmt(day, zone, "ccc, dd. MMM")}</strong>
                      <div className="resource-hours">
                        {axes[day].ticks.map((time, index) => (
                          <span
                            key={index}
                            title={time.toFormat("HH:mm ZZZZ")}
                            style={{
                              left: `${((index * 60) / axes[day].duration) * 100}%`,
                            }}
                          >
                            {time.toFormat("HH:mm")}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {displayed.map(({ resource, segments }) => {
                const height = Math.max(
                  kind === "teachers" ? 152 : 84,
                  (Math.max(-1, ...segments.map((segment) => segment.lane)) +
                    1) *
                    (mode === "week" ? 88 : 68) +
                    16,
                );
                return (
                  <div
                    className="resource-timeline-row"
                    role="row"
                    key={resource.id}
                    style={{ minHeight: height }}
                  >
                    <div className="resource-label" role="rowheader">
                      <strong>{resource.name}</strong>
                      <small>
                        {kind === "rooms"
                          ? `${data.floors?.find((floor) => floor.id === resource.floor)?.name || "Stockwerk nicht erfasst"} · ${resource.capacity == null ? "Kapazität offen" : `${resource.capacity} Plätze`}`
                          : `${new Set(segments.map((segment) => `${segment.row.plan_id}:${segment.row.id}:${segment.row.start}`)).size} Termine`}
                      </small>
                      {kind === "teachers" && (
                        <>
                          <small>
                            {resource.availability?.unrestricted
                              ? "Uneingeschränkt verfügbar"
                              : "Zeitfenster"}
                          </small>
                          <div className="resource-teacher-actions">
                            <button
                              className="text-button"
                              aria-label={`${resource.name}: Verfügbarkeit bearbeiten`}
                              onClick={() =>
                                setTeacherEditor({
                                  teacher: resource,
                                  mode: "availability",
                                })
                              }
                            >
                              Verfügbarkeit
                            </button>
                            <button
                              className="text-button"
                              aria-label={`${resource.name}: Blockzeit hinzufügen`}
                              onClick={() =>
                                setTeacherEditor({
                                  teacher: resource,
                                  mode: "block",
                                })
                              }
                            >
                              + Blockzeit
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="resource-row-days">
                      {days.map((day) => (
                        <div
                          className={`resource-day-cell ${day === today ? "today" : ""}`}
                          key={day}
                          role="cell"
                          aria-label={`${resource.name}, ${fmt(day, zone, "cccc, dd. MMM")}`}
                          style={{
                            width: dayWidth,
                            backgroundSize: `${dayWidth / (axes[day].duration / 60)}px 100%`,
                          }}
                        >
                          {segments
                            .filter((segment) => segment.day === day)
                            .map((segment, index) => (
                              <button
                                key={`${segment.row.id}:${segment.row.start}:${index}`}
                                className={`resource-event ${segment.row.status} ${segment.row.kind === "exam" ? "exam" : ""} ${segment.row.cancelled ? "cancelled" : ""}`}
                                style={{
                                  left: `${((segment.start - axes[day].start) / axes[day].duration) * 100}%`,
                                  width: `calc(${((segment.end - segment.start) / axes[day].duration) * 100}% - 2px)`,
                                  top:
                                    8 +
                                    segment.lane * (mode === "week" ? 88 : 68),
                                }}
                                aria-label={`${resource.name}: ${segment.row.name}, ${fmt(segment.row.start, zone, "dd.MM. HH:mm")} bis ${fmt(segment.row.end, zone, "dd.MM. HH:mm")}, ${segment.row.cancelled ? "Abgesagt" : statusLabels[segment.row.status]}`}
                                title={`${segment.row.name}\n${fmt(segment.row.start, zone)}–${fmt(segment.row.end, zone)} · ${segment.row.room_names?.join(", ")}\n${statusLabels[segment.row.status]}`}
                                onClick={() => setSelected(segment.row)}
                              >
                                <span>
                                  {fmt(segment.row.start, zone)}–
                                  {fmt(segment.row.end, zone)}
                                </span>
                                <strong>
                                  {segment.row.cancelled && "Abgesagt · "}
                                  {segment.row.name}
                                </strong>
                                <small>
                                  {kind === "teachers"
                                    ? segment.row.room_names?.join(", ")
                                    : segment.row.teacher_names?.join(", ") ||
                                      statusLabels[segment.row.status]}
                                </small>
                              </button>
                            ))}
                          {day === today &&
                            now.hour * 60 + now.minute >= hours.start * 60 &&
                            now.hour * 60 + now.minute < hours.end * 60 && (
                              <div
                                className="resource-now-line"
                                aria-hidden="true"
                                style={{
                                  left: `${((now.diff(now.startOf("day"), "minutes").minutes - axes[day].start) / axes[day].duration) * 100}%`,
                                }}
                              />
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!loading && !error && displayed.length > 0 && !visibleRows.length && (
          <p className="resource-empty">
            Keine Belegung im gewählten Zeitraum.
          </p>
        )}
      </div>
      {teacherEditor && (
        <TeacherAvailabilityDialog
          teacher={teacherEditor.teacher}
          mode={teacherEditor.mode}
          date={date}
          zone={zone}
          onClose={closeTeacherEditor}
          onSaved={(message) => {
            setNotice(message);
            setReload((value) => value + 1);
            onChanged?.();
          }}
        />
      )}
      {selected && (
        <Modal
          title={
            selected.kind === "block"
              ? "Raumblockierung"
              : selected.kind === "teacher_block"
                ? "Lehrenden-Blockzeit"
                : "Termindetails"
          }
          subtitle={selected.plan_name || undefined}
          onClose={close}
        >
          <div className="resource-event-details">
            <h3>{selected.name}</h3>
            <span
              className={`badge ${selected.status === "published" ? "success" : ""}`}
            >
              {selected.cancelled ? "Abgesagt" : statusLabels[selected.status]}
            </span>
            <dl>
              <dt>Zeit</dt>
              <dd>
                {fmt(selected.start, zone, "dd.MM.yyyy HH:mm")} –{" "}
                {fmt(selected.end, zone, "dd.MM.yyyy HH:mm")}
              </dd>
              <dt>Räume</dt>
              <dd>{selected.room_names?.join(", ") || "Nicht zugeordnet"}</dd>
              <dt>Lehrende</dt>
              <dd>
                {selected.teacher_names?.join(", ") || "Nicht zugeordnet"}
              </dd>
              <dt>Gruppen</dt>
              <dd>
                {selected.group_names?.join(", ") || "Keine Gruppen zugeordnet"}
              </dd>
            </dl>
            <div className="resource-detail-actions">
              <button className="button secondary" onClick={close}>
                Schließen
              </button>
              {selected.kind !== "block" &&
                selected.kind !== "teacher_block" &&
                source === "planning" && (
                  <button
                    className="button primary"
                    disabled={openingEditor}
                    onClick={async () => {
                      const controller = new AbortController();
                      editorRequest.current = controller;
                      setOpeningEditor(true);
                      try {
                        const record = await api(
                          `sessions/${selected.id}/`,
                          "GET",
                          undefined,
                          { signal: controller.signal },
                        );
                        if (controller.signal.aborted) return;
                        close();
                        onEdit("sessions", record);
                      } catch (err) {
                        if (controller.signal.aborted) return;
                        setError((err as Error).message);
                        close();
                      }
                    }}
                  >
                    {openingEditor ? "Termin laden …" : "Termin bearbeiten"}
                  </button>
                )}
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
