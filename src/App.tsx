import { useEffect, useRef, useState, FormEvent } from "react";
import { DateTime } from "luxon";
import {
  CalendarDays,
  Layers,
  GraduationCap,
  Monitor,
  Settings,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Users,
  Building2,
  LogOut,
  Menu,
  Sparkles,
  Upload,
  AlertTriangle,
  LockKeyhole,
  LoaderCircle,
  Check,
  Pause,
  Play,
  RefreshCw,
  FileText,
  ExternalLink,
  ArrowRight,
  SlidersHorizontal,
  X,
  ClipboardList,
} from "lucide-react";
import { api, all, Row, Field, labels, fmt, DEMO_MODE } from "./api";
import { Modal, RecordForm, ImportModal, Relation } from "./components";
import Timetable from "./Timetable";
import RoomOverview from "./RoomOverview";
import StudySetup from "./StudySetup";

type SessionState = {
  authenticated: boolean;
  user: string;
  role: string;
  institution: Row;
  map_style: string;
};
const nav = [
  { id: "setup", label: "Einrichtung & Studienstruktur", icon: ClipboardList },
  { id: "schedule", label: "Stundenplanung", icon: CalendarDays },
  { id: "data", label: "Stammdaten", icon: Layers },
  { id: "exams", label: "Prüfungen", icon: GraduationCap },
  { id: "map", label: "Räume", icon: Building2 },
  { id: "displays", label: "Öffentliche Anzeige", icon: Monitor },
];
const descriptions: Record<string, string> = {
  areas: "Getrennt planen, gemeinsame Ressourcen berücksichtigen.",
  programs: "Die Grundlage für Lehrpläne und Jahrgänge.",
  cohorts: "Ein Jahrgang, mehrere Gruppen, ein gemeinsamer Überblick.",
  groups: "Klassen und Teilgruppen mit ihren Teilnehmerzahlen.",
  people: "Lernende, Lehrende und ihre Verfügbarkeiten.",
  periods: "Semester, Schuljahre und der Unterrichtskalender.",
  buildings: "Bereiche, Gebäude oder Trakte.",
  floors: "Stockwerke innerhalb eines Bereichs.",
  rooms: "Raumbezeichnungen, Kapazitäten und Ausstattung.",
  curricula: "Wiederverwendbare Vorgaben für den Unterrichtsumfang.",
  plans: "Planbereiche und Zeiträume zusammenführen.",
  courses: "Pflichtkurse, Wahlpflichtangebote und Lehrendenteams.",
  exams: "Klausuren und Nachschreiber ohne Überschneidungen.",
  blocks: "Räume für Projekte, Wartung oder Bauarbeiten reservieren.",
  displays: "Freigegebene Pläne automatisch auf Bildschirmen anzeigen.",
};
const compactResources = [
  "plans",
  "periods",
  "areas",
  "programs",
  "studyversions",
  "modules",
  "teachingunits",
  "cohorts",
  "groups",
  "buildings",
  "floors",
  "rooms",
  "displays",
  "curricula",
];

function Brand() {
  return (
    <div className="brand">
      <span className="brand-symbol">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>
        campuszeit<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
function DemoNotice() {
  const [error, setError] = useState("");
  if (!DEMO_MODE) return null;
  return (
    <div className="demo-notice" role="note">
      <p>
        <strong>Demo mit Beispieldaten</strong> · Änderungen bleiben in diesem
        Browser. Automatische Planung und Dateiimporte sind hier nicht
        verfügbar. Keine echten Personendaten eingeben.
      </p>
      <button
        onClick={async () => {
          try {
            (await import("./demo")).resetDemo();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        Demo zurücksetzen
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
function Login({ onLogin }: { onLogin: (s: SessionState) => void }) {
  const [user, setUser] = useState("verwaltung"),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(await api("auth/login/", "POST", { username: user, password }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-layout">
      <section className="login-story">
        <Brand />
        <div>
          <div className="login-preview">
            <div>
              <span>Montag</span>
              <strong>05. Oktober</strong>
            </div>
            <div className="preview-event">
              <small>08:30 – 10:00</small>
              <b>Mathematik I</b>
              <span>dWI25 A1 & A2 · Hörsaal H.101</span>
            </div>
            <div className="preview-event mint">
              <small>10:30 – 12:00</small>
              <b>Datenbanken</b>
              <span>dWI25 A1 · Labor H.103</span>
            </div>
          </div>
        </div>
      </section>
      <section className="login-form-area">
        <form onSubmit={submit}>
          <span className="login-icon">
            <LockKeyhole size={25} />
          </span>
          <h2>Anmelden</h2>
          <p>Melde dich mit deinem Verwaltungszugang an.</p>
          <label>
            Benutzername
            <input
              autoComplete="username"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              required
            />
          </label>
          <label>
            Passwort
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <ArrowRight size={18} />
            )}
            Anmelden
          </button>
          <small>Dein Zugang wird von der Einrichtung bereitgestellt.</small>
        </form>
      </section>
    </main>
  );
}

function PublicDisplay({ token }: { token: string }) {
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [paused, setPaused] = useState(false),
    [week, setWeek] = useState(DateTime.now().startOf("week").toISODate()!),
    [initial, setInitial] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const zone = data?.timezone || "Europe/Berlin";
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const start = DateTime.fromISO(week, { zone });
        const result = await api(
          `public/${token}/?since=${encodeURIComponent(start.toISO()!)}&until=${encodeURIComponent(start.plus({ weeks: 1 }).toISO()!)}`,
        );
        if (!active) return;
        setData(result);
        setError("");
        if (
          result.view_mode === "week" &&
          !initial &&
          !result.rows.length &&
          result.available_from
        )
          setWeek(
            DateTime.fromISO(result.available_from, { zone: result.timezone })
              .startOf("week")
              .toISODate()!,
          );
        if (
          !initial &&
          result.view_mode === "week" &&
          result.rows.length &&
          !result.rows.some((r: Row) =>
            DateTime.fromISO(r.start).hasSame(DateTime.now(), "week"),
          )
        ) {
          setWeek(
            DateTime.fromISO(result.rows[0].start, { zone: result.timezone })
              .startOf("week")
              .toISODate()!,
          );
        }
        setInitial(true);
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    }
    load();
    const timer = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token, initial, week, zone]);
  useEffect(() => {
    if (
      !data?.auto_scroll ||
      paused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let direction = 1;
    const timer = setInterval(() => {
      const el = scroll.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;
      el.scrollTop += direction * Math.max(1, max / (data.scroll_seconds * 20));
      if (el.scrollTop >= max - 1) direction = -1;
      if (el.scrollTop <= 0) direction = 1;
    }, 50);
    return () => clearInterval(timer);
  }, [data?.scroll_seconds, data?.auto_scroll, paused]);
  if (!data)
    return (
      <div className="loading-screen">{error || "Anzeige wird geladen …"}</div>
    );
  const day =
    data.view_mode === "week"
      ? undefined
      : DateTime.fromISO(data.window_start, { zone }).toISODate()!;
  return (
    <main className="public-display">
      <DemoNotice />
      <header>
        <Brand />
        <div>
          <h1>{data.name}</h1>
          <p>{data.institution}</p>
        </div>
        <div className="public-status">
          <span className={error ? "status-dot error-dot" : "status-dot"} />
          {error
            ? "Verbindung unterbrochen"
            : DEMO_MODE
              ? "Demodaten im Browser"
              : "Live aktualisiert"}
          <small>
            Stand{" "}
            {data.updated
              ? fmt(data.updated, data.timezone, "dd.MM. HH:mm")
              : "noch nicht veröffentlicht"}
          </small>
        </div>
      </header>
      {error && (
        <div className="error-box">Letzter geladener Stand. {error}</div>
      )}
      <div className="public-toolbar">
        <div className="week-nav">
          {data.view_mode === "week" && (
            <button
              aria-label="Vorherige Woche"
              onClick={() =>
                setWeek(DateTime.fromISO(week).minus({ weeks: 1 }).toISODate()!)
              }
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <strong>
            {day ? (
              `${data.view_mode === "today" ? "Heute" : "Morgen"} · ${DateTime.fromISO(day, { zone }).setLocale("de").toFormat("cccc, dd. MMMM yyyy")}`
            ) : (
              <>
                {DateTime.fromISO(week).setLocale("de").toFormat("dd. MMMM")} –{" "}
                {DateTime.fromISO(week)
                  .plus({ days: Math.max(...data.weekdays) })
                  .setLocale("de")
                  .toFormat("dd. MMMM yyyy")}
              </>
            )}
          </strong>
          {data.view_mode === "week" && (
            <button
              aria-label="Nächste Woche"
              onClick={() =>
                setWeek(DateTime.fromISO(week).plus({ weeks: 1 }).toISODate()!)
              }
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>
        <button
          className="button secondary"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}Scrollen{" "}
          {paused ? "fortsetzen" : "pausieren"}
        </button>
      </div>
      {day && !data.rows.length && (
        <div className="display-empty" role="status">
          Für {data.view_mode === "today" ? "heute" : "morgen"} sind keine
          veröffentlichten Termine vorhanden.
        </div>
      )}
      <div className="public-calendar" ref={scroll}>
        <Timetable
          rows={data.rows}
          week={week}
          date={day}
          zone={data.timezone}
          publicMode
          weekdays={data.weekdays}
          dayStart={data.day_start}
          dayEnd={data.day_end}
        />
      </div>
      <footer>
        <span>
          {DEMO_MODE
            ? "Diese Anzeige verwendet die Demodaten dieses Browsers."
            : "Änderungen erscheinen nach Freigabe automatisch."}
        </span>
        <span>campuszeit.</span>
      </footer>
    </main>
  );
}

function DataTable({
  resource,
  schema,
  onEdit,
  onAdd,
  onImport,
  refresh,
  query = "",
  filters = {},
  data,
}: {
  resource: string;
  schema: Field[];
  onEdit: (r: Row) => void;
  onAdd: () => void;
  onImport: () => void;
  refresh: number;
  query?: string;
  filters?: Row;
  data: Record<string, Row[]>;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [count, setCount] = useState(0),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const filterQuery = new URLSearchParams(filters).toString();
  useEffect(() => setPage(1), [resource, query, filterQuery]);
  useEffect(() => {
    let active = true;
    setBusy(true);
    api(
      `${resource}/?page=${page}&search=${encodeURIComponent(query)}&${filterQuery}`,
    )
      .then((result) => {
        if (active) {
          setRows(result.results);
          setCount(result.count);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [resource, page, query, refresh, filterQuery]);
  const columns = schema
    .filter(
      (f) =>
        !["json", "many", "file"].includes(f.type) &&
        !["geometry", "polygon", "color", "longitude", "latitude"].includes(
          f.name,
        ),
    )
    .slice(0, 6);
  const cell = (field: Field, row: Row) => {
    const value = row[field.name];
    if (field.type === "relation")
      return (
        data[field.resource!]?.find((r) => r.id === value)?.name ||
        `#${value || "—"}`
      );
    if (field.type === "boolean")
      return value ? (
        <span className="table-check">
          <Check size={14} />
          Ja
        </span>
      ) : (
        "—"
      );
    if (field.type === "choice")
      return field.choices.find(([v]) => v === value)?.[1] || value;
    if (field.type === "datetime-local")
      return value ? fmt(value, "Europe/Berlin", "dd.MM. HH:mm") : "—";
    return String(value ?? "—");
  };
  return (
    <div className="data-panel">
      <div className="data-panel-heading">
        <div>
          <h2>{labels[resource]}</h2>
          <span>{count} Einträge</span>
        </div>
        <div>
          <button
            className="button secondary"
            onClick={onImport}
            disabled={DEMO_MODE}
            title={
              DEMO_MODE
                ? "Dateiimporte benötigen das echte Backend."
                : undefined
            }
          >
            <Upload size={15} />
            Importieren
          </button>
          <button className="button primary" onClick={onAdd}>
            <Plus size={16} />
            Hinzufügen
          </button>
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((f) => (
                <th key={f.name}>{labels[f.name] || f.name}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={() => onEdit(row)}>
                {columns.map((f) => (
                  <td
                    key={f.name}
                    className={f.name === "name" ? "table-name" : ""}
                  >
                    {cell(f, row)}
                  </td>
                ))}
                <td>
                  <button
                    className="icon-button"
                    aria-label={`${row.name} bearbeiten`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(row);
                    }}
                  >
                    <ArrowUpRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {busy && (
          <div className="table-loading">
            <LoaderCircle size={20} className="spin" />
            Einträge laden …
          </div>
        )}
        {!busy && !rows.length && (
          <div className="empty-state">
            <Layers size={30} />
            <h3>
              {query ? "Keine passenden Einträge" : "Noch keine Einträge"}
            </h3>
            <p>
              {query
                ? "Versuche einen anderen Suchbegriff."
                : "Lege den ersten Eintrag an oder importiere eine Datei."}
            </p>
            <button className="button secondary" onClick={onAdd}>
              <Plus size={15} />
              Eintrag hinzufügen
            </button>
          </div>
        )}
      </div>
      <div className="table-footer">
        <span>
          {count
            ? `${(page - 1) * 100 + 1}–${Math.min(page * 100, count)} von ${count}`
            : "0 Einträge"}
        </span>
        <div>
          <button
            className="icon-button"
            disabled={page === 1}
            aria-label="Vorherige Seite"
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span>Seite {page}</span>
          <button
            className="icon-button"
            disabled={page * 100 >= count}
            aria-label="Nächste Seite"
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SolverModal({
  plan,
  kind,
  zone,
  onClose,
  onSaved,
}: {
  plan: Row;
  kind: string;
  zone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [job, setJob] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [started, setStarted] = useState(false);
  useEffect(() => {
    let live = true;
    api(`jobs/?plan=${plan.id}`)
      .then(async (jobs) => {
        const recent = jobs.find(
          (j: Row) =>
            j.kind === kind &&
            ["queued", "running", "ready"].includes(j.status),
        );
        if (recent) {
          const detail = await api(`jobs/${recent.id}/`);
          if (live) {
            setJob(detail);
            setStarted(true);
          }
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [plan.id, kind]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const result = await api(`plans/${plan.id}/solve/`, "POST", { kind });
      setJob({
        id: result.id,
        status: "queued",
        message: "Berechnung wird gestartet.",
        result: [],
      });
      setStarted(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!job?.id || !["queued", "running"].includes(job.status)) return;
    let live = true;
    const timer = setInterval(() => {
      api(`jobs/${job.id}/`)
        .then((r) => {
          if (live) setJob(r);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    }, 1000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [job?.id, job?.status]);
  async function apply() {
    setBusy(true);
    try {
      await api(`jobs/${job!.id}/`, "POST", { action: "apply" });
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    try {
      await api(`jobs/${job!.id}/`, "POST", { action: "cancel" });
      setJob((j) => ({ ...j!, message: "Abbruch angefordert …" }));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      title={
        kind === "exams"
          ? "Prüfungen automatisch planen"
          : "Stundenplan automatisch erstellen"
      }
      subtitle={plan.name}
      onClose={onClose}
      wide
    >
      <div className="modal-content">
        {!started ? (
          <>
            <div className="solver-intro">
              <Sparkles size={30} />
              <h3>Aus Anforderungen wird ein Vorschlag.</h3>
              <p>
                Die Planung berücksichtigt Verfügbarkeiten, Teilnehmer,
                Raumkapazitäten und Blockierungen. Fixierte Termine bleiben
                erhalten.
              </p>
            </div>
            <div className="solver-rules">
              <span>
                <CheckCircle2 size={17} />
                Einrichtungsweite Ressourcenprüfung
              </span>
              <span>
                <LockKeyhole size={17} />
                Übernahme und Freigabe durch die Verwaltung
              </span>
              <span>
                <Clock3 size={17} />
                Bis zu 10 Minuten Rechenzeit
              </span>
            </div>
          </>
        ) : (
          <>
            <div
              className={`job-status ${job?.status === "ready" ? "success" : ""}`}
            >
              {["queued", "running"].includes(job?.status) ? (
                <LoaderCircle className="spin" size={24} />
              ) : job?.status === "ready" ? (
                <CheckCircle2 size={24} />
              ) : (
                <AlertTriangle size={24} />
              )}
              <div>
                <strong>
                  {
                    (
                      {
                        queued: "Wird gestartet",
                        running: "Plan wird berechnet",
                        ready: "Vorschlag bereit",
                        infeasible: "Kein gültiger Plan möglich",
                        timeout: "Zeitlimit erreicht",
                        cancelled: "Abgebrochen",
                        invalid: "Planungsdaten prüfen",
                        failed: "Berechnung fehlgeschlagen",
                      } as Row
                    )[job?.status]
                  }
                </strong>
                <p>{job?.message}</p>
              </div>
            </div>
            {job?.stale && (
              <div className="error-box">
                Daten haben sich geändert. Dieser Vorschlag kann nicht
                übernommen werden.
              </div>
            )}
            {job?.status === "ready" && (
              <>
                <p>
                  {job.result.length} Termine im Vorschlag. Die Übernahme
                  verändert den Entwurf; die öffentliche Anzeige bleibt bis zur
                  Freigabe beim veröffentlichten Stand.
                </p>
                <div className="solver-preview">
                  <table>
                    <thead>
                      <tr>
                        <th>Veranstaltung</th>
                        <th>Termin</th>
                        <th>Raum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.result.map((r: Row, i: number) => (
                        <tr key={i}>
                          <td>{r.name}</td>
                          <td>{fmt(r.start, zone, "dd.MM. HH:mm")}</td>
                          <td>{r.room_names.join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
        {error && <div className="error-box">{error}</div>}
      </div>
      <footer>
        <button className="button secondary" onClick={onClose}>
          Schließen
        </button>
        {started && !["queued", "running"].includes(job?.status) && (
          <button className="button secondary" onClick={start} disabled={busy}>
            <RefreshCw size={16} />
            Neu berechnen
          </button>
        )}
        {["queued", "running"].includes(job?.status) && (
          <button className="button secondary" onClick={cancel}>
            Berechnung abbrechen
          </button>
        )}
        {!started && (
          <button className="button primary" onClick={start} disabled={busy}>
            <Sparkles size={16} />
            Vorschlag berechnen
          </button>
        )}
        {job?.status === "ready" && (
          <button
            className="button primary"
            onClick={apply}
            disabled={busy || job.stale}
          >
            <Check size={16} />
            Vorschlag übernehmen
          </button>
        )}
      </footer>
    </Modal>
  );
}

export default function App() {
  const publicMatch = window.location.pathname.match(/^\/display\/([\w-]+)/);
  if (publicMatch) return <PublicDisplay token={publicMatch[1]} />;
  return <Workspace />;
}
function Workspace() {
  const [session, setSession] = useState<SessionState | null>(null),
    [boot, setBoot] = useState<Row | null>(null),
    [data, setData] = useState<Record<string, Row[]>>({}),
    [page, setPage] = useState("schedule"),
    [resource, setResource] = useState("courses"),
    [dataFilters, setDataFilters] = useState<Row>({}),
    [planId, setPlanId] = useState<number | null>(null),
    [week, setWeek] = useState(DateTime.now().startOf("week").toISODate()!),
    [rows, setRows] = useState<Row[]>([]),
    [conflicts, setConflicts] = useState<string[]>([]),
    [publication, setPublication] = useState<Row | null>(null),
    [search, setSearch] = useState(""),
    [groupFilter, setGroupFilter] = useState(""),
    [roomFilter, setRoomFilter] = useState(""),
    [modal, setModal] = useState<Row | null>(null),
    [refresh, setRefresh] = useState(0),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [menu, setMenu] = useState(false),
    [initial, setInitial] = useState(true),
    [settings, setSettings] = useState<Row>({}),
    [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const zone = session?.institution?.timezone || "Europe/Berlin",
    plan = data.plans?.find((p) => p.id === planId),
    period = data.periods?.find((p) => p.id === plan?.period);
  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 4000);
  };
  const reload = () => {
    setRefresh((n) => n + 1);
    notify("Änderungen gespeichert.");
  };
  useEffect(() => {
    api("auth/me/")
      .then(setSession)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!session?.authenticated) return;
    let active = true;
    Promise.all([
      api("bootstrap/"),
      ...compactResources.map((name) => all(name)),
    ])
      .then(([b, ...collections]) => {
        if (!active) return;
        setBoot(b);
        const d: Record<string, Row[]> = {};
        compactResources.forEach((name, i) => (d[name] = collections[i]));
        setData(d);
        if (initial && !d.plans.length) setPage("setup");
        if (!planId && d.plans[0]) {
          setPlanId(d.plans[0].id);
          const p = d.periods.find((r) => r.id === d.plans[0].period);
          if (p)
            setWeek(
              DateTime.fromISO(p.start, { zone }).startOf("week").toISODate()!,
            );
        }
        setInitial(false);
        setError("");
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setInitial(false);
        }
      });
    return () => {
      active = false;
    };
  }, [session?.authenticated, refresh]);
  useEffect(() => {
    if (!planId) return;
    let active = true;
    api(`plans/${planId}/check/`)
      .then((r) => {
        if (active) {
          setRows(r.rows);
          setConflicts(r.conflicts);
          setPublication(r.publication);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [planId, refresh]);
  const edit = (res: string, row?: Row, defaults: Row = {}) =>
    setModal({ type: "record", resource: res, record: row, defaults });
  const go = (id: string) => {
    setDataFilters({});
    setPage(id);
    setSearch("");
    setMenu(false);
    if (id === "exams") setResource("exams");
    if (id === "displays") setResource("displays");
  };
  async function publish() {
    if (!plan) return;
    setBusy(true);
    try {
      const r = await api(`plans/${plan.id}/publish/`, "POST", {});
      setRefresh((n) => n + 1);
      notify(`Version ${r.number} veröffentlicht.`);
      setModal(null);
    } catch (e) {
      setError((e as Error).message);
      setModal(null);
    } finally {
      setBusy(false);
    }
  }
  async function saveSettings() {
    setBusy(true);
    try {
      await api("preferences/", "PATCH", settings);
      const s = await api("auth/me/");
      setSession(s);
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function applyTemplate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`plans/${planId}/template/`, "POST", {
        curriculum: modal!.curriculum,
        groups: modal!.groups || [],
      });
      reload();
      setModal(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible = rows.filter(
    (r) =>
      (!search ||
        `${r.name} ${r.group_names?.join(" ")} ${r.room_names?.join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!groupFilter || r.group_names?.includes(groupFilter)) &&
      (!roomFilter || r.room_names?.includes(roomFilter)),
  );
  const inWeek = rows.filter(
    (r) =>
      DateTime.fromISO(r.start, { zone }).startOf("week").toISODate() === week,
  );
  if (!session)
    return (
      <>
        <DemoNotice />
        <div className="loading-screen">
          {error || (
            <>
              <LoaderCircle className="spin" size={24} />
              Campuszeit wird geladen …
            </>
          )}
        </div>
      </>
    );
  if (!session.authenticated)
    return (
      <Login
        onLogin={(s) => {
          setSession(s);
          setInitial(true);
        }}
      />
    );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Brand />
        <div className="institution-switch">
          <span className="institution-icon">
            <GraduationCap size={21} />
          </span>
          <div>
            <strong>{session.institution.name.split(" · ")[0]}</strong>
            <small>
              {session.institution.kind === "school"
                ? "Schulverwaltung"
                : "Hochschulverwaltung"}
            </small>
          </div>
          <ChevronDown size={15} />
        </div>
        <span className="nav-caption">Arbeitsbereich</span>
        <nav>
          {nav.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => go(item.id)}
            >
              <item.icon size={20} />
              {item.label}
              {item.id === "schedule" && (
                <span className="nav-count">{data.plans?.length || 0}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <button
          className={"settings-nav " + (page === "settings" ? "active" : "")}
          onClick={() => {
            go("settings");
            setSettings(session.institution);
          }}
        >
          <Settings size={19} />
          Einstellungen
        </button>
        <div className="user-profile">
          <span className="avatar">
            {session.user
              .split(" ")
              .map((x) => x[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div>
            <strong>{session.user}</strong>
            <small>
              {session.role === "admin"
                ? "Verwaltung"
                : "Planungsverantwortlich"}
            </small>
          </div>
          <button
            className="icon-button"
            aria-label="Abmelden"
            disabled={DEMO_MODE}
            title={DEMO_MODE ? "Die Demo benötigt keine Anmeldung." : undefined}
            onClick={() =>
              api("auth/logout/", "POST", {})
                .then(() => {
                  setSession({ ...session, authenticated: false });
                  setBoot(null);
                  setData({});
                  setPlanId(null);
                })
                .catch((e) => setError(e.message))
            }
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      {menu && <div className="sidebar-scrim" onClick={() => setMenu(false)} />}
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Menü öffnen"
            onClick={() => setMenu((m) => !m)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            Arbeitsbereich
            <ChevronRight size={14} />
            <strong>
              {nav.find((n) => n.id === page)?.label || "Einstellungen"}
            </strong>
          </div>
          <div className="global-search">
            <Search size={17} />
            <input
              ref={searchRef}
              placeholder="In dieser Ansicht suchen …"
              aria-label="Suche"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>Ctrl K</kbd>
          </div>
          <span className="top-avatar">
            {session.user
              .split(" ")
              .map((x) => x[0])
              .slice(0, 2)
              .join("")}
          </span>
        </header>
        <main className="main-content">
          <DemoNotice />
          {error && (
            <div className="error-box global-error" role="alert">
              {error}
              <button
                aria-label="Fehler schließen"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {initial ? (
            <div className="loading-screen">
              <LoaderCircle className="spin" />
              Arbeitsbereich laden …
            </div>
          ) : page === "setup" ? (
            <StudySetup
              data={data}
              zone={zone}
              query={search}
              onEdit={edit}
              onChanged={reload}
              onOpenRooms={() => go("map")}
              onOpenStudents={(groupId) => {
                go("data");
                setResource("people");
                setDataFilters({ groups: String(groupId), kind: "learner" });
              }}
              onOpenPlan={(id) => {
                setPlanId(id);
                go("schedule");
                const selected = data.plans.find((item) => item.id === id);
                const p = data.periods.find(
                  (item) => item.id === selected?.period,
                );
                if (p)
                  setWeek(
                    DateTime.fromISO(p.start, { zone })
                      .startOf("week")
                      .toISODate()!,
                  );
              }}
            />
          ) : page === "schedule" ? (
            <>
              <div className="page-actions">
                <button
                  className="button primary"
                  disabled={!plan || DEMO_MODE}
                  title={
                    DEMO_MODE
                      ? "Die automatische Planung ist lokal verfügbar und benötigt das echte Backend."
                      : undefined
                  }
                  onClick={() => setModal({ type: "solver", kind: "teaching" })}
                >
                  <Sparkles size={17} />
                  Automatisch planen
                </button>
              </div>
              <div className="overview-strip">
                <div>
                  <span className="stat-icon blue-stat">
                    <CalendarDays size={20} />
                  </span>
                  <div>
                    <strong>{inWeek.length}</strong>
                    <span>Termine diese Woche</span>
                  </div>
                </div>
                <div>
                  <span className="stat-icon mint-stat">
                    <Users size={20} />
                  </span>
                  <div>
                    <strong>{boot?.counts.people || 0}</strong>
                    <span>Personen erfasst</span>
                  </div>
                </div>
                <div>
                  <span className="stat-icon violet-stat">
                    <Building2 size={20} />
                  </span>
                  <div>
                    <strong>{boot?.counts.rooms || 0}</strong>
                    <span>Räume auf dem Campus</span>
                  </div>
                </div>
                <div>
                  <span
                    className={`stat-icon ${conflicts.length ? "amber-stat" : "mint-stat"}`}
                  >
                    {conflicts.length ? (
                      <AlertTriangle size={20} />
                    ) : (
                      <CheckCircle2 size={20} />
                    )}
                  </span>
                  <div>
                    <strong>
                      {conflicts.length
                        ? `${conflicts.length} Hinweise`
                        : DEMO_MODE
                          ? "Demo geprüft"
                          : "Konfliktfrei"}
                    </strong>
                    <span>
                      {conflicts.length
                        ? "Vor Veröffentlichung prüfen"
                        : DEMO_MODE
                          ? "Überschneidungen & Kapazitäten"
                          : "Alle Regeln erfüllt"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="schedule-panel">
                <div className="schedule-panel-top">
                  <div className="plan-select">
                    <span className="plan-dot" />
                    <select
                      aria-label="Stundenplan auswählen"
                      value={planId || ""}
                      onChange={(e) => setPlanId(Number(e.target.value))}
                    >
                      {data.plans?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="plan-actions">
                    <button
                      className="button ghost"
                      onClick={() => setModal({ type: "template", groups: [] })}
                      disabled={!plan || DEMO_MODE}
                      title={
                        DEMO_MODE
                          ? "Lehrplanübernahme benötigt das echte Backend."
                          : undefined
                      }
                    >
                      <FileText size={15} />
                      Lehrplan übernehmen
                    </button>
                    <button
                      className="button secondary"
                      disabled={!plan}
                      onClick={() =>
                        edit("sessions", undefined, {
                          plan: planId,
                          start: DateTime.fromISO(week, { zone })
                            .set({ hour: 8, minute: 0 })
                            .toISO(),
                          end: DateTime.fromISO(week, { zone })
                            .set({ hour: 9, minute: 30 })
                            .toISO(),
                        })
                      }
                    >
                      <Plus size={16} />
                      Termin
                    </button>
                    <button
                      className="button primary publish-button"
                      disabled={!plan}
                      onClick={() => setModal({ type: "publish" })}
                    >
                      <ArrowUpRight size={16} />
                      {DEMO_MODE
                        ? "Demoanzeige aktualisieren"
                        : "Veröffentlichen"}
                    </button>
                  </div>
                </div>
                <div className="schedule-toolbar">
                  <div className="week-nav">
                    <button
                      aria-label="Vorherige Woche"
                      onClick={() =>
                        setWeek(
                          DateTime.fromISO(week)
                            .minus({ weeks: 1 })
                            .toISODate()!,
                        )
                      }
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      aria-label="Nächste Woche"
                      onClick={() =>
                        setWeek(
                          DateTime.fromISO(week)
                            .plus({ weeks: 1 })
                            .toISODate()!,
                        )
                      }
                    >
                      <ChevronRight size={18} />
                    </button>
                    <strong>
                      {DateTime.fromISO(week)
                        .setLocale("de")
                        .toFormat("dd. MMM")}{" "}
                      –{" "}
                      {DateTime.fromISO(week)
                        .plus({ days: 4 })
                        .setLocale("de")
                        .toFormat("dd. MMM yyyy")}
                    </strong>
                    <button
                      className="today-button"
                      onClick={() =>
                        setWeek(
                          DateTime.now()
                            .setZone(zone)
                            .startOf("week")
                            .toISODate()!,
                        )
                      }
                    >
                      Heute
                    </button>
                  </div>
                  <div className="calendar-filters">
                    <SlidersHorizontal size={15} />
                    <select
                      aria-label="Gruppe filtern"
                      value={groupFilter}
                      onChange={(e) => setGroupFilter(e.target.value)}
                    >
                      <option value="">Alle Gruppen</option>
                      {data.groups?.map((g) => (
                        <option key={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Raum filtern"
                      value={roomFilter}
                      onChange={(e) => setRoomFilter(e.target.value)}
                    >
                      <option value="">Alle Räume</option>
                      {data.rooms?.map((r) => (
                        <option key={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {!plan ? (
                  <div className="empty-state">
                    <CalendarDays size={36} />
                    <h3>Noch kein Stundenplan vorhanden</h3>
                    <p>
                      Lege zunächst einen Zeitraum, einen Planbereich und einen
                      Stundenplan unter Stammdaten an.
                    </p>
                    <button
                      className="button primary"
                      onClick={() => {
                        go("data");
                        setResource("plans");
                      }}
                    >
                      Stammdaten öffnen
                    </button>
                  </div>
                ) : (
                  <div className="calendar-scroll">
                    <Timetable
                      rows={visible}
                      week={week}
                      zone={zone}
                      onSelect={(r) =>
                        edit("sessions", {
                          ...r,
                          rooms: r.room_ids,
                          teachers: r.teacher_ids,
                          plan: planId,
                        })
                      }
                      dayStart={
                        period
                          ? Number(period.day_start.split(":")[0]) +
                            Number(period.day_start.split(":")[1]) / 60
                          : 8
                      }
                      dayEnd={
                        period
                          ? Number(period.day_end.split(":")[0]) +
                            Number(period.day_end.split(":")[1]) / 60
                          : 18
                      }
                      weekdays={period?.weekdays}
                    />
                  </div>
                )}
                <div className="calendar-footer">
                  <div className="legend">
                    <span>
                      <i className="blue" />
                      Vorlesung & Projekt
                    </span>
                    <span>
                      <i className="violet" />
                      Übung & Wahlpflicht
                    </span>
                    <span>
                      <i className="mint" />
                      Labor
                    </span>
                  </div>
                  <span className="draft-note">
                    <span className="status-dot amber-dot" />
                    Entwurf
                    {publication
                      ? ` · Anzeige: Version ${publication.number}`
                      : " · Noch nicht veröffentlicht"}
                  </span>
                </div>
              </div>
              <div className="below-calendar">
                <div>
                  <span className="small-label">Planungsstatus</span>
                  {conflicts.length ? (
                    <ul className="conflict-list">
                      {conflicts.slice(0, 6).map((c, i) => (
                        <li key={i}>
                          <AlertTriangle size={15} />
                          {c}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      {DEMO_MODE
                        ? "Die Demo prüft Überschneidungen und Raumkapazitäten. Die vollständige Soll- und Regelprüfung erfolgt im echten Backend."
                        : "Keine Überschneidungen. Unterrichtssoll und Kapazitäten sind geprüft."}
                    </p>
                  )}
                </div>
                <div className="activity">
                  <span className="small-label">Zuletzt geändert</span>
                  {boot?.audit.slice(0, 3).map((a: Row, i: number) => (
                    <div key={i}>
                      <span className="activity-dot" />
                      <p>
                        {a.action}
                        <small>{fmt(a.created, zone, "dd.MM. · HH:mm")}</small>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : page === "map" ? (
            <RoomOverview
              data={data}
              zone={zone}
              query={search}
              onEdit={edit}
            />
          ) : page === "settings" ? (
            <>
              <div className="section-heading">
                <div>
                  <h1>Einrichtungseinstellungen</h1>
                  <p>Gemeinsame Vorgaben für Unterricht und Prüfungen.</p>
                </div>
              </div>
              <div className="settings-panel">
                <h2>{session.institution.name}</h2>
                <div className="form-grid">
                  {[
                    [
                      "unit_minutes",
                      "Dauer einer Unterrichtseinheit (Minuten)",
                    ],
                    ["exam_max_per_day", "Maximale Prüfungen pro Person / Tag"],
                    [
                      "exam_gap_hours",
                      "Mindestabstand zwischen Prüfungen (Stunden)",
                    ],
                  ].map(([key, label]) => (
                    <label key={key}>
                      <span>{label}</span>
                      <input
                        type="number"
                        min={key === "exam_gap_hours" ? 0 : 1}
                        value={settings[key] ?? ""}
                        onChange={(e) =>
                          setSettings((v) => ({ ...v, [key]: e.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <p>
                  Zeitzone: {session.institution.timezone} · Lizenz bis{" "}
                  {session.institution.license_until || "unbefristet"}
                </p>
                <button
                  className="button primary"
                  onClick={saveSettings}
                  disabled={busy || session.role !== "admin"}
                >
                  <Check size={16} />
                  Einstellungen speichern
                </button>
              </div>
              <div className="info-note">
                <LockKeyhole size={19} />
                <p>
                  Einrichtungen, Verwaltungszugänge und Lizenzlaufzeiten werden
                  im gesonderten Betriebsbereich eingerichtet.
                </p>
                {!DEMO_MODE && (
                  <a href="/admin/" target="_blank" rel="noreferrer">
                    Betriebsbereich öffnen
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </>
          ) : (
            <>
              {page === "exams" && (
                <div className="page-actions">
                  <button
                    className="button primary"
                    disabled={!plan}
                    onClick={() => setModal({ type: "solver", kind: "exams" })}
                  >
                    <Sparkles size={16} />
                    Prüfungen planen
                  </button>
                </div>
              )}
              {page === "data" && (
                <div className="resource-tabs">
                  {[
                    "courses",
                    "plans",
                    "curricula",
                    "groups",
                    "people",
                    "rooms",
                    "blocks",
                    "periods",
                    "programs",
                    "studyversions",
                    "modules",
                    "teachingunits",
                    "cohorts",
                    "areas",
                    "buildings",
                    "floors",
                  ].map((res) => (
                    <button
                      key={res}
                      className={resource === res ? "active" : ""}
                      onClick={() => {
                        setResource(res);
                        setDataFilters({});
                        setSearch("");
                      }}
                    >
                      {labels[res]}
                    </button>
                  ))}
                </div>
              )}
              {page === "data" && dataFilters.groups && (
                <div className="info-note">
                  <p>
                    Studierendenliste:{" "}
                    {
                      data.groups.find(
                        (item) => String(item.id) === dataFilters.groups,
                      )?.name
                    }
                    . Neue Personen werden dieser Gruppe zugeordnet. CSV-Importe
                    verwenden die Gruppenkennung in der Spalte „groups“.
                  </p>
                  <button
                    className="button secondary"
                    onClick={() => setDataFilters({})}
                  >
                    Alle Personen anzeigen
                  </button>
                </div>
              )}
              {page === "exams" && (
                <div className="info-note">
                  <GraduationCap size={21} />
                  <p>
                    Die Automatik nutzt die Teilnehmerlisten, Prüfungszeiträume
                    und Aufsichten jeder Klausur. Nachschreiber erhalten eine
                    eigene Teilnehmerliste.
                  </p>
                </div>
              )}
              {page === "displays" && (
                <div className="display-cards">
                  {data.displays?.map((d) => (
                    <article key={d.id}>
                      <div className="display-card-icon">
                        <Monitor size={23} />
                      </div>
                      <span className={"badge " + (d.active ? "success" : "")}>
                        {d.active ? "Aktiv" : "Deaktiviert"}
                      </span>
                      <h3>{d.name}</h3>
                      <p>
                        {
                          { week: "Woche", today: "Heute", tomorrow: "Morgen" }[
                            d.view_mode as "week" | "today" | "tomorrow"
                          ]
                        }{" "}
                        · {d.plans.length} Planbereiche ·{" "}
                        {d.auto_scroll
                          ? "Automatisches Scrollen"
                          : "Statische Anzeige"}
                      </p>
                      <div>
                        <a
                          className="button secondary"
                          href={`/display/${d.token}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink size={15} />
                          Anzeige öffnen
                        </a>
                        <button
                          className="icon-button"
                          aria-label="Anzeige bearbeiten"
                          onClick={() => edit("displays", d)}
                        >
                          <Settings size={17} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              <p className="resource-description">{descriptions[resource]}</p>
              {boot && (
                <DataTable
                  resource={resource}
                  schema={boot.schema[resource]}
                  onAdd={() =>
                    edit(
                      resource,
                      undefined,
                      ["courses", "exams"].includes(resource)
                        ? { plan: planId }
                        : resource === "people" && dataFilters.groups
                          ? {
                              groups: [Number(dataFilters.groups)],
                              kind: "learner",
                            }
                          : {},
                    )
                  }
                  onEdit={(r) => edit(resource, r)}
                  onImport={() => setModal({ type: "import", resource })}
                  refresh={refresh}
                  query={search}
                  filters={dataFilters}
                  data={data}
                />
              )}
            </>
          )}
        </main>
        <footer className="workspace-footer">
          <span>campuszeit.</span>
          <span>
            <span className="status-dot" />
            {DEMO_MODE
              ? "Demodaten in diesem Browser"
              : "Mit deiner Einrichtung verbunden"}
          </span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {modal?.type === "record" && boot && (
        <RecordForm
          key={`${modal.resource}-${modal.record?.id}`}
          resource={modal.resource}
          fields={boot.schema[modal.resource]}
          record={modal.record}
          defaults={modal.defaults}
          zone={zone}
          onClose={() => setModal(null)}
          onSaved={reload}
        />
      )}{" "}
      {modal?.type === "import" && (
        <ImportModal
          resource={modal.resource}
          onClose={() => setModal(null)}
          onSaved={reload}
        />
      )}{" "}
      {modal?.type === "solver" && plan && (
        <SolverModal
          plan={plan}
          kind={modal.kind}
          zone={zone}
          onClose={() => setModal(null)}
          onSaved={reload}
        />
      )}{" "}
      {modal?.type === "publish" && (
        <Modal
          title={
            DEMO_MODE
              ? "Demoanzeige aktualisieren"
              : "Stundenplan veröffentlichen"
          }
          subtitle={plan?.name}
          onClose={() => setModal(null)}
        >
          <div className="modal-content">
            {conflicts.length ? (
              <>
                <div className="error-box">
                  Der Plan enthält noch {conflicts.length} Hinweise. Behebe
                  diese vor der Veröffentlichung.
                </div>
                <ul className="conflict-list">
                  {conflicts.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <div className="publish-summary">
                  <CheckCircle2 size={30} />
                  <p>
                    {rows.length} Termine{" "}
                    {DEMO_MODE
                      ? "werden in die Demoanzeige dieses Browsers übernommen."
                      : "werden als neue Version freigegeben. Verbundene Anzeigen aktualisieren sich automatisch."}
                  </p>
                </div>
                <p>
                  {DEMO_MODE
                    ? "In dieser Demo werden nur Überschneidungen und Raumkapazitäten geprüft. Die vollständige Freigabe benötigt das echte Backend."
                    : "Vor der Freigabe prüfen wir Ressourcen und Unterrichtssoll erneut."}
                </p>
              </>
            )}
          </div>
          <footer>
            <button className="button secondary" onClick={() => setModal(null)}>
              Abbrechen
            </button>
            <button
              className="button primary"
              disabled={busy || !!conflicts.length}
              onClick={publish}
            >
              <ArrowUpRight size={16} />
              {DEMO_MODE
                ? "Demoanzeige aktualisieren"
                : "Jetzt veröffentlichen"}
            </button>
          </footer>
        </Modal>
      )}{" "}
      {modal?.type === "template" && (
        <Modal
          title="Lehrplan übernehmen"
          subtitle="Die Vorlage wird als bearbeitbare Kopie in diesen Plan übernommen."
          onClose={() => setModal(null)}
        >
          <form onSubmit={applyTemplate} className="record-form">
            <label>
              Lehrplanvorlage
              <Relation
                resource="curricula"
                value={modal.curriculum}
                onChange={(v) => setModal((m) => ({ ...m!, curriculum: v }))}
              />
            </label>
            <label>
              Gruppen
              <Relation
                resource="groups"
                many
                value={modal.groups}
                onChange={(v) => setModal((m) => ({ ...m!, groups: v }))}
              />
            </label>
            <p className="muted">
              Lehrende anschließend den übernommenen Veranstaltungen zuordnen.
            </p>
            <footer>
              <button
                type="button"
                className="button secondary"
                onClick={() => setModal(null)}
              >
                Abbrechen
              </button>
              <button
                className="button primary"
                disabled={!modal.curriculum || busy}
              >
                Vorlage übernehmen
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </div>
  );
}
