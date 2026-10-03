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
}: {
  resource: string;
  value: any;
  onChange: (v: any) => void;
  many?: boolean;
  kind?: string;
}) {
  const [options, setOptions] = useState<Row[]>([]),
    [selected, setSelected] = useState<Row[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState("");
  const ids: number[] = many ? value || [] : value ? [Number(value)] : [];
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      api(
        `${resource}/?search=${encodeURIComponent(query)}${kind ? "&kind=" + kind : ""}`,
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
  }, [resource, query, kind]);
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
}: {
  value: Row;
  onChange: (v: Row) => void;
}) {
  const a = value || {};
  return (
    <div className="availability-editor">
      <div className="day-checkboxes">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day, i) => (
          <label key={day}>
            <input
              type="checkbox"
              checked={(a.weekdays || [0, 1, 2, 3, 4]).includes(i)}
              onChange={(e) =>
                onChange({
                  ...a,
                  weekdays: e.target.checked
                    ? [...(a.weekdays || [0, 1, 2, 3, 4]), i]
                    : (a.weekdays || [0, 1, 2, 3, 4]).filter(
                        (n: number) => n !== i,
                      ),
                })
              }
            />
            {day}
          </label>
        ))}
      </div>
      <div className="form-row">
        <input
          aria-label="Verfügbar ab"
          type="time"
          value={a.from || "08:00"}
          onChange={(e) => onChange({ ...a, from: e.target.value })}
        />
        <input
          aria-label="Verfügbar bis"
          type="time"
          value={a.to || "18:00"}
          onChange={(e) => onChange({ ...a, to: e.target.value })}
        />
      </div>
      <small>
        Sperrzeiten als Liste von Start-/Endzeitpunkten mit Zeitzone.
      </small>
      <textarea
        aria-label="Sperrzeiten"
        defaultValue={JSON.stringify(a.exclusions || [], null, 2)}
        onBlur={(e) => {
          try {
            onChange({ ...a, exclusions: JSON.parse(e.target.value) });
          } catch {
            e.target.setCustomValidity("Gültige JSON-Liste eingeben.");
            e.target.reportValidity();
          }
        }}
        onChange={(e) => e.target.setCustomValidity("")}
      />
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
    setValues((v) => ({ ...v, [key]: value }));
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
        if (f.type === "number") value = value === "" ? null : Number(value);
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
      subtitle="Änderungen werden im Entwurf gespeichert."
      onClose={onClose}
      wide={resource === "courses" || resource === "exams"}
    >
      <form onSubmit={submit} className="record-form">
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
                ].includes(f.type === "file" ? "file" : f.name),
            )
            .map((f) => (
              <label
                key={f.name}
                className={["json", "many"].includes(f.type) ? "full" : ""}
              >
                <span>
                  {labels[f.name] || f.name}
                  {f.required && <b className="required"> *</b>}
                </span>
                {f.type === "relation" || f.type === "many" ? (
                  <Relation
                    resource={f.resource!}
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
                    min={
                      f.type === "number" &&
                      !["latitude", "longitude", "level"].includes(f.name)
                        ? "0"
                        : undefined
                    }
                    step={
                      f.name === "longitude" || f.name === "latitude"
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
