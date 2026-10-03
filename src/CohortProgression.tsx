import { useEffect, useRef, useState } from "react";
import { api, Row } from "./api";

const fields = [
  [
    "semester_credit_limit",
    "CP-Anteile je Semester",
    "0 = Mittelwert des Studiengangs",
  ],
  [
    "semester_weekly_limit",
    "UE pro Woche",
    "0 = keine Grenze; A/B-Wochen zählen anteilig",
  ],
  [
    "semester_difficulty_limit",
    "Belastungspunkte je Semester",
    "0 = Mittelwert; CP-Anteil × Schwierigkeit 1–3",
  ],
];
const number = (value: number) =>
  new Intl.NumberFormat("de", { maximumFractionDigits: 1 }).format(value);

export default function CohortProgression({
  cohort,
  modules,
  onChanged,
}: {
  cohort: Row;
  modules: Row[];
  onChanged: () => void;
}) {
  const [report, setReport] = useState<Row | null>(null),
    [saved, setSaved] = useState(""),
    [limits, setLimits] = useState<Row>({});
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [proposal, setProposal] = useState<Row | null>(null);
  const [moduleId, setModuleId] = useState(""),
    [target, setTarget] = useState(1);
  const generation = useRef(0);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    generation.current++;
    setBusy(false);
    setReport(null);
    setError("");
    setMessage("");
    setProposal(null);
    api(`cohorts/${cohort.id}/progression/`)
      .then((result) => {
        if (!active) return;
        setReport(result);
        setLimits(result.limits);
        setSaved(
          JSON.stringify({ schedule: result.schedule, limits: result.limits }),
        );
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
      generation.current++;
    };
  }, [cohort, reload]);
  async function request(operation: string, schedule = report?.schedule) {
    if (!report) return;
    const requestGeneration = generation.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api(`cohorts/${cohort.id}/progression/`, "POST", {
        operation,
        schedule,
        limits: Object.fromEntries(
          fields.map(([field]) => [field, Number(limits[field])]),
        ),
        revision: report.revision,
      });
      if (generation.current !== requestGeneration) return;
      if (operation === "propose") setProposal(result);
      else {
        setReport(result);
        setLimits(result.limits);
        setProposal(null);
        if (operation === "save") {
          setSaved(
            JSON.stringify({
              schedule: result.schedule,
              limits: result.limits,
            }),
          );
          setMessage("Studienverlauf für diesen Jahrgang gespeichert.");
          onChanged();
        }
      }
    } catch (err) {
      if (generation.current === requestGeneration)
        setError((err as Error).message);
    } finally {
      if (generation.current === requestGeneration) setBusy(false);
    }
  }
  function change(entry: Row, semester: number, pinned: boolean) {
    request("preview", {
      ...report!.schedule,
      [entry.id]: { semester, pinned },
    });
  }
  function moveModule() {
    const ids = new Set<number>();
    function visit(id: number) {
      if (ids.has(id)) return;
      ids.add(id);
      modules
        .filter((row) => row.parent === id)
        .forEach((row) => visit(row.id));
    }
    visit(Number(moduleId));
    const entries = report!.entries.filter((entry: Row) =>
      ids.has(entry.module),
    );
    const first = Math.min(...entries.map((entry: Row) => entry.semester)),
      delta = target - first;
    if (
      !entries.length ||
      entries.some(
        (entry: Row) =>
          entry.locked ||
          entry.semester + delta < 1 ||
          entry.semester + delta > report!.semesters.length,
      )
    ) {
      setError(
        "Das gesamte Modul muss innerhalb der Regelstudienzeit liegen und darf noch nicht übernommen sein.",
      );
      return;
    }
    request("preview", {
      ...report!.schedule,
      ...Object.fromEntries(
        entries.map((entry: Row) => [
          entry.id,
          { semester: entry.semester + delta, pinned: true },
        ]),
      ),
    });
  }
  const dirty =
    !!report &&
    JSON.stringify({
      schedule: report.schedule,
      limits: Object.fromEntries(
        fields.map(([field]) => [field, Number(limits[field])]),
      ),
    }) !== saved;
  return (
    <details className="cohort-progression">
      <summary>Studienverlauf und Semesterbelastung</summary>
      <p>
        Der Standardlehrplan ist die Vorlage. Verschiebungen gelten nur für{" "}
        {cohort.name}. Manuelle Änderungen werden zunächst fixiert;
        Voraussetzungen müssen erhalten bleiben.
      </p>
      <button
        className="button ghost"
        disabled={busy}
        onClick={() => setReload(reload + 1)}
      >
        Gespeicherten Verlauf neu laden
      </button>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="study-message" role="status">
          {message}
        </div>
      )}
      {!report ? (
        <p>Studienverlauf wird geladen.</p>
      ) : (
        <>
          <div className="progression-limits">
            {fields.map(([field, label, help]) => (
              <label key={field}>
                {label}
                <input
                  aria-label={label}
                  type="number"
                  min="0"
                  max="10000"
                  step={field === "semester_credit_limit" ? ".1" : "1"}
                  value={limits[field] ?? 0}
                  disabled={busy}
                  onChange={(event) => {
                    setLimits({ ...limits, [field]: event.target.value });
                    setProposal(null);
                  }}
                />
                <small>{help}</small>
              </label>
            ))}
          </div>
          <div className="study-inline-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => request("preview")}
            >
              Belastung prüfen
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => request("propose")}
            >
              Ausgleich vorschlagen
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                request(
                  "preview",
                  Object.fromEntries(
                    report.entries
                      .filter((entry: Row) => entry.locked)
                      .map((entry: Row) => [
                        entry.id,
                        { semester: entry.semester, pinned: entry.pinned },
                      ]),
                  ),
                )
              }
            >
              Standard wiederherstellen
            </button>
            <button
              className="button primary"
              disabled={busy || !dirty || report.errors.length > 0}
              onClick={() => request("save")}
            >
              Studienverlauf speichern
            </button>
            {dirty && <small>Änderungen noch nicht gespeichert</small>}
          </div>
          <div className="progression-module-move">
            <label>
              Ganzes Modul
              <select
                aria-label="Modul verschieben"
                value={moduleId}
                disabled={busy}
                onChange={(event) => setModuleId(event.target.value)}
              >
                <option value="">Modul wählen</option>
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Neues Startsemester
              <select
                aria-label="Neues Startsemester"
                value={target}
                disabled={busy}
                onChange={(event) => setTarget(Number(event.target.value))}
              >
                {report.semesters.map((row: Row) => (
                  <option value={row.semester} key={row.semester}>
                    {row.semester}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button secondary"
              disabled={busy || !moduleId}
              onClick={moveModule}
            >
              Modul verschieben
            </button>
          </div>
          <small>
            Bei mehrsemestrigen Modulen bleiben die Abstände zwischen den
            Veranstaltungen erhalten.
          </small>
          {(report.errors.length > 0 || report.warnings.length > 0) && (
            <div
              className="study-report progression-warnings"
              aria-label="Prüfung des Studienverlaufs"
            >
              {report.errors.length > 0 && (
                <>
                  <strong>Voraussetzungen prüfen – Speichern gesperrt</strong>
                  <ul>
                    {report.errors.map((item: string) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              )}
              {report.warnings.length > 0 && (
                <>
                  <strong>Hinweise zur Semesterbelastung</strong>
                  <ul>
                    {report.warnings.map((item: string) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          {proposal && (
            <div
              className="study-report progression-proposal"
              aria-label="Ausgleichsvorschlag"
            >
              <h3>Ausgleichsvorschlag</h3>
              <p>{proposal.message}</p>
              <ul>
                {proposal.moves.map((move: Row) => (
                  <li key={move.id}>
                    {move.name}: Semester {move.from} → {move.to}
                  </li>
                ))}
              </ul>
              <p>
                {report.warnings.length} Belastungshinweise bisher ·{" "}
                {proposal.warnings.length} nach dem Vorschlag
              </p>
              {proposal.warnings.length > 0 && (
                <details>
                  <summary>Verbleibende Belastungshinweise</summary>
                  <ul>
                    {proposal.warnings.map((item: string) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="study-inline-actions">
                <button
                  className="button primary"
                  disabled={
                    busy || proposal.errors.length > 0 || !proposal.moves.length
                  }
                  onClick={() => {
                    setReport(proposal);
                    setLimits(proposal.limits);
                    setProposal(null);
                    setMessage(
                      "Vorschlag in der Vorschau. Zum Übernehmen den Studienverlauf speichern.",
                    );
                  }}
                >
                  Vorschlag in Vorschau übernehmen
                </button>
                <button
                  className="button secondary"
                  onClick={() => setProposal(null)}
                >
                  Vorschlag verwerfen
                </button>
              </div>
            </div>
          )}
          <p className="progression-method">
            CP-Anteile werden innerhalb eines Moduls auf seine Veranstaltungen
            verteilt und nicht doppelt gezählt. Schwierigkeit kommt aus der
            Modulpflege; „Mittel“ ist voreingestellt und sollte fachlich geprüft
            werden. Diese Übersicht prüft die Studienfolge und Lernbelastung;
            Raum- und Lehrendenkapazitäten prüft anschließend die konkrete
            Stundenplanung.
          </p>
          <div className="progression-semesters">
            {report.semesters.map((row: Row) => (
              <section
                className={`progression-semester ${row.overloaded ? "overloaded" : ""}`}
                key={row.semester}
                aria-label={`Studienverlauf Semester ${row.semester}`}
              >
                <h3>Semester {row.semester}</h3>
                <span>
                  {number(row.credits)} CP-Anteile · {number(row.weekly_units)}{" "}
                  UE/Woche
                </span>
                <small>
                  {number(row.difficulty)} Belastungspunkte · {row.count}{" "}
                  Veranstaltungen
                  {row.total_units
                    ? ` · ${row.total_units} UE zusätzlich als Gesamtumfang`
                    : ""}
                  {row.overloaded ? " · Grenze überschritten" : ""}
                </small>
                {report.entries
                  .filter((entry: Row) => entry.semester === row.semester)
                  .map((entry: Row) => (
                    <div className="progression-entry" key={entry.id}>
                      <strong>{entry.name}</strong>
                      <small>
                        Standard: Semester {entry.standard_semester} ·{" "}
                        {number(entry.credits)} CP-Anteil · Schwierigkeit{" "}
                        {entry.difficulty}
                      </small>
                      <select
                        aria-label={`Semester für ${entry.name}`}
                        value={entry.semester}
                        disabled={busy || entry.locked}
                        onChange={(event) =>
                          change(entry, Number(event.target.value), true)
                        }
                      >
                        {report.semesters.map((semester: Row) => (
                          <option
                            key={semester.semester}
                            value={semester.semester}
                          >
                            Semester {semester.semester}
                          </option>
                        ))}
                      </select>
                      <label className="progression-pin">
                        <input
                          type="checkbox"
                          aria-label={`${entry.name} fixieren`}
                          checked={entry.pinned || entry.locked}
                          disabled={busy || entry.locked}
                          onChange={(event) =>
                            change(entry, entry.semester, event.target.checked)
                          }
                        />
                        {entry.locked
                          ? "Bereits im Semesterplan"
                          : "Beim Ausgleich fixieren"}
                      </label>
                    </div>
                  ))}
                {!row.count && <small>Keine Veranstaltungen vorgesehen</small>}
              </section>
            ))}
          </div>
        </>
      )}
    </details>
  );
}
