import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  Send,
  MessageCircle,
  X,
  ChevronDown,
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
  refresh,
  onNavigate,
}: {
  data: Record<string, Row[]>;
  planId: number | null;
  refresh: number;
  onNavigate: (page: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activated, setActivated] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(planId);
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setSelectedPlanId(planId), [planId]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  function close() {
    setOpen(false);
    launcher.current?.focus();
  }
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
  const plan = data.plans?.find((item) => item.id === selectedPlanId);
  const cohort =
    plan?.cohort || (!selectedPlanId ? Number(cohortId) || null : null);
  const selection = { plan: selectedPlanId, cohort };
  const query = new URLSearchParams();
  if (selectedPlanId) query.set("plan", String(selectedPlanId));
  if (cohort) query.set("cohort", String(cohort));
  const selectionQuery = query.toString();
  useEffect(() => {
    if (!activated) return;
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
  }, [reload, activated]);
  useEffect(() => {
    if (!activated) return;
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
  }, [selectionQuery, refresh, reload, activated]);
  useEffect(() => {
    setMessages([]);
    setQuestion("");
  }, [selectionQuery]);
  useEffect(() => {
    if (conversation.current)
      conversation.current.scrollTop = conversation.current.scrollHeight;
  }, [messages, busy, open]);
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
    <>
      <button
        ref={launcher}
        className="campus-ai-launcher"
        aria-label={open ? "campusAI schließen" : "campusAI öffnen"}
        aria-expanded={open}
        aria-controls="campus-ai-chat"
        title="campusAI"
        onClick={() => {
          if (open) close();
          else {
            setActivated(true);
            setOpen(true);
          }
        }}
      >
        {open ? <X size={24} /> : <MessageCircle size={25} />}
      </button>
      {activated && (
        <section
          id="campus-ai-chat"
          className="campus-ai"
          hidden={!open}
          role="dialog"
          aria-modal="false"
          aria-labelledby="campus-ai-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          <header className="campus-ai-heading">
            <div className="campus-ai-identity">
              <MessageCircle size={21} />
              <div>
                <h2 id="campus-ai-title">campusAI</h2>
                <span>
                  {status?.ready ? "Lokale KI verbunden" : "Schnellhilfe"}
                </span>
              </div>
            </div>
            <button
              className="campus-ai-icon"
              aria-label="Chat schließen"
              onClick={close}
            >
              <X size={20} />
            </button>
          </header>
          <details className="campus-ai-options">
            <summary>
              Plan und Hinweise{" "}
              <span>{context ? context.notice_count : ""}</span>
              <ChevronDown size={15} />
            </summary>
            <div className="campus-ai-settings">
              <label>
                Semesterplan
                <select
                  aria-label="Semesterplan für campusAI"
                  value={selectedPlanId || ""}
                  onChange={(event) =>
                    setSelectedPlanId(Number(event.target.value) || null)
                  }
                >
                  <option value="">Allgemeine Einrichtung</option>
                  {(data.plans || []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {!selectedPlanId && (
                <label>
                  Jahrgang
                  <select
                    aria-label="Jahrgang für campusAI"
                    value={cohortId}
                    onChange={(event) => setCohortId(event.target.value)}
                  >
                    <option value="">Kein Jahrgang ausgewählt</option>
                    {(data.cohorts || []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="campus-ai-settings-actions">
                <label className="campus-ai-toggle">
                  <input
                    type="checkbox"
                    checked={useModel}
                    disabled={!status?.ready || busy}
                    onChange={(event) => setUseModel(event.target.checked)}
                  />
                  Lokale KI nutzen
                </label>
                <button
                  className="campus-ai-icon"
                  aria-label="Hinweise aktualisieren"
                  title="Hinweise aktualisieren"
                  disabled={busy}
                  onClick={() => setReload((value) => value + 1)}
                >
                  <RefreshCw size={16} />
                </button>
              </div>
              <small>{status ? status.reason : "Verbindung prüfen …"}</small>
              <aside
                className="campus-ai-insights"
                aria-label="Geprüfte Planungshinweise"
              >
                {loading ? (
                  <p role="status">Daten prüfen …</p>
                ) : (
                  context && (
                    <>
                      <p className="campus-ai-scope">
                        {context.facts.rooms} Räume · {context.facts.teachers}{" "}
                        Lehrende · Datenstand {context.revision}
                      </p>
                      {!context.notices.length && (
                        <p>
                          <CheckCircle2 size={14} /> Bei diesen Prüfungen wurden
                          keine Hinweise gefunden.
                        </p>
                      )}
                      {context.notices.map((item: Row, index: number) => (
                        <article
                          key={index}
                          className={
                            item.severity === "error" ? "conflict" : ""
                          }
                        >
                          <p>{item.text}</p>
                          <button onClick={() => onNavigate(item.page)}>
                            Bereich öffnen <ArrowRight size={12} />
                          </button>
                        </article>
                      ))}
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
                                <span>Grenze überschritten</span>
                              )}
                            </div>
                          ))}
                          <small>
                            Planungs-CP; keine bestandenen Leistungen.
                          </small>
                        </div>
                      )}
                    </>
                  )
                )}
              </aside>
            </div>
          </details>
          {error && (
            <div className="campus-ai-error" role="alert">
              {error}
            </div>
          )}
          <div
            className="campus-ai-conversation"
            ref={conversation}
            role="log"
            aria-label="campusAI Gespräch"
            aria-live="polite"
            aria-relevant="additions"
          >
            {!messages.length && (
              <div className="campus-ai-welcome">
                <p>Wie kann ich dir helfen?</p>
                <span>Fragen zu campusTIME oder deinem Plan.</span>
              </div>
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
                <LoaderCircle className="spin" size={17} />
                {useModel
                  ? "Lokale KI formuliert eine Antwort …"
                  : "Hilfe zusammenstellen …"}
              </p>
            )}
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
          <form className="campus-ai-composer" onSubmit={submit}>
            <label className="sr-only" htmlFor="campus-ai-question">
              Deine Frage an campusAI
            </label>
            <div className="campus-ai-input">
              <textarea
                ref={input}
                id="campus-ai-question"
                rows={2}
                maxLength={2000}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Nachricht an campusAI …"
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    void ask(question);
                  }
                }}
              />
              <button
                type="submit"
                aria-label="Frage senden"
                title="Frage senden"
                disabled={busy || loading || !context || !question.trim()}
              >
                <Send size={18} />
              </button>
            </div>
            <div className="campus-ai-footer">
              <small>
                {DEMO_MODE
                  ? "Schnellhilfe · kein Sprachmodell"
                  : useModel
                    ? "KI-Antworten anhand der Hilfe prüfen"
                    : "Anleitung und geprüfte Hinweise"}
              </small>
              {messages.length > 0 && (
                <button
                  type="button"
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
          </form>
        </section>
      )}
    </>
  );
}
