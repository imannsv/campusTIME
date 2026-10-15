import { FormEvent, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LayoutGrid,
  List,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Users,
  KeyRound,
} from "lucide-react";
import { api, DEMO_MODE, Row } from "./api";
import { Modal, Relation } from "./components";
import PersonalAccess from "./PersonalAccess";
import PlanningSelection, { type PlanningScope } from "./PlanningSelection";
import "./learners.css";

export function LearnerForm({
  record,
  defaults = {},
  data,
  onClose,
  onSaved,
}: {
  record?: Row;
  defaults?: Row;
  data: Record<string, Row[]>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = {
    name: record?.name || "",
    first_name: record?.first_name || "",
    last_name: record?.last_name || "",
    email: record?.email || "",
    code: record?.code || defaults.code || "",
    groups: record?.groups || defaults.groups || [],
  };
  const [values, setValues] = useState(initial);
  const [autoCode] = useState(() => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return `ST-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  });
  const [cohort, setCohort] = useState(
    String(
      defaults.cohort ||
        data.groups?.find((group) => group.id === initial.groups[0])?.cohort ||
        "",
    ),
  );
  const [busy, setBusy] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(initial) !== JSON.stringify(values);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  function close() {
    if (
      !busy &&
      (!dirty || window.confirm("Ungespeicherte Änderungen verwerfen?"))
    )
      onClose();
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        `people/${record ? record.id + "/" : ""}`,
        record ? "PATCH" : "POST",
        {
          kind: "learner",
          name: values.name.trim(),
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          email: values.email.trim(),
          code: values.code.trim() || record?.code || autoCode,
          groups: values.groups,
        },
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (accessOpen && record)
    return (
      <PersonalAccess person={record} onClose={() => setAccessOpen(false)} />
    );
  return (
    <Modal
      title={record ? "Person bearbeiten" : "Person hinzufügen"}
      subtitle="Schülerinnen, Schüler und Studierende deiner Einrichtung."
      onClose={close}
      busy={busy}
    >
      <form
        className="record-form learner-form"
        onSubmit={save}
        aria-busy={busy}
      >
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <fieldset className="record-fields" disabled={busy}>
          <div className="form-grid">
            {(["first_name", "last_name"] as const).map((field) => (
              <label key={field}>
                <span>{field === "first_name" ? "Vorname" : "Nachname"}</span>
                <input
                  maxLength={100}
                  autoComplete="off"
                  value={values[field]}
                  onChange={(event) =>
                    setValues((current) => {
                      const next = { ...current, [field]: event.target.value };
                      return {
                        ...next,
                        name: [next.first_name, next.last_name]
                          .filter(Boolean)
                          .join(" ")
                          .trim(),
                      };
                    })
                  }
                />
              </label>
            ))}
            <label className="full">
              <span>
                Anzeigename <b className="required">*</b>
              </span>
              <input
                aria-label="Name"
                required
                maxLength={200}
                autoComplete="off"
                value={values.name}
                onChange={(e) =>
                  setValues((v) => ({ ...v, name: e.target.value }))
                }
              />
            </label>
            <label className="full">
              <span>E-Mail (optional)</span>
              <input
                aria-label="E-Mail (optional)"
                aria-describedby="learner-email-hint"
                type="email"
                maxLength={254}
                autoComplete="off"
                value={values.email}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
              <small id="learner-email-hint">
                Nur in der Verwaltung sichtbar. Es werden keine E-Mails
                versendet.
              </small>
            </label>
            <label className="full">
              <span>Kennung (optional)</span>
              <input
                aria-label="Kennung (optional)"
                aria-describedby="learner-code-hint"
                maxLength={80}
                autoComplete="off"
                value={values.code}
                placeholder="Zum Beispiel eine Matrikel- oder Schülernummer"
                onChange={(e) =>
                  setValues((v) => ({ ...v, code: e.target.value }))
                }
              />
              <small id="learner-code-hint">
                {record
                  ? "Leer lassen: Die bisherige Kennung bleibt erhalten."
                  : "Ohne Eingabe wird automatisch eine eindeutige Kennung vergeben."}
              </small>
            </label>
            <label className="full">
              <span>Jahrgang</span>
              <select
                aria-label="Jahrgang"
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
              >
                <option value="">Alle Jahrgänge</option>
                {(data.cohorts || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.entry_year ? ` · ${item.entry_year}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="full learner-assignment">
              <span>Gruppen / Klassen</span>
              <Relation
                resource="groups"
                many
                value={values.groups}
                filters={cohort ? { cohort } : {}}
                onChange={(groups) =>
                  setValues((v) => ({
                    ...v,
                    groups: groups.filter((id: number) => id > 0),
                  }))
                }
              />
              <small>
                Wähle eine oder mehrere Gruppen. Die Zuordnung kannst du
                jederzeit ergänzen oder entfernen.
              </small>
              {!data.groups?.length && (
                <p>
                  Noch keine Gruppen vorhanden. Lege sie unter „Gruppen &
                  Jahrgänge“ an; du kannst diese Person auch zunächst ohne
                  Zuordnung speichern.
                </p>
              )}
            </div>
          </div>
        </fieldset>
        <footer>
          {record && (
            <button
              type="button"
              className="button secondary"
              disabled={busy || dirty || DEMO_MODE}
              title={
                DEMO_MODE
                  ? "Persönliche Zugänge sind in der Demo nicht verfügbar."
                  : dirty
                    ? "Änderungen zuerst speichern."
                    : undefined
              }
              onClick={() => setAccessOpen(true)}
            >
              <KeyRound size={16} /> Persönlicher Zugang
            </button>
          )}
          <div className="spacer" />
          <button
            className="button secondary"
            type="button"
            onClick={close}
            disabled={busy}
          >
            Abbrechen
          </button>
          <button className="button primary" type="submit" disabled={busy}>
            {busy && <LoaderCircle size={16} className="spin" />}Speichern
          </button>
        </footer>
      </form>
    </Modal>
  );
}

export default function LearnerAdmin({
  data,
  revision,
  query,
  onQueryChange,
  initialGroup,
  onEdit,
}: {
  data: Record<string, Row[]>;
  revision: number;
  query: string;
  onQueryChange: (value: string) => void;
  initialGroup?: string;
  onEdit: (record?: Row, defaults?: Row) => void;
}) {
  const [cohort, setCohort] = useState(
    String(
      data.groups?.find((item) => String(item.id) === initialGroup)?.cohort ||
        "",
    ),
  );
  const [group, setGroup] = useState(initialGroup || "");
  const [view, setView] = useState<"list" | "tiles">(() => {
    try {
      return !initialGroup &&
        localStorage.getItem("campuszeit-learner-view") === "tiles"
        ? "tiles"
        : "list";
    } catch {
      return "list";
    }
  });
  function changeView(next: "list" | "tiles") {
    setView(next);
    try {
      localStorage.setItem("campuszeit-learner-view", next);
    } catch {
      /* The switch still works without browser storage. */
    }
  }
  function openScope(scope: PlanningScope, unassigned = false) {
    setCohort(String(scope.cohort || ""));
    setGroup(unassigned ? "unassigned" : String(scope.group || ""));
    onQueryChange("");
    setPage(1);
    setView("list");
  }
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const params = new URLSearchParams({
    kind: "learner",
    search: query.trim(),
    page: String(page),
    page_size: "50",
  });
  if (cohort) params.set("cohort", cohort);
  if (group === "unassigned") params.set("unassigned", "1");
  else if (group) params.set("groups", group);
  const key = params.toString();
  useEffect(() => setPage(1), [query, cohort, group]);
  useEffect(() => {
    if (view !== "list") return;
    const controller = new AbortController();
    setError("");
    setResult(null);
    const timer = setTimeout(() => {
      api(`people/?${key}`, "GET", undefined, { signal: controller.signal })
        .then((response) => {
          if (!controller.signal.aborted) setResult({ ...response, key });
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, revision, retry, view]);
  const ready = result?.key === key;
  const rows: Row[] = ready ? result.results : [];
  const cohorts = [...(data.cohorts || [])].sort(
    (a, b) =>
      (b.entry_year || 0) - (a.entry_year || 0) ||
      a.name.localeCompare(b.name, "de", { numeric: true }),
  );
  const groups = (data.groups || []).filter(
    (item) => !cohort || String(item.cohort) === cohort,
  );
  return (
    <section className="learner-admin">
      <div className="page-actions">
        <div>
          <h1>Schüler & Studierende</h1>
          <p className="resource-description">
            Personen erfassen und ihren Jahrgängen, Gruppen und Klassen
            zuordnen.
          </p>
        </div>
        <div className="learner-actions">
          <div
            className="learner-view-switch"
            role="group"
            aria-label="Ansicht wählen"
          >
            <button
              type="button"
              aria-pressed={view === "tiles"}
              onClick={() => changeView("tiles")}
            >
              <LayoutGrid size={16} aria-hidden="true" />
              Kacheln
            </button>
            <button
              type="button"
              aria-pressed={view === "list"}
              onClick={() => changeView("list")}
            >
              <List size={16} aria-hidden="true" />
              Liste
            </button>
          </div>
          <button
            className="button primary"
            onClick={() =>
              onEdit(undefined, {
                groups:
                  view === "list" && group && group !== "unassigned"
                    ? [Number(group)]
                    : [],
                cohort: view === "list" ? cohort : "",
              })
            }
          >
            <Plus size={17} />
            Person hinzufügen
          </button>
        </div>
      </div>
      {view === "tiles" ? (
        <>
          <div className="learner-tile-tools">
            <label>
              <span>Jahrgang, Studiengang oder Gruppe</span>
              <div className="learner-search">
                <Search size={17} aria-hidden="true" />
                <input
                  aria-label="Jahrgang oder Gruppe suchen"
                  placeholder="Jahrgang oder Gruppe suchen …"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                />
              </div>
            </label>
            <button className="button secondary" onClick={() => openScope({})}>
              Alle Personen
            </button>
            <button
              className="button secondary"
              onClick={() => openScope({}, true)}
            >
              Ohne Zuordnung
            </button>
          </div>
          <PlanningSelection
            data={data}
            page="learners"
            query={query}
            onSelect={openScope}
          />
        </>
      ) : (
        <>
          <div className="learner-filters">
            <label>
              <span>Name, Kennung oder E-Mail</span>
              <div className="learner-search">
                <Search size={17} />
                <input
                  aria-label="Personen suchen"
                  placeholder="Personen suchen …"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                />
              </div>
            </label>
            <label>
              <span>Jahrgang</span>
              <select
                aria-label="Jahrgang filtern"
                value={cohort}
                onChange={(e) => {
                  setCohort(e.target.value);
                  setGroup("");
                }}
              >
                <option value="">Alle Jahrgänge</option>
                {cohorts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.entry_year ? ` · ${item.entry_year}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Gruppe / Klasse</span>
              <select
                aria-label="Gruppe / Klasse filtern"
                value={group}
                onChange={(e) => {
                  setGroup(e.target.value);
                  if (e.target.value === "unassigned") setCohort("");
                }}
              >
                <option value="">Alle Gruppen / Klassen</option>
                <option value="unassigned">Ohne Zuordnung</option>
                {groups.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error ? (
            <div className="error-box" role="alert">
              {error}
              <button
                className="button secondary"
                onClick={() => setRetry((value) => value + 1)}
              >
                Erneut versuchen
              </button>
            </div>
          ) : !ready ? (
            <div className="loading-card" role="status">
              <LoaderCircle size={20} className="spin" />
              Personen laden …
            </div>
          ) : (
            <div className="learner-list">
              <header>
                <h2>Personenübersicht</h2>
                <span>
                  {result.count} {result.count === 1 ? "Person" : "Personen"}
                </span>
              </header>
              {!rows.length && (
                <div className="empty-state">
                  <Users size={30} />
                  <h3>
                    {query || cohort || group
                      ? "Keine passenden Personen"
                      : "Noch keine Personen erfasst"}
                  </h3>
                  <p>
                    {query || cohort || group
                      ? "Passe die Suche oder die Filter an."
                      : "Lege eine Person an und wähle ihre Gruppen oder Klassen."}
                  </p>
                </div>
              )}
              {rows.map((person) => {
                const assigned = (data.groups || []).filter((item) =>
                  person.groups?.includes(item.id),
                );
                const years = cohorts.filter((item) =>
                  assigned.some((group) => group.cohort === item.id),
                );
                const programs = (data.programs || []).filter((item) =>
                  years.some((year) => year.program === item.id),
                );
                return (
                  <article className="learner-row" key={person.id}>
                    <div className="learner-avatar" aria-hidden="true">
                      {person.name
                        .split(/\s+/)
                        .map((part: string) => part[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div className="learner-identity">
                      <h3>{person.name}</h3>
                      <span>{person.code}</span>
                      {person.email && <small>{person.email}</small>}
                      {programs.length > 0 && (
                        <small>
                          {programs.map((item) => item.name).join(" · ")}
                        </small>
                      )}
                    </div>
                    <div className="learner-groups">
                      {assigned.length ? (
                        <>
                          <div>
                            {assigned.map((item) => (
                              <span className="badge" key={item.id}>
                                <Users size={13} />
                                {item.name}
                              </span>
                            ))}
                          </div>
                          <small>
                            <GraduationCap size={14} />
                            {years.map((item) => item.name).join(" · ")}
                          </small>
                        </>
                      ) : (
                        <span className="learner-unassigned">
                          Ohne Zuordnung
                        </span>
                      )}
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => onEdit(person)}
                    >
                      <Pencil size={15} />
                      Bearbeiten
                    </button>
                  </article>
                );
              })}
              <footer className="table-footer">
                <span>
                  {result.count
                    ? `${(page - 1) * 50 + 1}–${Math.min(page * 50, result.count)} von ${result.count}`
                    : "0 Personen"}
                </span>
                <div>
                  <button
                    className="icon-button"
                    disabled={page === 1}
                    aria-label="Vorherige Seite"
                    onClick={() => setPage((value) => value - 1)}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span>Seite {page}</span>
                  <button
                    className="icon-button"
                    disabled={!result.next}
                    aria-label="Nächste Seite"
                    onClick={() => setPage((value) => value + 1)}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </footer>
            </div>
          )}
        </>
      )}
    </section>
  );
}
