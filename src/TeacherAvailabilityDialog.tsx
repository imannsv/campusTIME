import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { DateTime } from "luxon";
import { api, type Row } from "./api";
import { AvailabilityEditor, Modal } from "./components";

export default function TeacherAvailabilityDialog({
  teacher,
  mode,
  date,
  zone,
  onClose,
  onSaved,
}: {
  teacher: Row;
  mode: "availability" | "block";
  date: string;
  zone: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [person, setPerson] = useState<Row | null>(null);
  const [availability, setAvailability] = useState<Row>({});
  const [start, setStart] = useState(`${date}T08:00`);
  const [end, setEnd] = useState(`${date}T09:00`);
  const [affected, setAffected] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const saving = useRef(false);
  const close = useCallback(() => {
    if (saving.current) return;
    if (
      dirty.current &&
      !window.confirm("Ungespeicherte Änderungen verwerfen?")
    )
      return;
    onClose();
  }, [onClose]);
  useEffect(() => {
    const controller = new AbortController();
    api(`people/${teacher.id}/`, "GET", undefined, {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) {
          setPerson(value);
          setAvailability(value.availability || {});
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, [teacher.id]);
  useEffect(() => {
    setAffected(null);
    if (mode !== "block") return;
    const from = DateTime.fromISO(start, { zone });
    const until = DateTime.fromISO(end, { zone });
    if (!from.isValid || !until.isValid || until <= from) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      start: from.toISO()!,
      end: until.toISO()!,
    });
    api(`people/${teacher.id}/block-time/?${params}`, "GET", undefined, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!controller.signal.aborted) setAffected(response.affected_count);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [mode, start, end, zone, teacher.id]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (
      mode === "block" &&
      DateTime.fromISO(end, { zone }) <= DateTime.fromISO(start, { zone })
    ) {
      setError("Ende muss nach Beginn liegen.");
      return;
    }
    saving.current = true;
    setBusy(true);
    try {
      const result =
        mode === "block"
          ? await api(`people/${teacher.id}/block-time/`, "POST", {
              start: DateTime.fromISO(start, { zone }).toISO(),
              end: DateTime.fromISO(end, { zone }).toISO(),
            })
          : await api(`people/${teacher.id}/`, "PATCH", { availability });
      dirty.current = false;
      onSaved(
        mode === "block"
          ? `Blockzeit gespeichert · ${result.cancelled_count} Termine abgesagt.`
          : "Verfügbarkeit und Blockzeiten gespeichert.",
      );
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        mode === "block" ? "Blockzeit hinzufügen" : "Verfügbarkeit bearbeiten"
      }
      subtitle={teacher.name}
      onClose={close}
      busy={busy}
    >
      <form className="teacher-availability-form" onSubmit={save}>
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        {!person ? (
          <p role="status">Lehrperson laden …</p>
        ) : mode === "availability" ? (
          <AvailabilityEditor
            value={availability}
            zone={zone}
            onChange={(value) => {
              dirty.current = true;
              setAvailability(value);
            }}
          />
        ) : (
          <>
            <label>
              Beginn
              <input
                type="datetime-local"
                required
                value={start}
                onChange={(e) => {
                  dirty.current = true;
                  setStart(e.target.value);
                }}
              />
            </label>
            <label>
              Ende
              <input
                type="datetime-local"
                required
                value={end}
                onChange={(e) => {
                  dirty.current = true;
                  setEnd(e.target.value);
                }}
              />
            </label>
            <p>
              Alle überlappenden Termine dieser Lehrperson werden abgesagt und
              bleiben rot durchgestrichen sichtbar. Bereits veröffentlichte
              Ansichten zeigen die Absage sofort.
            </p>
            <p aria-live="polite">
              {affected === null
                ? "Betroffene Termine werden geprüft …"
                : `${affected} aktive Termine betroffen.`}
            </p>
          </>
        )}
        <div className="resource-detail-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={close}
          >
            Abbrechen
          </button>
          <button className="button primary" disabled={busy || !person}>
            {busy ? "Speichern …" : "Speichern"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
