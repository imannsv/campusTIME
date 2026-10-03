import { useEffect, useState, FormEvent, ReactNode } from "react";
import { DateTime } from "luxon";
import { all, api, Row } from "./api";
import { Modal } from "./components";

type Props = {
  data: Record<string, Row[]>;
  zone: string;
  query: string;
  onEdit: (resource: string, record?: Row, defaults?: Row) => void;
  onChanged: () => void;
  onOpenRooms: () => void;
  onOpenPlan: (id: number) => void;
  onOpenStudents: (groupId: number) => void;
};

export default function StudySetup({
  data,
  zone,
  query,
  onEdit,
  onChanged,
  onOpenRooms,
  onOpenPlan,
  onOpenStudents,
}: Props) {
  const [step, setStep] = useState(0),
    [programId, setProgramId] = useState(0),
    [versionId, setVersionId] = useState(0),
    [cohortId, setCohortId] = useState(0);
  const [teachers, setTeachers] = useState<Row[]>([]),
    [report, setReport] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [copy, setCopy] = useState(false);
  const program =
    data.programs.find((item) => item.id === programId) || data.programs[0];
  const versions = data.studyversions.filter(
    (item) => item.program === program?.id,
  );
  const version = versions.find((item) => item.id === versionId) || versions[0];
  const cohorts = data.cohorts.filter(
    (item) =>
      item.program === program?.id &&
      (!version || item.study_version === version.id),
  );
  const cohort = cohorts.find((item) => item.id === cohortId) || cohorts[0];
  const modules = data.modules.filter(
    (item) => item.study_version === version?.id,
  );
  const units = data.teachingunits.filter((item) =>
    modules.some((module) => module.id === item.module),
  );
  const draft = version?.status === "draft";
  const matches = (item: Row) =>
    `${item.name} ${item.code}`
      .toLocaleLowerCase("de")
      .includes(query.toLocaleLowerCase("de").trim());
  useEffect(() => {
    let active = true;
    all("people", "kind=teacher")
      .then((rows) => {
        if (active) setTeachers(rows);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [data]);
  useEffect(() => {
    let active = true;
    setReport(null);
    if (version)
      api(`studyversions/${version.id}/check/`)
        .then((result) => {
          if (active) setReport(result);
        })
        .catch((err) => {
          if (active) setError(err.message);
        });
    return () => {
      active = false;
    };
  }, [version, data]);
  const defaults = (prefix: string) => ({
    code: `${prefix}-${Date.now().toString(36)}`,
  });
  async function action(
    path: string,
    body: Row,
    success: (result: Row) => void,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api(path, "POST", body);
      onChanged();
      success(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function moduleTree(parent: number | null, depth = 0): ReactNode {
    if (depth > 20) return null;
    return modules
      .filter((item) => (item.parent || null) === parent)
      .map((module) => (
        <div className="study-module" key={module.id}>
          <div className="study-module-heading">
            <div>
              <strong>{module.name}</strong>
              <span>
                {module.credits} CP
                {module.prerequisites.length > 0 &&
                  ` · Voraussetzung: ${module.prerequisites.map((id: number) => modules.find((item) => item.id === id)?.name).join(", ")}`}
              </span>
            </div>
            <div className="study-inline-actions">
              <button
                className="button ghost"
                disabled={!draft}
                onClick={() => onEdit("modules", module)}
              >
                Modul bearbeiten
              </button>
              <button
                className="button ghost"
                disabled={!draft}
                onClick={() =>
                  onEdit("modules", undefined, {
                    ...defaults("MOD"),
                    study_version: version!.id,
                    parent: module.id,
                  })
                }
              >
                Teilmodul hinzufügen
              </button>
              <button
                className="button secondary"
                disabled={!draft}
                onClick={() =>
                  onEdit("teachingunits", undefined, {
                    ...defaults("LV"),
                    module: module.id,
                  })
                }
              >
                Lehrveranstaltung hinzufügen
              </button>
            </div>
          </div>
          {units
            .filter((unit) => unit.module === module.id)
            .map((unit) => (
              <button
                className="study-unit"
                key={unit.id}
                disabled={!draft}
                onClick={() => onEdit("teachingunits", unit)}
              >
                <strong>{unit.name}</strong>
                <span>
                  Semester {unit.semester} · {unit.target_units} UE{" "}
                  {unit.target_mode === "weekly" ? "pro Woche" : "insgesamt"} ·{" "}
                  {unit.duration_minutes} Min./Termin
                  {unit.group_mode === "per_group"
                    ? " · je Gruppe"
                    : " · gemeinsam"}
                  {unit.elective ? " · Wahlpflicht" : ""}
                </span>
              </button>
            ))}
          {moduleTree(module.id, depth + 1)}
        </div>
      ));
  }
  async function submitCopy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    await action(
      `studyversions/${version!.id}/clone/`,
      Object.fromEntries(fields),
      (result) => {
        setVersionId(result.id);
        setCopy(false);
        setMessage(
          "Neue Version als Entwurf angelegt. Bestehende Jahrgänge behalten ihre Version.",
        );
      },
    );
  }
  const steps = [
    "Räume",
    "Lehrende",
    "Studiengänge",
    "Studienstruktur",
    "Jahrgänge",
    "Semester planen",
  ];
  return (
    <section
      className="study-setup"
      aria-label="Einrichtung und Studienstruktur"
    >
      <nav className="study-steps" aria-label="Einrichtungsschritte">
        {steps.map((label, index) => (
          <button
            key={label}
            aria-current={step === index ? "step" : undefined}
            aria-label={`Schritt ${index + 1}: ${label}`}
            onClick={() => {
              setStep(index);
              setError("");
              setMessage("");
            }}
          >
            <span>{index + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      {step >= 2 && (
        <div className="study-context">
          <label>
            Studien-/Bildungsgang
            <select
              aria-label="Studien-/Bildungsgang"
              value={program?.id || ""}
              onChange={(e) => {
                setProgramId(Number(e.target.value));
                setVersionId(0);
                setCohortId(0);
              }}
            >
              <option value="">Auswählen</option>
              {data.programs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {step >= 3 && (
            <label>
              Lehrplanversion
              <select
                aria-label="Lehrplanversion"
                value={version?.id || ""}
                onChange={(e) => {
                  setVersionId(Number(e.target.value));
                  setCohortId(0);
                }}
              >
                <option value="">Auswählen</option>
                {versions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ·{" "}
                    {item.status === "approved" ? "Freigegeben" : "Entwurf"}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
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
      {step === 0 && (
        <div className="study-panel">
          <h2>Räume einrichten</h2>
          <p>
            Vorhandene Bezeichnungen übernehmen. Kapazität und Ausstattung
            werden später bei der Planung berücksichtigt.
          </p>
          <div className="study-facts">
            <span>{data.buildings.length} Bereiche</span>
            <span>{data.floors.length} Stockwerke</span>
            <span>{data.rooms.length} Räume</span>
          </div>
          <button className="button primary" onClick={onOpenRooms}>
            Räume verwalten
          </button>
        </div>
      )}
      {step === 1 && (
        <div className="study-panel">
          <div className="study-heading">
            <div>
              <h2>Lehrende und Verfügbarkeiten</h2>
              <p>
                Die Studienverwaltung pflegt die abgestimmten Zeiten. Diese
                gelten für Unterricht und Prüfungsaufsichten.
              </p>
            </div>
            <button
              className="button primary"
              onClick={() =>
                onEdit("people", undefined, {
                  ...defaults("LEHR"),
                  kind: "teacher",
                })
              }
            >
              Lehrende hinzufügen
            </button>
          </div>
          <div className="study-card-grid">
            {teachers.filter(matches).map((person) => (
              <button
                className="study-card"
                key={person.id}
                onClick={() => onEdit("people", person)}
              >
                <strong>{person.name}</strong>
                <span>
                  {person.availability?.windows
                    ? `${person.availability.windows.length} Zeitfenster`
                    : "Wöchentliche Verfügbarkeit"}
                </span>
                <span>Verfügbarkeit bearbeiten</span>
              </button>
            ))}
          </div>
          {!teachers.length && <p>Noch keine Lehrenden angelegt.</p>}
        </div>
      )}
      {step === 2 && (
        <div className="study-panel">
          <div className="study-heading">
            <div>
              <h2>Studiengang und Lehrplanversion</h2>
              <p>
                Die Version enthält die gültige Studienstruktur. Neue Versionen
                verändern keine bestehenden Jahrgänge.
              </p>
            </div>
            <button
              className="button primary"
              onClick={() =>
                onEdit("programs", undefined, { ...defaults("SG") })
              }
            >
              Studiengang hinzufügen
            </button>
          </div>
          {program && (
            <>
              <div className="study-heading">
                <p>
                  {program.name} · {program.duration_semesters} Semester ·{" "}
                  {program.total_credits} CP
                </p>
                <button
                  className="button secondary"
                  onClick={() => onEdit("programs", program)}
                >
                  Studiengang bearbeiten
                </button>
              </div>
              <button
                className="button secondary"
                onClick={() =>
                  onEdit("studyversions", undefined, {
                    ...defaults("LP"),
                    program: program.id,
                    version: String(DateTime.now().setZone(zone).year),
                    duration_semesters: program.duration_semesters,
                    total_credits: program.total_credits,
                  })
                }
              >
                Lehrplanversion hinzufügen
              </button>
              <div className="study-card-grid">
                {versions.filter(matches).map((item) => (
                  <button
                    className="study-card"
                    key={item.id}
                    onClick={() => {
                      setVersionId(item.id);
                      setStep(3);
                    }}
                  >
                    <strong>{item.name}</strong>
                    <span>
                      Version {item.version} · {item.duration_semesters}{" "}
                      Semester · {item.total_credits} CP
                    </span>
                    <span>
                      {item.status === "approved" ? "Freigegeben" : "Entwurf"}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {step === 3 && (
        <div className="study-panel">
          <div className="study-heading">
            <div>
              <h2>Module und Semesterfolge</h2>
              <p>
                Credit Points zählen über die Obermodule. Unterrichtsumfang und
                Fachsemester werden je Lehrveranstaltung erfasst.
              </p>
            </div>
            {version && (
              <div className="study-inline-actions">
                <button
                  className="button secondary"
                  disabled={!draft}
                  onClick={() => onEdit("studyversions", version)}
                >
                  Version bearbeiten
                </button>
                <button
                  className="button secondary"
                  onClick={() => setCopy(true)}
                >
                  Neue Version aus Kopie
                </button>
              </div>
            )}
          </div>
          {version ? (
            <>
              <details className="study-semester-overview">
                <summary>Semesterübersicht</summary>
                <div className="study-card-grid">
                  {Array.from(
                    { length: version.duration_semesters },
                    (_, index) => index + 1,
                  ).map((semester) => (
                    <div className="study-card" key={semester}>
                      <strong>{semester}. Semester</strong>
                      {units
                        .filter((unit) => unit.semester === semester)
                        .map((unit) => (
                          <span key={unit.id}>
                            {unit.name} · {unit.target_units} UE{" "}
                            {unit.target_mode === "weekly"
                              ? "pro Woche"
                              : "insgesamt"}
                          </span>
                        ))}
                      {!units.some((unit) => unit.semester === semester) && (
                        <span>Noch keine Lehrveranstaltungen</span>
                      )}
                    </div>
                  ))}
                </div>
              </details>
              <div className="study-facts">
                <span>{version.duration_semesters} Semester</span>
                <span>
                  {report?.credits ?? "…"} / {version.total_credits} CP
                </span>
                <span>
                  {version.status === "approved"
                    ? "Freigegeben · Inhalte geschützt"
                    : "Entwurf"}
                </span>
              </div>
              <button
                className="button secondary"
                disabled={!draft}
                onClick={() =>
                  onEdit("modules", undefined, {
                    ...defaults("MOD"),
                    study_version: version.id,
                  })
                }
              >
                Obermodul hinzufügen
              </button>
              <div className="study-module-list">{moduleTree(null)}</div>
              {report && (
                <div className="study-report">
                  <h3>Vollständigkeitsprüfung</h3>
                  {report.errors.length === 0 ? (
                    <p>
                      Studienstruktur vollständig. Lehrende können bei der
                      Semesterplanung ergänzt werden.
                    </p>
                  ) : (
                    <ul>
                      {report.errors.map((item: string) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                  {report.warnings.length > 0 && (
                    <details>
                      <summary>
                        {report.warnings.length} Hinweise zur Lehrendenzuordnung
                      </summary>
                      <ul>
                        {report.warnings.map((item: string) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
              {draft && (
                <button
                  className="button primary"
                  disabled={busy || !report || report.errors.length > 0}
                  onClick={() =>
                    action(`studyversions/${version.id}/approve/`, {}, () =>
                      setMessage(
                        "Lehrplanversion freigegeben. Jahrgänge können jetzt daran gebunden werden.",
                      ),
                    )
                  }
                >
                  Lehrplan freigeben
                </button>
              )}
            </>
          ) : (
            <p>Zuerst eine Lehrplanversion unter Studiengänge anlegen.</p>
          )}
        </div>
      )}
      {step === 4 && (
        <div className="study-panel">
          <div className="study-heading">
            <div>
              <h2>Jahrgang und Gruppen</h2>
              <p>
                Jeder neue Jahrgang erhält eine feste freigegebene
                Lehrplanversion. Studierende werden anschließend ihren Gruppen
                zugeordnet.
              </p>
            </div>
            <button
              className="button primary"
              disabled={version?.status !== "approved"}
              onClick={() =>
                onEdit("cohorts", undefined, {
                  ...defaults("JG"),
                  program: program!.id,
                  study_version: version!.id,
                  entry_year: DateTime.now().setZone(zone).year + 1,
                })
              }
            >
              Jahrgang hinzufügen
            </button>
          </div>
          {!version || version.status !== "approved" ? (
            <p>Zuerst eine vollständige Lehrplanversion freigeben.</p>
          ) : (
            <>
              <label className="study-select">
                Jahrgang
                <select
                  value={cohort?.id || ""}
                  onChange={(e) => setCohortId(Number(e.target.value))}
                >
                  <option value="">Auswählen</option>
                  {cohorts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {cohort && (
                <>
                  <div className="study-inline-actions">
                    <button
                      className="button secondary"
                      onClick={() => onEdit("cohorts", cohort)}
                    >
                      Jahrgang bearbeiten
                    </button>
                    <button
                      className="button secondary"
                      onClick={() =>
                        onEdit("groups", undefined, {
                          ...defaults("GR"),
                          cohort: cohort.id,
                        })
                      }
                    >
                      Gruppe hinzufügen
                    </button>
                  </div>
                  <div className="study-card-grid">
                    {data.groups
                      .filter((item) => item.cohort === cohort.id)
                      .map((group) => (
                        <div className="study-card" key={group.id}>
                          <strong>{group.name}</strong>
                          <span>{group.size} vorgesehene Plätze</span>
                          <button
                            className="button secondary"
                            onClick={() => onEdit("groups", group)}
                          >
                            Gruppe bearbeiten
                          </button>
                          <button
                            className="button secondary"
                            onClick={() => onOpenStudents(group.id)}
                          >
                            Studierendenliste verwalten
                          </button>
                          <button
                            className="button secondary"
                            onClick={() =>
                              onEdit("people", undefined, {
                                ...defaults("ST"),
                                kind: "learner",
                                groups: [group.id],
                              })
                            }
                          >
                            Studierende hinzufügen
                          </button>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
      {step === 5 && (
        <div className="study-panel">
          <div className="study-heading">
            <div>
              <h2>Semester vorbereiten</h2>
              <p>
                Zeitraum und Fachsemester festlegen. Veranstaltungen werden
                einmalig übernommen; Lehrende und Wahlpflichtbelegungen lassen
                sich im Plan anpassen.
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() =>
                onEdit("periods", undefined, { ...defaults("ZEIT") })
              }
            >
              Zeitraum hinzufügen
            </button>
          </div>
          <label className="study-select">
            Jahrgang
            <select
              value={cohort?.id || ""}
              onChange={(e) => setCohortId(Number(e.target.value))}
            >
              <option value="">Auswählen</option>
              {cohorts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="study-inline-actions">
            <button
              className="button secondary"
              onClick={() =>
                onEdit("areas", undefined, { ...defaults("PLAN") })
              }
            >
              Planungsbereich hinzufügen
            </button>
            <button
              className="button primary"
              disabled={!cohort || version?.status !== "approved"}
              onClick={() =>
                onEdit("plans", undefined, {
                  ...defaults("PLAN"),
                  cohort: cohort!.id,
                  semester: 1,
                  ...(data.areas[0] ? { area: data.areas[0].id } : {}),
                })
              }
            >
              Semesterplan hinzufügen
            </button>
          </div>
          <div className="study-card-grid">
            {data.plans
              .filter((item) => item.cohort === cohort?.id)
              .map((plan) => (
                <div className="study-card" key={plan.id}>
                  <strong>{plan.name}</strong>
                  <span>
                    Fachsemester {plan.semester} ·{" "}
                    {data.periods.find((item) => item.id === plan.period)?.name}
                  </span>
                  <button
                    className="button secondary"
                    onClick={() => onEdit("plans", plan)}
                  >
                    Plan bearbeiten
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      action(`plans/${plan.id}/prepare/`, {}, (result) =>
                        setMessage(
                          `${result.created} Veranstaltungen übernommen; ${result.existing} vorhandene erhalten.${result.warnings.length ? " " + result.warnings.join(" ") : ""}`,
                        ),
                      )
                    }
                  >
                    Veranstaltungen übernehmen
                  </button>
                  <button
                    className="button primary"
                    onClick={() => onOpenPlan(plan.id)}
                  >
                    Stundenplanung öffnen
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
      <div className="study-step-footer">
        <button
          className="button secondary"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
        >
          Zurück
        </button>
        {step < 5 && (
          <button className="button primary" onClick={() => setStep(step + 1)}>
            Weiter: {steps[step + 1]}
          </button>
        )}
      </div>
      {copy && (
        <Modal
          title="Neue Lehrplanversion"
          subtitle="Die bestehende Version und ihre Jahrgänge bleiben erhalten."
          onClose={() => setCopy(false)}
        >
          <form className="record-form" onSubmit={submitCopy}>
            <div className="form-grid">
              <label>
                Kennung
                <input
                  name="code"
                  required
                  maxLength={80}
                  defaultValue={`LP-${Date.now().toString(36)}`}
                />
              </label>
              <label>
                Versionsbezeichnung
                <input name="version" required maxLength={80} />
              </label>
              <label>
                Name
                <input name="name" required maxLength={200} />
              </label>
            </div>
            {error && <div className="error-box">{error}</div>}
            <footer>
              <button
                className="button secondary"
                type="button"
                onClick={() => setCopy(false)}
              >
                Abbrechen
              </button>
              <button className="button primary" disabled={busy}>
                Kopie anlegen
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </section>
  );
}
