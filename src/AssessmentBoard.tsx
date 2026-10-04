import { useEffect, useRef, useState } from "react";
import { DateTime } from "luxon";
import { FileText, GraduationCap } from "lucide-react";
import { all, api, fmt, type Row } from "./api";
import { assessmentSummary, timedAssessment } from "./assessment";

export default function AssessmentBoard({
  plan,
  hasStructure,
  zone,
  refresh,
  onChanged,
  onEdit,
}: {
  plan?: Row;
  hasStructure: boolean;
  zone: string;
  refresh: number;
  onChanged: () => void;
  onEdit: (resource: string, record?: Row, defaults?: Row) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [exams, setExams] = useState<Row[]>([]);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("timed");
  const activePlan = useRef(plan?.id);
  activePlan.current = plan?.id;
  useEffect(() => {
    setMessage("");
    setTab("timed");
  }, [plan?.id]);
  useEffect(() => {
    let active = true;
    setRows([]);
    setExams([]);
    setError("");
    setLoading(true);
    if (!plan) {
      setLoading(false);
      return;
    }
    Promise.all([
      all("assessments", `plan=${plan.id}`),
      all("exams", `plan=${plan.id}`),
    ])
      .then(([requirements, actual]) => {
        if (active) {
          setRows(requirements);
          setExams(actual);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [plan?.id, refresh]);
  async function prepare() {
    const planId = plan!.id;
    setBusy(true);
    setError("");
    try {
      const result = await api(
        `plans/${planId}/prepare-assessments/`,
        "POST",
        {},
      );
      onChanged();
      const [requirements, actual] = await Promise.all([
        all("assessments", `plan=${planId}`),
        all("exams", `plan=${planId}`),
      ]);
      if (activePlan.current !== planId) return;
      setRows(requirements);
      setExams(actual);
      setMessage(
        `${result.created} Vorlagen übernommen; ${result.existing} vorhandene erhalten.${result.warnings.length ? " " + result.warnings.join(" ") : ""}`,
      );
    } catch (err) {
      if (activePlan.current === planId) setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function draft(row: Row) {
    setBusy(true);
    setError("");
    try {
      const result = await api(`assessments/${row.id}/exam_draft/`);
      if (activePlan.current !== row.plan) return;
      onEdit("exams", undefined, {
        ...result.defaults,
        _draft_warnings: result.warnings,
      });
    } catch (err) {
      if (activePlan.current === row.plan) setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const timed = rows.filter((row) => timedAssessment(row.assessment_type));
  const deadlines = rows.filter((row) => !timedAssessment(row.assessment_type));
  const visible = (tab === "timed" ? timed : deadlines).sort(
    (a, b) =>
      (a.due_at || "9999").localeCompare(b.due_at || "9999") ||
      a.name.localeCompare(b.name, "de"),
  );
  return (
    <section
      className="assessment-board"
      aria-label="Prüfungsanforderungen des Semesterplans"
    >
      <div className="study-heading">
        <div>
          <h2>Prüfungsanforderungen</h2>
          <p>
            Vorgaben aus dem Lehrplan für diesen Jahrgang und dieses
            Fachsemester.
          </p>
        </div>
        <button
          className="button secondary"
          disabled={!plan || !hasStructure || busy || loading}
          onClick={prepare}
        >
          Prüfungsanforderungen übernehmen
        </button>
      </div>
      {!hasStructure && (
        <p className="info-note">
          Dieser Semesterplan hat keine freigegebene Lehrplanversion. Prüfungen
          können unten manuell angelegt werden.
        </p>
      )}
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {message && (
        <p className="info-note" role="status">
          {message}
        </p>
      )}
      <div
        className="resource-tabs"
        role="group"
        aria-label="Prüfungsleistungen anzeigen"
      >
        <button
          className={tab === "timed" ? "active" : ""}
          aria-pressed={tab === "timed"}
          onClick={() => setTab("timed")}
        >
          <GraduationCap size={16} />
          Vorlagen & Prüfungen ({timed.length})
        </button>
        <button
          className={tab === "deadlines" ? "active" : ""}
          aria-pressed={tab === "deadlines"}
          onClick={() => setTab("deadlines")}
        >
          <FileText size={16} />
          Abgaben & Fristen ({deadlines.length})
        </button>
      </div>
      {loading ? (
        <p role="status">Prüfungsanforderungen laden …</p>
      ) : !visible.length ? (
        <p className="display-empty">
          {tab === "timed"
            ? "Noch keine zeitgebundenen Prüfungsvorlagen übernommen."
            : "Noch keine Hausarbeiten oder Abgaben übernommen."}
        </p>
      ) : (
        <div className="assessment-cards">
          {visible.map((row) => {
            const exam = exams.find(
              (item) => item.assessment_template === row.id,
            );
            const waived = row.status === "waived";
            const due = row.due_at
              ? DateTime.fromISO(row.due_at, { zone })
              : null;
            const overdue =
              !!due && due < DateTime.now().setZone(zone) && !waived;
            return (
              <article key={row.id} aria-label={row.name}>
                <div className="assessment-card-heading">
                  <h3>{row.name}</h3>
                  <span
                    className={
                      "badge " +
                      (overdue
                        ? "assessment-overdue"
                        : exam || due
                          ? "success"
                          : "")
                    }
                  >
                    {waived
                      ? "Entfällt"
                      : exam
                        ? "Prüfung angelegt"
                        : overdue
                          ? "Frist verstrichen"
                          : due
                            ? "Frist gesetzt"
                            : tab === "timed"
                              ? "Vorlage offen"
                              : "Frist offen"}
                  </span>
                </div>
                <p>{assessmentSummary(row)}</p>
                {row.assessment_notes && (
                  <p className="study-assessment-notes">
                    {row.assessment_notes}
                  </p>
                )}
                {exam && (
                  <p>
                    Prüfungszeitraum: {exam.window_start} – {exam.window_end} ·{" "}
                    {exam.duration_minutes} Minuten · {exam.learners.length}{" "}
                    Teilnehmer
                  </p>
                )}
                {due && (
                  <p className="assessment-due">
                    Abgabe:{" "}
                    <strong>
                      {fmt(row.due_at, zone, "dd.MM.yyyy · HH:mm")}
                    </strong>
                  </p>
                )}
                <div className="study-inline-actions">
                  <button
                    className="button secondary"
                    onClick={() => onEdit("assessments", row)}
                  >
                    {tab === "timed"
                      ? "Vorlage bearbeiten"
                      : "Abgabefrist bearbeiten"}
                  </button>
                  {timedAssessment(row.assessment_type) &&
                    (exam ? (
                      <button
                        className="button secondary"
                        onClick={() => onEdit("exams", exam)}
                      >
                        Prüfung bearbeiten
                      </button>
                    ) : (
                      <button
                        className="button primary"
                        disabled={busy || waived}
                        onClick={() => draft(row)}
                      >
                        Prüfung anlegen
                      </button>
                    ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
