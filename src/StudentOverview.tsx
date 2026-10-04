import { useEffect, useState, type ReactNode } from "react";
import { DateTime } from "luxon";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  GraduationCap,
  MapPin,
  Users,
} from "lucide-react";
import { api, DEMO_MODE, fmt, type Row } from "./api";
import Timetable from "./Timetable";

function initialSelection() {
  const query = new URLSearchParams(window.location.search);
  const date = DateTime.fromISO(query.get("week") || "");
  return {
    week: (date.isValid ? date : DateTime.now()).startOf("week").toISODate()!,
    cohort: query.get("cohort") || "",
    group: query.get("group") || "",
    course: query.get("course") || "",
  };
}

export default function StudentOverview({
  token,
  brand,
  notice,
}: {
  token: string;
  brand: ReactNode;
  notice: ReactNode;
}) {
  const [selection, setSelection] = useState(initialSelection);
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const zone = data?.timezone || "Europe/Berlin";
  const queryKey = JSON.stringify(selection);
  useEffect(() => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(selection))
      if (value) query.set(key, value);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${query}`,
    );
    setCopied(false);
    setCopyError("");
  }, [queryKey]);
  useEffect(() => {
    const onBack = () => setSelection(initialSelection());
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);
  useEffect(() => {
    let active = true;
    async function load() {
      const start = DateTime.fromISO(selection.week, { zone }).startOf("week");
      const query = new URLSearchParams({
        since: start.toISO()!,
        until: start.plus({ weeks: 1 }).toISO()!,
      });
      for (const key of ["cohort", "group", "course"] as const)
        if (selection[key]) query.set(key, selection[key]);
      try {
        const result = await api(`public/${token}/overview/?${query}`);
        if (!active) return;
        setData(result);
        setLoadedKey(queryKey);
        setError("");
      } catch (err) {
        if (active) setError((err as Error).message);
      }
    }
    load();
    const timer = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token, queryKey, zone]);

  const catalog = data?.catalog || { cohorts: [], groups: [], courses: [] };
  const groups = catalog.groups.filter(
    (group: Row) =>
      !selection.cohort || String(group.cohort) === selection.cohort,
  );
  const courses = catalog.courses.filter(
    (course: Row) =>
      (!selection.cohort ||
        course.cohort_ids.map(String).includes(selection.cohort)) &&
      (!selection.group ||
        course.group_ids.map(String).includes(selection.group)),
  );
  const ready = loadedKey === queryKey;
  const rows: Row[] = ready ? data?.rows || [] : [];
  const days = [
    ...new Set(
      rows.map((row) => DateTime.fromISO(row.start, { zone }).toISODate()!),
    ),
  ].sort();
  const start = DateTime.fromISO(selection.week, { zone });
  function moveWeek(amount: number) {
    setSelection((value) => ({
      ...value,
      week: start.plus({ weeks: amount }).toISODate()!,
    }));
  }

  return (
    <main className="public-display student-overview">
      {notice}
      <header>
        {brand}
        <div>
          <h1>Stundenplanübersicht</h1>
          <p>
            {data
              ? `${data.institution} · ${data.name}`
              : "Freigegebene Stundenpläne"}
          </p>
        </div>
        <div className="public-status">
          <span className={error ? "status-dot error-dot" : "status-dot"} />
          {error
            ? "Aktualisierung fehlgeschlagen"
            : DEMO_MODE
              ? "Demodaten im Browser"
              : "Live aktualisiert"}
          <small>
            Stand{" "}
            {data?.updated
              ? fmt(data.updated, zone, "dd.MM. HH:mm")
              : "noch nicht veröffentlicht"}
          </small>
        </div>
      </header>
      <section className="student-filters" aria-label="Stundenplan filtern">
        <label>
          <span>Jahrgang</span>
          <select
            value={selection.cohort}
            aria-label="Jahrgang"
            onChange={(event) =>
              setSelection((value) => ({
                ...value,
                cohort: event.target.value,
                group: "",
                course: "",
              }))
            }
          >
            <option value="">Alle Jahrgänge</option>
            {selection.cohort &&
              !catalog.cohorts.some(
                (item: Row) => String(item.id) === selection.cohort,
              ) && (
                <option value={selection.cohort}>
                  Jahrgang {selection.cohort}
                </option>
              )}
            {catalog.cohorts.map((item: Row) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Gruppe / Klasse</span>
          <select
            value={selection.group}
            aria-label="Gruppe / Klasse"
            onChange={(event) =>
              setSelection((value) => ({
                ...value,
                group: event.target.value,
                course: "",
              }))
            }
          >
            <option value="">Alle Gruppen / Klassen</option>
            {selection.group &&
              !groups.some(
                (item: Row) => String(item.id) === selection.group,
              ) && (
                <option value={selection.group}>
                  Gruppe {selection.group}
                </option>
              )}
            {groups.map((item: Row) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Kurs</span>
          <select
            value={selection.course}
            aria-label="Kurs"
            onChange={(event) =>
              setSelection((value) => ({
                ...value,
                course: event.target.value,
              }))
            }
          >
            <option value="">Alle Kurse und Prüfungen</option>
            {selection.course &&
              !courses.some((item: Row) => item.id === selection.course) && (
                <option value={selection.course}>Gewählter Kurs</option>
              )}
            {courses.map((item: Row) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.group_ids.length
                  ? ` · ${item.group_ids
                      .map(
                        (id: number) =>
                          catalog.groups.find((group: Row) => group.id === id)
                            ?.name,
                      )
                      .filter(Boolean)
                      .join(", ")}`
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button secondary"
          onClick={() =>
            setSelection((value) => ({
              ...value,
              cohort: "",
              group: "",
              course: "",
            }))
          }
        >
          Filter zurücksetzen
        </button>
      </section>
      <div className="public-toolbar">
        <div className="student-week">
          <div className="week-nav">
            <button aria-label="Vorherige Woche" onClick={() => moveWeek(-1)}>
              <ChevronLeft size={18} />
            </button>
            <strong>
              {start.setLocale("de").toFormat("dd. MMM")} –{" "}
              {start.plus({ days: 6 }).setLocale("de").toFormat("dd. MMM yyyy")}
            </strong>
            <button aria-label="Nächste Woche" onClick={() => moveWeek(1)}>
              <ChevronRight size={18} />
            </button>
          </div>
          <label>
            <span>Woche auswählen</span>
            <input
              type="date"
              value={selection.week}
              onChange={(event) => {
                const date = DateTime.fromISO(event.target.value, { zone });
                if (date.isValid)
                  setSelection((value) => ({
                    ...value,
                    week: date.startOf("week").toISODate()!,
                  }));
              }}
            />
          </label>
        </div>
        <button
          className="button secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
            } catch {
              setCopyError(
                "Link konnte nicht kopiert werden. Kopiere die Adresse aus der Adressleiste.",
              );
            }
          }}
        >
          <Copy size={16} />
          {copied ? "Link kopiert" : "Link zur Auswahl kopieren"}
        </button>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
          {ready && " Angezeigt wird der zuletzt geladene Stand."}
        </div>
      )}
      {copyError && (
        <div className="error-box" role="alert">
          {copyError}
        </div>
      )}
      <p className="student-result" role="status">
        {ready
          ? `${rows.length} ${rows.length === 1 ? "Termin" : "Termine"} in dieser Woche`
          : error
            ? "Übersicht konnte nicht geladen werden."
            : "Termine werden geladen …"}
      </p>
      {ready && rows.length === 0 && (
        <div className="display-empty">
          Für diese Auswahl sind in dieser Woche keine veröffentlichten Termine
          vorhanden.
          {data?.available_from &&
            DateTime.fromISO(data.available_from, { zone })
              .startOf("week")
              .toISODate() !== selection.week && (
              <button
                className="button secondary"
                onClick={() =>
                  setSelection((value) => ({
                    ...value,
                    week: DateTime.fromISO(data!.available_from, { zone })
                      .startOf("week")
                      .toISODate()!,
                  }))
                }
              >
                Erste geplante Woche öffnen
              </button>
            )}
        </div>
      )}
      {ready && rows.length > 0 && (
        <>
          <div className="public-calendar student-grid">
            <Timetable
              rows={rows}
              week={selection.week}
              zone={zone}
              publicMode
              weekdays={data!.weekdays}
              dayStart={data!.day_start}
              dayEnd={data!.day_end}
            />
          </div>
          <section className="student-agenda" aria-label="Termine dieser Woche">
            {days.map((day) => (
              <section key={day}>
                <h2>
                  {DateTime.fromISO(day, { zone })
                    .setLocale("de")
                    .toFormat("cccc, dd. MMMM")}
                </h2>
                {rows
                  .filter(
                    (row) =>
                      DateTime.fromISO(row.start, { zone }).toISODate() === day,
                  )
                  .sort((a, b) => a.start.localeCompare(b.start))
                  .map((row, index) => (
                    <article
                      className={`student-event ${row.blocked ? "blocked" : ""}`}
                      key={`${row.course_key}-${row.start}-${index}`}
                    >
                      <div className="student-event-time">
                        {fmt(row.start, zone)} – {fmt(row.end, zone)}
                        {row.kind === "exam" && (
                          <span className="badge">
                            {row.resit ? "Nachschreibeklausur" : "Prüfung"}
                          </span>
                        )}
                      </div>
                      <h3>{row.name}</h3>
                      <p>
                        <Users size={14} />
                        {row.group_names?.join(" & ") || "Teilnehmerauswahl"}
                      </p>
                      <p>
                        <MapPin size={14} />
                        {row.room_names?.join(", ")}
                      </p>
                      {!!row.teacher_names?.length && (
                        <p>
                          <GraduationCap size={14} />
                          {row.teacher_names.join(", ")}
                        </p>
                      )}
                      {row.blocked && (
                        <strong className="blocked-label">
                          Raum gesperrt · Änderung ausstehend
                        </strong>
                      )}
                    </article>
                  ))}
              </section>
            ))}
          </section>
        </>
      )}
      <footer>
        <span>
          {DEMO_MODE
            ? "Diese Übersicht verwendet die Demodaten dieses Browsers."
            : "Änderungen erscheinen nach Freigabe automatisch."}
        </span>
      </footer>
    </main>
  );
}
