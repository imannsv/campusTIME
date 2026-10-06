import { useState, useEffect, useRef, FormEvent } from "react";
import { DateTime } from "luxon";
import {
  X,
  Search,
  Plus,
  Trash2,
  Upload,
  Check,
  LoaderCircle,
} from "lucide-react";
import { api, Field, Row, labels, localInput } from "./api";
import { timedAssessment } from "./assessment";

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const controls = () =>
      Array.from(
        section.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
        ) || [],
      ).filter((el) => el.offsetParent !== null);
    controls()[0]?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const elements = controls(),
          first = elements[0],
          last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", listener);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={section}
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Schließen"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Relation({
  resource,
  value,
  onChange,
  many = false,
  kind,
  filters = {},
}: {
  resource: string;
  value: any;
  onChange: (v: any) => void;
  many?: boolean;
  kind?: string;
  filters?: Row;
}) {
  const [options, setOptions] = useState<Row[]>([]),
    [selected, setSelected] = useState<Row[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState("");
  const ids: number[] = many ? value || [] : value ? [Number(value)] : [];
  const filterQuery = new URLSearchParams(filters).toString();
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      api(
        `${resource}/?search=${encodeURIComponent(query)}${kind ? "&kind=" + kind : ""}&${filterQuery}`,
      )
        .then((r) => {
          if (live) setOptions(r.results);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    }, 150);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [resource, query, kind, filterQuery]);
  useEffect(() => {
    let live = true;
    Promise.all(ids.map((id) => api(`${resource}/${id}/`)))
      .then((rows) => {
        if (live) setSelected(rows);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [resource, JSON.stringify(ids)]);
  return (
    <div className="relation-picker">
      {many && (
        <div className="selected-chips">
          {selected.map((o) => (
            <button
              type="button"
              key={o.id}
              onClick={() => onChange(ids.filter((id) => id !== o.id))}
            >
              {o.name || o.code}
              <X size={12} />
            </button>
          ))}
        </div>
      )}
      <div className="relation-search">
        <Search size={14} />
        <input
          aria-label={`${labels[resource]} suchen`}
          placeholder="Suchen …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <select
        aria-label={labels[resource]}
        value={many ? "" : value || ""}
        onChange={(e) => {
          const id = Number(e.target.value);
          onChange(many ? [...new Set([...ids, id])] : id || null);
          if (many) setQuery("");
        }}
      >
        <option value="">{many ? "Hinzufügen …" : "Auswählen …"}</option>
        {[...new Map([...selected, ...options].map((o) => [o.id, o])).values()]
          .filter((o) => !many || !ids.includes(o.id))
          .map((o) => (
            <option key={o.id} value={o.id}>
              {o.name || o.code || `Termin ${o.id}`}
            </option>
          ))}
      </select>
      {error && <small className="error">{error}</small>}
    </div>
  );
}

function CurriculumEditor({
  value,
  onChange,
}: {
  value: Row[];
  onChange: (v: Row[]) => void;
}) {
  const rows = Array.isArray(value) ? value : [];
  const update = (i: number, key: string, v: any) =>
    onChange(rows.map((r, n) => (n === i ? { ...r, [key]: v } : r)));
  return (
    <div className="curriculum-editor">
      {rows.map((r, i) => (
        <div className="curriculum-line" key={i}>
          <input
            aria-label="Fachname"
            placeholder="Fach / Modul"
            value={r.name || ""}
            onChange={(e) => update(i, "name", e.target.value)}
          />
          <select
            aria-label="Sollart"
            value={r.target_mode}
            onChange={(e) => update(i, "target_mode", e.target.value)}
          >
            <option value="weekly">Pro Woche</option>
            <option value="total">Gesamtumfang</option>
          </select>
          <input
            aria-label="Sollumfang"
            type="number"
            min="1"
            value={r.target_units}
            onChange={(e) => update(i, "target_units", Number(e.target.value))}
          />
          <input
            aria-label="Termindauer"
            type="number"
            min="1"
            value={r.duration_minutes}
            onChange={(e) =>
              update(i, "duration_minutes", Number(e.target.value))
            }
          />
          <button
            type="button"
            className="icon-button"
            aria-label="Fach entfernen"
            onClick={() => onChange(rows.filter((_, n) => n !== i))}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <small>Umfang in Unterrichtseinheiten, Termindauer in Minuten.</small>
      <button
        type="button"
        className="button secondary"
        onClick={() =>
          onChange([
            ...rows,
            {
              name: "",
              target_mode: "weekly",
              target_units: 2,
              duration_minutes: 90,
            },
          ])
        }
      >
        <Plus size={15} />
        Fach hinzufügen
      </button>
    </div>
  );
}
function EquipmentEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [text, setText] = useState(value.join(", "));
  return (
    <>
      <input
        aria-label="Ausstattung"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(
            e.target.value
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          );
        }}
      />
      <small>Ausstattung mit Komma trennen, zum Beispiel Beamer, PC.</small>
    </>
  );
}

function TeamEditor({
  value,
  teachers,
  onChange,
}: {
  value: number[][];
  teachers: number[];
  onChange: (v: number[][]) => void;
}) {
  const [people, setPeople] = useState<Row[]>([]);
  useEffect(() => {
    let live = true;
    Promise.all(teachers.map((id) => api(`people/${id}/`)))
      .then((rows) => {
        if (live) setPeople(rows);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [JSON.stringify(teachers)]);
  return (
    <div className="team-editor">
      <small>
        Ohne einzelne Teams unterrichten alle zugeordneten Lehrenden gemeinsam.
        Die Terminreihenfolge ist chronologisch.
      </small>
      {value.map((team, i) => (
        <div className="team-row" key={i}>
          <strong>Termin {i + 1}</strong>
          <div>
            {people.map((person) => (
              <span key={person.id}>
                <input
                  type="checkbox"
                  aria-label={`Termin ${i + 1}: ${person.name}`}
                  checked={team.includes(person.id)}
                  onChange={(e) =>
                    onChange(
                      value.map((row, n) =>
                        n === i
                          ? e.target.checked
                            ? [...row, person.id]
                            : row.filter((id) => id !== person.id)
                          : row,
                      ),
                    )
                  }
                />
                {person.name}
              </span>
            ))}
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={`Team ${i + 1} entfernen`}
            onClick={() => onChange(value.filter((_, n) => n !== i))}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={!teachers.length}
        className="button secondary"
        onClick={() => onChange([...value, [...teachers]])}
      >
        <Plus size={15} />
        Terminteams festlegen
      </button>
    </div>
  );
}

function AvailabilityEditor({
  value,
  onChange,
  zone,
}: {
  value: Row;
  onChange: (v: Row) => void;
  zone: string;
}) {
  const a = value || {};
  const windows: Row[] =
    a.windows ??
    (a.weekdays ?? [0, 1, 2, 3, 4]).map((weekday: number) => ({
      weekday,
      from: a.from || "08:00",
      to: a.to || "18:00",
    }));
  const exclusions: Row[] = a.exclusions || [];
  const setWindows = (items: Row[]) => onChange({ ...a, windows: items });
  return (
    <div className="availability-editor">
      <small>
        Die Studienverwaltung trägt die mit den Lehrenden abgestimmten Zeiten
        ein. Mehrere Zeitfenster je Tag sind möglich. Ohne Zeitfenster ist die
        Person nicht verfügbar.
      </small>
      {a.test_assumption && (
        <small className="availability-assumption">{a.test_assumption}</small>
      )}
      {windows.map((window, index) => (
        <div className="availability-window" key={index}>
          <select
            aria-label={`Zeitfenster ${index + 1}: Wochentag`}
            value={window.weekday}
            onChange={(e) =>
              setWindows(
                windows.map((row, i) =>
                  i === index
                    ? { ...row, weekday: Number(e.target.value) }
                    : row,
                ),
              )
            }
          >
            {[
              "Montag",
              "Dienstag",
              "Mittwoch",
              "Donnerstag",
              "Freitag",
              "Samstag",
              "Sonntag",
            ].map((day, i) => (
              <option value={i} key={i}>
                {day}
              </option>
            ))}
          </select>
          <input
            aria-label={`Zeitfenster ${index + 1}: Beginn`}
            type="time"
            required
            value={window.from}
            onChange={(e) =>
              setWindows(
                windows.map((row, i) =>
                  i === index ? { ...row, from: e.target.value } : row,
                ),
              )
            }
          />
          <input
            aria-label={`Zeitfenster ${index + 1}: Ende`}
            type="time"
            required
            value={window.to}
            onChange={(e) =>
              setWindows(
                windows.map((row, i) =>
                  i === index ? { ...row, to: e.target.value } : row,
                ),
              )
            }
          />
          <button
            className="button secondary"
            type="button"
            aria-label={`Zeitfenster ${index + 1} entfernen`}
            onClick={() => setWindows(windows.filter((_, i) => i !== index))}
          >
            Entfernen
          </button>
        </div>
      ))}
      <button
        type="button"
        className="button secondary"
        onClick={() =>
          setWindows([...windows, { weekday: 0, from: "08:00", to: "12:00" }])
        }
      >
        Zeitfenster hinzufügen
      </button>
      <strong>Zusätzliche Sperrzeiten</strong>
      {exclusions.map((entry, index) => (
        <div className="availability-window exclusions" key={index}>
          <input
            type="datetime-local"
            required
            aria-label={`Sperrzeit ${index + 1}: Beginn`}
            value={localInput(entry.start, zone)}
            onChange={(e) =>
              onChange({
                ...a,
                exclusions: exclusions.map((row, i) =>
                  i === index
                    ? {
                        ...row,
                        start: DateTime.fromISO(e.target.value, {
                          zone,
                        }).toISO(),
                      }
                    : row,
                ),
              })
            }
          />
          <input
            type="datetime-local"
            required
            aria-label={`Sperrzeit ${index + 1}: Ende`}
            value={localInput(entry.end, zone)}
            onChange={(e) =>
              onChange({
                ...a,
                exclusions: exclusions.map((row, i) =>
                  i === index
                    ? {
                        ...row,
                        end: DateTime.fromISO(e.target.value, { zone }).toISO(),
                      }
                    : row,
                ),
              })
            }
          />
          <button
            className="button secondary"
            type="button"
            aria-label={`Sperrzeit ${index + 1} entfernen`}
            onClick={() =>
              onChange({
                ...a,
                exclusions: exclusions.filter((_, i) => i !== index),
              })
            }
          >
            Entfernen
          </button>
        </div>
      ))}
      <button
        type="button"
        className="button secondary"
        onClick={() => {
          const start = DateTime.now().setZone(zone).startOf("hour");
          onChange({
            ...a,
            exclusions: [
              ...exclusions,
              { start: start.toISO(), end: start.plus({ hours: 1 }).toISO() },
            ],
          });
        }}
      >
        Sperrzeit hinzufügen
      </button>
    </div>
  );
}

function FreeDaysEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [from, setFrom] = useState(""),
    [until, setUntil] = useState("");
  const length = DateTime.fromISO(until).diff(
    DateTime.fromISO(from),
    "days",
  ).days;
  return (
    <div className="free-days-editor">
      <div className="form-row">
        <input
          type="date"
          aria-label="Unterrichtsfrei ab"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          type="date"
          aria-label="Unterrichtsfrei bis"
          value={until}
          onChange={(e) => setUntil(e.target.value)}
        />
        <button
          type="button"
          className="button secondary"
          disabled={!Number.isFinite(length) || length < 0 || length > 550}
          onClick={() => {
            const days = Array.from(
              { length: Math.floor(length) + 1 },
              (_, index) =>
                DateTime.fromISO(from).plus({ days: index }).toISODate()!,
            );
            onChange([...new Set([...value, ...days])].sort());
            setFrom("");
            setUntil("");
          }}
        >
          Freie Tage hinzufügen
        </button>
      </div>
      <div className="selected-chips">
        {value.map((day) => (
          <button
            type="button"
            key={day}
            onClick={() => onChange(value.filter((item) => item !== day))}
            aria-label={`${day} als freien Tag entfernen`}
          >
            {DateTime.fromISO(day).setLocale("de").toFormat("dd.MM.yyyy")} ×
          </button>
        ))}
      </div>
      <small>
        Einzelne Tage oder ganze Ferienzeiträume hinzufügen. Zum Entfernen einen
        Tag anklicken.
      </small>
    </div>
  );
}

export function RecordForm({
  resource,
  fields,
  record,
  defaults = {},
  zone,
  onClose,
  onSaved,
}: {
  resource: string;
  fields: Field[];
  record?: Row;
  defaults?: Row;
  zone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial: Row = {};
  fields.forEach((f) => {
    const value = record?.[f.name] ?? defaults[f.name] ?? f.default;
    initial[f.name] =
      f.type === "datetime-local"
        ? localInput(value, zone)
        : f.type === "json" && !["items", "availability"].includes(f.name)
          ? JSON.stringify(value, null, 2)
          : value;
  });
  const [values, setValues] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (key: string, value: any) =>
    setValues((v) => ({
      ...v,
      [key]: value,
      ...(key === "program" && resource === "cohorts"
        ? { study_version: null }
        : {}),
      ...(key === "assessment_type" &&
      ["modules", "assessments"].includes(resource)
        ? {
            assessment_duration_minutes: timedAssessment(value)
              ? v.assessment_duration_minutes || 90
              : null,
            ...(timedAssessment(value) && resource === "assessments"
              ? { due_at: "" }
              : {}),
          }
        : {}),
    }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body: Row = {};
      for (const f of fields) {
        if (["file"].includes(f.type)) continue;
        let value = values[f.name];
        if (f.type === "json" && !["items", "availability"].includes(f.name))
          value = JSON.parse(value || "null");
        if (f.type === "datetime-local") {
          value = value ? DateTime.fromISO(value, { zone }).toISO() : null;
          if (!value && f.required) throw new Error("Zeitpunkt ist ungültig.");
        }
        if (f.type === "number")
          value = value === "" || value == null ? null : Number(value);
        if (value === "" && ["relation", "date"].includes(f.type)) value = null;
        body[f.name] = value;
      }
      await api(
        `${resource}/${record ? record.id + "/" : ""}`,
        record ? "PATCH" : "POST",
        body,
      );
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api(`${resource}/${record!.id}/`, "DELETE");
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal
      title={record ? "Eintrag bearbeiten" : `${labels[resource]} hinzufügen`}
      subtitle={
        defaults.assessment_template
          ? "Prüfungsvorlage übernehmen. Teilnehmer, Zeitraum und Aufsichten prüfen."
          : "Änderungen werden im Entwurf gespeichert."
      }
      onClose={onClose}
      wide={resource === "courses" || resource === "exams"}
    >
      <form onSubmit={submit} className="record-form">
        {defaults._draft_warnings?.length > 0 && (
          <div className="info-note">
            <p>{defaults._draft_warnings.join(" ")}</p>
          </div>
        )}
        <div className="form-grid">
          {fields
            .filter(
              (f) =>
                ![
                  "file",
                  "geometry",
                  "polygon",
                  "longitude",
                  "latitude",
                  "teaching_unit",
                  "study_group",
                  "assessment_template",
                ].includes(f.type === "file" ? "file" : f.name) &&
                !(
                  resource === "assessments" &&
                  ["plan", "module"].includes(f.name)
                ) &&
                !(
                  f.name === "due_at" && timedAssessment(values.assessment_type)
                ) &&
                (f.name !== "assessment_duration_minutes" ||
                  timedAssessment(values.assessment_type)),
            )
            .map((f) => (
              <label
                key={f.name}
                className={
                  ["json", "many"].includes(f.type) ||
                  f.name === "assessment_notes"
                    ? "full"
                    : ""
                }
              >
                <span>
                  {labels[f.name] || f.name}
                  {(f.required || f.name === "assessment_duration_minutes") && (
                    <b className="required"> *</b>
                  )}
                </span>
                {f.type === "relation" || f.type === "many" ? (
                  <Relation
                    resource={f.resource!}
                    filters={
                      f.name === "study_version" && resource === "cohorts"
                        ? {
                            program: String(values.program || 0),
                            status: "approved",
                          }
                        : f.name === "course" && resource === "exams"
                          ? { plan: String(values.plan || 0) }
                          : ["parent", "prerequisites"].includes(f.name)
                            ? {
                                study_version: String(
                                  values.study_version || 0,
                                ),
                              }
                            : {}
                    }
                    value={values[f.name]}
                    many={f.type === "many"}
                    kind={
                      ["teachers", "supervisors"].includes(f.name)
                        ? "teacher"
                        : f.name === "learners"
                          ? "learner"
                          : undefined
                    }
                    onChange={(v) => change(f.name, v)}
                  />
                ) : f.name === "items" ? (
                  <CurriculumEditor
                    value={values.items}
                    onChange={(v) => change("items", v)}
                  />
                ) : f.name === "availability" ? (
                  <AvailabilityEditor
                    value={values.availability}
                    zone={zone}
                    onChange={(v) => change("availability", v)}
                  />
                ) : f.name === "teacher_assignments" ? (
                  <TeamEditor
                    value={JSON.parse(values.teacher_assignments || "[]")}
                    teachers={values.teachers || []}
                    onChange={(v) =>
                      change("teacher_assignments", JSON.stringify(v))
                    }
                  />
                ) : f.name === "equipment" ? (
                  <EquipmentEditor
                    value={JSON.parse(values.equipment || "[]")}
                    onChange={(v) => change("equipment", JSON.stringify(v))}
                  />
                ) : f.name === "assessment_notes" ? (
                  <>
                    <textarea
                      aria-label={labels[f.name]}
                      value={values.assessment_notes || ""}
                      onChange={(e) => change(f.name, e.target.value)}
                      maxLength={2000}
                      rows={3}
                      placeholder="Zum Beispiel Umfang, Hilfsmittel oder Abgabe vier Wochen nach Themenausgabe"
                    />
                    <small>
                      {resource === "modules"
                        ? "Die Vorgabe gilt für dieses Modul. Konkrete Prüfungstermine und Abgabedaten werden für den jeweiligen Jahrgang festgelegt."
                        : "Anforderungen, Umfang und erlaubte Hilfsmittel für diese Prüfungsleistung."}
                    </small>
                  </>
                ) : f.name === "assessment_duration_minutes" ? (
                  <>
                    <input
                      aria-label={labels[f.name]}
                      type="number"
                      min="1"
                      max="1440"
                      step="1"
                      required
                      list="assessment-duration-options"
                      value={values[f.name] ?? ""}
                      onChange={(e) => change(f.name, e.target.value)}
                    />
                    <datalist id="assessment-duration-options">
                      {[60, 90, 120].map((duration) => (
                        <option key={duration} value={duration} />
                      ))}
                    </datalist>
                    <small>60, 90, 120 Minuten oder eine andere Dauer.</small>
                  </>
                ) : f.type === "boolean" ? (
                  <div className="switch-row">
                    <input
                      type="checkbox"
                      checked={Boolean(values[f.name])}
                      onChange={(e) => change(f.name, e.target.checked)}
                    />
                    <small>
                      {f.name === "locked"
                        ? "Bei automatischer Umplanung erhalten"
                        : "Aktiviert"}
                    </small>
                  </div>
                ) : f.type === "choice" ? (
                  <select
                    aria-label={labels[f.name] || f.name}
                    required={f.required}
                    value={values[f.name] || ""}
                    onChange={(e) => change(f.name, e.target.value)}
                  >
                    {!values[f.name] && <option value="">Auswählen …</option>}
                    {f.choices.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                ) : f.name === "weekdays" ? (
                  <div className="day-checkboxes">
                    {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(
                      (day, index) => (
                        <label key={day}>
                          <input
                            type="checkbox"
                            aria-label={`Unterricht am ${day}`}
                            checked={JSON.parse(
                              values.weekdays || "[]",
                            ).includes(index)}
                            onChange={(e) => {
                              const days: number[] = JSON.parse(
                                values.weekdays || "[]",
                              );
                              change(
                                "weekdays",
                                JSON.stringify(
                                  e.target.checked
                                    ? [...days, index].sort()
                                    : days.filter((item) => item !== index),
                                ),
                              );
                            }}
                          />
                          {day}
                        </label>
                      ),
                    )}
                  </div>
                ) : f.name === "excluded_dates" ? (
                  <FreeDaysEditor
                    value={JSON.parse(values.excluded_dates || "[]")}
                    onChange={(days) =>
                      change("excluded_dates", JSON.stringify(days))
                    }
                  />
                ) : f.type === "json" ? (
                  <>
                    <textarea
                      value={values[f.name]}
                      onChange={(e) => change(f.name, e.target.value)}
                      rows={f.name === "teacher_assignments" ? 2 : 3}
                    />
                    <small>
                      {f.name === "equipment"
                        ? 'Zum Beispiel ["Beamer", "PC"]'
                        : f.name === "excluded_dates"
                          ? 'Zum Beispiel ["2026-12-24"]'
                          : f.name === "weekdays"
                            ? "0 = Montag, 6 = Sonntag; zum Beispiel [0,1,2,3,4]"
                            : f.name === "teacher_assignments"
                              ? "Optional: ID-Liste je Termin, zum Beispiel [[1],[2]]. Leer = gesamtes Team."
                              : ""}
                    </small>
                  </>
                ) : (
                  <input
                    required={f.required}
                    type={f.type}
                    placeholder={
                      f.name === "capacity" ? "Noch nicht erfasst" : undefined
                    }
                    min={
                      f.type === "number" &&
                      !["latitude", "longitude", "level"].includes(f.name)
                        ? f.name === "capacity"
                          ? "1"
                          : "0"
                        : undefined
                    }
                    step={
                      [
                        "longitude",
                        "latitude",
                        "credits",
                        "total_credits",
                      ].includes(f.name)
                        ? "any"
                        : undefined
                    }
                    value={values[f.name] ?? ""}
                    onChange={(e) => change(f.name, e.target.value)}
                  />
                )}
              </label>
            ))}
        </div>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <footer>
          {record && (
            <button
              type="button"
              className="button danger"
              onClick={remove}
              disabled={busy}
            >
              <Trash2 size={15} />
              Löschen
            </button>
          )}
          <div className="spacer" />
          <button type="button" className="button secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Check size={16} />
            )}
            Speichern
          </button>
        </footer>
      </form>
    </Modal>
  );
}

export function ImportModal({
  resource,
  onClose,
  onSaved,
}: {
  resource: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [preview, setPreview] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      setPreview(await api(`imports/${resource}/`, "POST", body));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    setBusy(true);
    try {
      await api(`imports/${resource}/`, "POST", { batch: preview!.batch });
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${labels[resource]} importieren`}
      subtitle="CSV oder Excel. Verknüpfungen über Kennungen; mehrere Kennungen mit | trennen."
      onClose={onClose}
      wide
    >
      <div className="modal-content">
        <a href={`/api/imports/${resource}/`} className="text-link">
          CSV-Vorlage herunterladen
        </a>
        <label className="upload-zone">
          <Upload size={26} />
          <strong>Datei auswählen</strong>
          <span>CSV (UTF-8) oder XLSX · maximal 30.000 Zeilen / 10 MB</span>
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => {
              if (e.target.files?.[0]) upload(e.target.files[0]);
            }}
          />
        </label>
        {busy && (
          <p>
            <LoaderCircle className="spin" size={16} /> Datei wird geprüft …
          </p>
        )}
        {preview && (
          <>
            <h3>
              {preview.count} Datensätze · {preview.errors.length} Fehler
            </h3>
            {preview.errors.map((e: Row) => (
              <div className="error-box" key={e.row}>
                Zeile {e.row}: {e.message}
              </div>
            ))}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {Object.keys(preview.preview[0] || {}).map((k) => (
                      <th key={k}>{labels[k] || k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((r: Row, i: number) => (
                    <tr key={i}>
                      {Object.values(r).map((v, j) => (
                        <td key={j}>{String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {error && <div className="error-box">{error}</div>}
      </div>
      <footer>
        <button className="button secondary" onClick={onClose}>
          Schließen
        </button>
        <button
          className="button primary"
          disabled={!preview?.batch || busy}
          onClick={commit}
        >
          Geprüfte Daten übernehmen
        </button>
      </footer>
    </Modal>
  );
}
