import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { api, type Row, DEMO_MODE } from "./api";

const questions = [
  "Was fehlt in diesem Plan?",
  "Wie lege ich einen neuen Jahrgang an?",
  "Wie prüfe ich die Semesterbelastung?",
  "Wie plane ich Prüfungen und Abgaben?",
];

export default function CampusAI({
  data,
  planId,
  onPlan,
  refresh,
  onNavigate,
}: {
  data: Record<string, Row[]>;
  planId: number | null;
  onPlan: (id: number | null) => void;
  refresh: number;
  onNavigate: (page: string) => void;
}) {
  const [cohortId, setCohortId] = useState("");
  const [context, setContext] = useState<Row | null>(null),
    [status, setStatus] = useState<Row | null>(null);
  const [question, setQuestion] = useState(""),
    [messages, setMessages] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [useModel, setUseModel] = useState(false),
    [reload, setReload] = useState(0);
  const generation = useRef(0),
    conversation = useRef<HTMLDivElement>(null);
  const plan = data.plans.find((item) => item.id === planId);
  const cohort = plan?.cohort || (!planId ? Number(cohortId) || null : null);
  const selection = { plan: planId, cohort };
  const query = new URLSearchParams();
  if (planId) query.set("plan", String(planId));
  if (cohort) query.set("cohort", String(cohort));
  const selectionQuery = query.toString();
  useEffect(() => {
    let active = true;
    api("campusai/status/")
      .then((result) => {
        if (active) {
          setStatus(result);
          setUseModel((current) => result.ready && (reload === 0 || current));
        }
      })
      .catch((err) => {
        if (active) {
          setStatus({ ready: false, reason: err.message });
          setUseModel(false);
        }
      });
    return () => {
      active = false;
    };
  }, [reload]);
  useEffect(() => {
    let active = true;
    generation.current++;
    setBusy(false);
    setLoading(true);
    setError("");
    setContext(null);
    api(`campusai/context/?${selectionQuery}`)
      .then((result) => {
        if (active) setContext(result);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      generation.current++;
    };
  }, [selectionQuery, refresh, reload]);
  useEffect(() => {
    setMessages([]);
    setQuestion("");
  }, [selectionQuery]);
  useEffect(() => {
    if (conversation.current)
      conversation.current.scrollTop = conversation.current.scrollHeight;
  }, [messages, busy]);
  async function ask(value: string) {
    if (busy || loading || !context || !value.trim()) return;
    const current = generation.current;
    setBusy(true);
    setError("");
    setQuestion("");
    const history = messages
      .slice(-4)
      .map(({ role, content }) => ({ role, content: content.slice(0, 1400) }));
    setMessages((items) => [...items, { role: "user", content: value.trim() }]);
    try {
      const result = await api("campusai/chat/", "POST", {
        ...selection,
        question: value.trim(),
        history,
        use_model: useModel,
      });
      if (generation.current === current)
        setMessages((items) => [
          ...items,
          { role: "assistant", content: result.answer, ...result },
        ]);
    } catch (err) {
      if (generation.current === current) {
        setError((err as Error).message);
        setQuestion(value);
      }
    } finally {
      if (generation.current === current) setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }
  return (
    <section className="campus-ai" aria-label="campusAI Assistent">
      <div className="campus-ai-heading">
        <div>
          <h1>
            <Sparkles size={25} /> campusAI
          </h1>
          <p>Fragen beantworten und Planung prüfen.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => setReload((value) => value + 1)}
          disabled={busy}
        >
          <RefreshCw size={15} /> Hinweise aktualisieren
        </button>
      </div>
      <div className="campus-ai-context">
        <label>
          Semesterplan
          <select
            aria-label="Semesterplan für campusAI"
            value={planId || ""}
            onChange={(event) => onPlan(Number(event.target.value) || null)}
          >
            <option value="">Allgemeine Einrichtung</option>
            {data.plans.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {!planId && (
          <label>
            Jahrgang
            <select
              aria-label="Jahrgang für campusAI"
              value={cohortId}
              onChange={(event) => setCohortId(event.target.value)}
            >
              <option value="">Kein Jahrgang ausgewählt</option>
              {data.cohorts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="campus-ai-status">
          <span className={"badge " + (status?.ready ? "success" : "")}>
            {status?.ready ? "Lokale KI verbunden" : "Schnellhilfe verfügbar"}
          </span>
          <small>{status ? status.reason : "Verbindung prüfen …"}</small>
        </div>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      <div className="campus-ai-layout">
        <div className="campus-ai-chat">
          <div className="campus-ai-chat-heading">
            <h2>Frage stellen</h2>
            <label className="campus-ai-toggle">
              <input
                type="checkbox"
                checked={useModel}
                disabled={!status?.ready || busy}
                onChange={(event) => setUseModel(event.target.checked)}
              />
              Lokale KI nutzen
            </label>
          </div>
          <div className="campus-ai-questions" aria-label="Beispielfragen">
            {questions.map((value) => (
              <button
                key={value}
                disabled={busy || loading || !context}
                onClick={() => void ask(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <div
            className="campus-ai-conversation"
            ref={conversation}
            role="log"
            aria-label="campusAI Gespräch"
            aria-live="polite"
            aria-relevant="additions"
          >
            {!messages.length && (
              <p className="campus-ai-empty">
                Stelle eine Frage zu campusTIME oder zum ausgewählten Plan. Die
                Antworten ändern keine Daten.
              </p>
            )}
            {messages.map((message, index) => (
              <article
                key={index}
                className={"campus-ai-message " + message.role}
              >
                <strong>
                  {message.role === "user"
                    ? "Du"
                    : message.mode === "local"
                      ? "campusAI · lokale KI"
                      : "campusAI · Schnellhilfe"}
                </strong>
                <div className="campus-ai-answer">{message.content}</div>
                {message.service_note && (
                  <p className="campus-ai-service-note">
                    {message.service_note}
                  </p>
                )}
                {message.sources?.length > 0 && (
                  <div
                    className="campus-ai-sources"
                    aria-label="Verwendete Hilfe"
                  >
                    {message.sources.map((source: Row) => (
                      <button
                        key={source.id}
                        onClick={() => onNavigate(source.page)}
                      >
                        {source.title}
                        <ArrowRight size={12} />
                      </button>
                    ))}
                  </div>
                )}
                {message.role === "assistant" && (
                  <small>
                    Keine Daten geändert · Datenstand {message.revision}
                  </small>
                )}
              </article>
            ))}
            {busy && (
              <p className="campus-ai-working" role="status">
                <LoaderCircle className="spin" size={17} />{" "}
                {useModel
                  ? "Lokale KI formuliert eine Antwort …"
                  : "Hilfe zusammenstellen …"}
              </p>
            )}
          </div>
          <form className="campus-ai-composer" onSubmit={submit}>
            <label className="sr-only" htmlFor="campus-ai-question">
              Deine Frage an campusAI
            </label>
            <textarea
              id="campus-ai-question"
              rows={3}
              maxLength={2000}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Zum Beispiel: Warum fehlen passende Räume für meinen Plan?"
            />
            <div>
              <small>
                {DEMO_MODE
                  ? "Schnellhilfe im Browser · kein Sprachmodell verbunden"
                  : useModel
                    ? "Lokale KI · Antworten anhand der Hilfe und Hinweise prüfen"
                    : "Anleitung und geprüfte Planungshinweise"}
              </small>
              <button
                type="submit"
                className="button primary"
                disabled={busy || loading || !context || !question.trim()}
              >
                <Send size={15} />
                Frage senden
              </button>
            </div>
          </form>
          {messages.length > 0 && (
            <button
              className="campus-ai-clear"
              disabled={busy}
              onClick={() => {
                setMessages([]);
                setError("");
              }}
            >
              Gespräch leeren
            </button>
          )}
        </div>
        <aside
          className="campus-ai-insights"
          aria-label="Geprüfte Planungshinweise"
        >
          <h2>Planungshinweise</h2>
          {loading ? (
            <p role="status">Daten prüfen …</p>
          ) : (
            context && (
              <>
                <div className="campus-ai-facts">
                  <span>
                    <strong>{context.facts.rooms}</strong> Räume
                  </span>
                  <span>
                    <strong>{context.facts.teachers}</strong> Lehrende
                  </span>
                  {planId && (
                    <span>
                      <strong>{context.facts.courses}</strong> Veranstaltungen
                    </span>
                  )}
                </div>
                <p className="campus-ai-scope">
                  {context.facts.plan
                    ? context.facts.plan.name
                    : context.facts.cohort?.name || "Einrichtung"}{" "}
                  · Datenstand {context.revision}
                </p>
                {!context.notices.length && (
                  <p>
                    <CheckCircle2 size={17} /> Bei diesen Prüfungen wurden keine
                    Hinweise gefunden.
                  </p>
                )}
                <div className="campus-ai-notices">
                  {context.notices.map((item: Row, index: number) => (
                    <article
                      key={index}
                      className={item.severity === "error" ? "conflict" : ""}
                    >
                      <p>{item.text}</p>
                      <button onClick={() => onNavigate(item.page)}>
                        Bereich öffnen
                        <ArrowRight size={13} />
                      </button>
                    </article>
                  ))}
                </div>
                {context.notice_count > context.notices.length && (
                  <small>
                    {context.notices.length} von {context.notice_count}{" "}
                    Hinweisen angezeigt.
                  </small>
                )}
                {context.semesters?.length > 0 && (
                  <div className="campus-ai-semesters">
                    <h3>Semesterbelastung</h3>
                    {context.semesters.map((item: Row) => (
                      <div key={item.semester}>
                        <span>Semester {item.semester}</span>
                        <strong>{item.credits} CP</strong>
                        {item.overloaded && (
                          <span className="badge">Grenze überschritten</span>
                        )}
                      </div>
                    ))}
                    <small>Planungs-CP; keine bestandenen Leistungen.</small>
                  </div>
                )}
              </>
            )
          )}
        </aside>
      </div>
    </section>
  );
}
