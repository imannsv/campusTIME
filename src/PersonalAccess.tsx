import { FormEvent, useEffect, useRef, useState } from "react";
import { Copy, LoaderCircle } from "lucide-react";
import { api, DEMO_MODE, Row } from "./api";
import { Modal } from "./components";
import "./personal-access.css";

export default function PersonalAccess({
  person,
  onClose,
}: {
  person: Row;
  onClose: () => void;
}) {
  const [access, setAccess] = useState<Row | null>(null);
  const [source, setSource] = useState("name");
  const [username, setUsername] = useState("");
  const [server, setServer] = useState(window.location.origin);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const credentials = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (DEMO_MODE) return;
    const controller = new AbortController();
    api(`people/${person.id}/access/`, "GET", undefined, {
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setAccess(result);
        const nextSource = result.suggestions?.name ? "name" : "identifier";
        setSource(nextSource);
        setUsername(result.username || result.suggestions?.[nextSource] || "");
        setServer(result.server || window.location.origin);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [person.id]);
  async function changeAccess(action: "create" | "reset" | "disable") {
    if (
      action !== "create" &&
      !window.confirm(
        action === "reset"
          ? "Passwort zurücksetzen? Das bisherige Passwort wird ungültig und alle Geräte werden abgemeldet. Ein gesperrter Zugang wird wieder aktiviert."
          : "Persönlichen Zugang sperren und alle verbundenen Geräte abmelden?",
      )
    )
      return;
    setBusy(true);
    setError("");
    setCopyStatus("");
    // Discard a previously revealed password before changing the account again.
    setAccess((current) => current && { ...current, password: undefined });
    try {
      const result = await api(`people/${person.id}/access/`, "POST", {
        action,
        ...(action !== "disable" ? { server: server.trim() } : {}),
        ...(action === "create" ? { source, username: username.trim() } : {}),
      });
      setAccess(result);
      setUsername(result.username || username);
      setServer(result.server || server);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    const text = credentials.current?.value || "";
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Zugangsdaten kopiert.");
    } catch {
      credentials.current?.focus();
      credentials.current?.select();
      try {
        if (document.execCommand("copy")) {
          setCopyStatus("Zugangsdaten kopiert.");
          return;
        }
      } catch {
        // Selected text remains available for manual copying.
      }
      setCopyStatus("Bitte den markierten Text manuell kopieren.");
    }
  }
  const credentialText = access?.password
    ? `CampusZeit · ${person.name}\nServer: ${access.server}\nBenutzername: ${access.username}\nTemporäres Passwort: ${access.password}\nBei der ersten Anmeldung muss ein eigenes Passwort vergeben werden.`
    : "";
  return (
    <Modal
      title="Persönlicher Zugang"
      subtitle={person.name}
      busy={busy}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="record-form personal-access"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void changeAccess(access?.exists ? "reset" : "create");
        }}
      >
        <p>
          Der Zugang öffnet den persönlichen Stundenplan in der App. Er vergibt
          keine Verwaltungsrechte. Es werden keine E-Mails versendet.
        </p>
        {DEMO_MODE && (
          <p className="info-note">
            Persönliche Zugänge können nur in der Verwaltungsinstanz
            eingerichtet werden. In dieser Demo sind sie nicht verfügbar.
          </p>
        )}
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        {!DEMO_MODE && !access && !error && (
          <p role="status">
            <LoaderCircle size={16} className="spin" /> Zugang laden …
          </p>
        )}
        {access && (
          <>
            {access.exists && (
              <p role="status">
                <strong>
                  {access.active ? "Zugang aktiv" : "Zugang gesperrt"}
                </strong>
                {access.password_change_required &&
                  " · Passwortwechsel erforderlich"}
              </p>
            )}
            <fieldset className="record-fields" disabled={busy}>
              <div className="form-grid">
                {!access.exists && (
                  <label className="full">
                    <span>Benutzername vorschlagen aus</span>
                    <select
                      value={source}
                      onChange={(event) => {
                        setSource(event.target.value);
                        setUsername(
                          access.suggestions?.[event.target.value] || "",
                        );
                      }}
                    >
                      <option value="name">Vorname und Nachname</option>
                      <option value="identifier">
                        Kennung / Matrikelnummer
                      </option>
                    </select>
                  </label>
                )}
                <label className="full">
                  <span>Benutzername</span>
                  <input
                    aria-label="Benutzername"
                    aria-describedby={
                      !access.exists ? "personal-username-hint" : undefined
                    }
                    required
                    autoComplete="off"
                    minLength={3}
                    maxLength={80}
                    pattern={"[a-z0-9][a-z0-9._\\-]{2,79}"}
                    value={username}
                    readOnly={access.exists}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                  {!access.exists && (
                    <small id="personal-username-hint">
                      Vorschlag anpassen: 3–80 Zeichen, kleine Buchstaben,
                      Ziffern, Punkt, Bindestrich oder Unterstrich. Mit
                      Buchstabe oder Ziffer beginnen.
                    </small>
                  )}
                </label>
                <label className="full">
                  <span>Serveradresse</span>
                  <input
                    aria-label="Serveradresse"
                    aria-describedby="personal-server-hint"
                    required
                    type="url"
                    value={server}
                    placeholder="https://campus.example.de"
                    onChange={(event) => setServer(event.target.value)}
                  />
                  <small id="personal-server-hint">
                    Eine Adresse, die vom Gerät der Person erreichbar ist.
                  </small>
                </label>
              </div>
            </fieldset>
            {access.password ? (
              <div className="personal-credentials">
                <strong>Temporäres Passwort jetzt weitergeben</strong>
                <p>
                  Dieses Passwort wird nur jetzt angezeigt. Bei der ersten
                  Anmeldung muss die Person ein eigenes Passwort vergeben. Nach
                  dem Schließen kannst du bei Bedarf ein neues temporäres
                  Passwort erstellen.
                </p>
                <label>
                  <span>Zugangsdaten zum Weitergeben</span>
                  <textarea
                    ref={credentials}
                    readOnly
                    rows={6}
                    value={credentialText}
                  />
                </label>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void copy()}
                >
                  <Copy size={16} /> Zugangsdaten kopieren
                </button>
                {copyStatus && <p role="status">{copyStatus}</p>}
              </div>
            ) : !access.exists ? (
              <p>
                Beim Erstellen wird ein temporäres Passwort einmalig angezeigt.
              </p>
            ) : (
              <p>
                Das gespeicherte Passwort kann nicht angezeigt werden. Bei
                Bedarf kannst du es zurücksetzen.
              </p>
            )}
          </>
        )}
        <footer>
          {access?.exists && (
            <button
              type="button"
              className="button danger"
              disabled={busy || !access.active}
              onClick={() => void changeAccess("disable")}
            >
              Zugang sperren
            </button>
          )}
          <div className="spacer" />
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Zurück
          </button>
          {access && (
            <button className="button primary" disabled={busy || DEMO_MODE}>
              {busy && <LoaderCircle size={16} className="spin" />}
              {access.exists ? "Passwort zurücksetzen" : "Zugang erstellen"}
            </button>
          )}
        </footer>
      </form>
    </Modal>
  );
}
