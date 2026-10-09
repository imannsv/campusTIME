import { useState, FormEvent } from "react";
import { ArrowRight, LockKeyhole, LoaderCircle } from "lucide-react";
import { api, Row } from "./api";

export function notifyAuthChange() {
  try {
    localStorage.setItem("campuszeit-auth-event", String(Date.now()));
  } catch {
    /* Session checks still run on focus. */
  }
}

export type SessionState = {
  authenticated: boolean;
  user: string;
  role: string;
  institution: Row;
  map_style: string;
};

export function Brand() {
  return (
    <div
      className="brand"
      role="img"
      aria-label="CampusZeit"
      title="CampusZeit"
    >
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

export function Login({ onLogin }: { onLogin: (s: SessionState) => void }) {
  const [user, setUser] = useState("verwaltung"),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await api("auth/login/", "POST", {
        username: user,
        password,
      });
      notifyAuthChange();
      onLogin(session);
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
