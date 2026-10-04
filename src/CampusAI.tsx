import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  MoreHorizontal,
  CalendarDays,
  Trash2,
  LoaderCircle,
  RefreshCw,
  Send,
  X,
  ChevronDown,
} from "lucide-react";
import { api, type Row, DEMO_MODE } from "./api";
import FreddyAvatar from "./FreddyAvatar";
import { actionForGuide } from "./campus-ai-actions";

const questions = [
  "Wie lege ich einen neuen Jahrgang an?",
  "Wie prüfe ich die Semesterbelastung?",
];

export default function CampusAI({
  data,
  planId,
  refresh,
  onNavigate,
  onAction,
  view,
}: {
  data: Record<string, Row[]>;
  planId: number | null;
  refresh: number;
  onNavigate: (page: string) => void;
  onAction: (id: string, selection: Row) => string;
  view: Row;
}) {
  const [open, setOpen] = useState(false);
  const [activated, setActivated] = useState(false);
  const [picker, setPicker] = useState<"plan" | "options" | null>(null);
  const panel = useRef<HTMLElement>(null);
  const planButton = useRef<HTMLButtonElement>(null);
  const optionsButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!picker) return;
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node)) setPicker(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [picker]);
  const [selectedPlanId, setSelectedPlanId] = useState(planId);
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setSelectedPlanId(planId), [planId]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  function close() {
    setPicker(null);
    setOpen(false);
    launcher.current?.focus();
  }
  const [cohortId, setCohortId] = useState("");
  const [context, setContext] = useState<Row | null>(null),
    [status, setStatus] = useState<Row | null>(null);
  const [question, setQuestion] = useState(""),
    [messages, setMessages] = useState<Row[]>([]);
  const [actionFeedback, setActionFeedback] = useState("");
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
  const selection = { plan: selectedPlanId, cohort, ...view };
  const query = new URLSearchParams();
  if (selectedPlanId) query.set("plan", String(selectedPlanId));
  if (cohort) query.set("cohort", String(cohort));
  const selectionQuery = query.toString();
  Object.entries(view).forEach(([key, value]) => {
    if (value !== null && value !== undefined) query.set(key, String(value));
  });
  const contextQuery = query.toString();
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
    api(`campusai/context/?${contextQuery}`)
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
  }, [contextQuery, refresh, reload, activated]);
  useEffect(() => {
    setMessages([]);
    setQuestion("");
    setActionFeedback("");
  }, [selectionQuery]);
  useEffect(() => {
    if (conversation.current)
      conversation.current.scrollTop =
        messages.length || busy ? conversation.current.scrollHeight : 0;
  }, [messages, busy, open]);
  function runAction(id: string) {
    setPicker(null);
    try {
      setActionFeedback(onAction(id, selection));
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function ask(value: string) {
    if (busy || loading || !context || !value.trim()) return;
    const current = generation.current;
    setBusy(true);
    setPicker(null);
    setError("");
    setActionFeedback("");
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
      if (generation.current === current) {
        setMessages((items) => [
          ...items,
          {
            role: "assistant",
            content: result.answer,
            view_label: context.view?.label,
            ...result,
          },
        ]);
        if (result.auto_action) runAction(result.auto_action);
      }
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
        aria-label={open ? "Freddy schließen" : "Freddy öffnen"}
        aria-expanded={open}
        aria-controls="campus-ai-chat"
        title="Freddy"
        onClick={() => {
          if (open) close();
          else {
            setActivated(true);
            setOpen(true);
          }
        }}
      >
        {open ? <X size={24} /> : <FreddyAvatar size={46} decorative />}
      </button>
      {activated && (
        <section
          ref={panel}
          id="campus-ai-chat"
          className="campus-ai"
          hidden={!open}
          role="dialog"
          aria-modal="false"
          aria-labelledby="campus-ai-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              if (picker) {
                (picker === "plan"
                  ? planButton
                  : optionsButton
                ).current?.focus();
                setPicker(null);
              } else close();
            }
          }}
        >
          <header className="campus-ai-heading">
            <div className="campus-ai-identity">
              <FreddyAvatar size={39} busy={busy} active={open} />
              <div>
                <h2 id="campus-ai-title">Freddy</h2>
                <span>CampusAI-Assistent</span>
              </div>
            </div>
            <div className="campus-ai-header-actions">
              <button
                ref={optionsButton}
                className="campus-ai-icon"
                aria-label="Chat-Optionen"
                aria-expanded={picker === "options"}
                aria-controls="campus-ai-menu"
                onClick={() =>
                  setPicker((value) => (value === "options" ? null : "options"))
                }
              >
                <MoreHorizontal size={20} />
              </button>
              <button
                className="campus-ai-icon"
                aria-label="Chat schließen"
                onClick={close}
              >
                <X size={20} />
              </button>
            </div>
          </header>
          <div className="campus-ai-context-line">
            <button
              ref={planButton}
              aria-label="Kontext für Freddy auswählen"
              title={
                plan?.name ||
                data.cohorts?.find((item) => String(item.id) === cohortId)
                  ?.name ||
                "Allgemeine Einrichtung"
              }
              aria-expanded={picker === "plan"}
              aria-controls="campus-ai-plan-picker"
              onClick={() =>
                setPicker((value) => (value === "plan" ? null : "plan"))
              }
            >
              <CalendarDays size={14} />
              <span>
                {plan?.name ||
                  data.cohorts?.find((item) => String(item.id) === cohortId)
                    ?.name ||
                  "Allgemeine Einrichtung"}
              </span>
              <ChevronDown size={14} />
            </button>
          </div>
          <div className="campus-ai-view" aria-live="polite">
            {context?.view?.label || "Ansicht laden …"}
          </div>
          {picker === "plan" && (
            <div
              id="campus-ai-plan-picker"
              className="campus-ai-popover campus-ai-plan-picker"
              role="group"
              aria-label="Kontext auswählen"
            >
              <button
                onClick={() => {
                  setSelectedPlanId(null);
                  setCohortId("");
                  setPicker(null);
                  planButton.current?.focus();
                }}
              >
                <span>Allgemeine Einrichtung</span>
                {!selectedPlanId && !cohortId && <Check size={14} />}
              </button>
              <p>Semesterpläne</p>
              {(data.plans || []).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedPlanId(item.id);
                    setCohortId("");
                    setPicker(null);
                    planButton.current?.focus();
                  }}
                >
                  <span>{item.name}</span>
                  {selectedPlanId === item.id && <Check size={14} />}
                </button>
              ))}
              <p>Jahrgänge</p>
              {(data.cohorts || []).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedPlanId(null);
                    setCohortId(String(item.id));
                    setPicker(null);
                    planButton.current?.focus();
                  }}
                >
                  <span>{item.name}</span>
                  {!selectedPlanId && cohortId === String(item.id) && (
                    <Check size={14} />
                  )}
                </button>
              ))}
            </div>
          )}
          {picker === "options" && (
            <div
              id="campus-ai-menu"
              className="campus-ai-popover campus-ai-menu"
              role="group"
              aria-label="Chat-Optionen"
            >
              <p>Antworten mit</p>
              <button
                aria-pressed={useModel}
                disabled={!status?.ready || busy}
                title={!status?.ready ? status?.reason : undefined}
                onClick={() => {
                  setUseModel(true);
                  setPicker(null);
                  optionsButton.current?.focus();
                }}
              >
                <span>Lokale KI nutzen</span>
                {useModel && <Check size={14} />}
              </button>
              <button
                aria-pressed={!useModel}
                disabled={busy}
                onClick={() => {
                  setUseModel(false);
                  setPicker(null);
                  optionsButton.current?.focus();
                }}
              >
                <span>Schnellhilfe nutzen</span>
                {!useModel && <Check size={14} />}
              </button>
              <div className="campus-ai-menu-divider" />
              <button
                disabled={busy}
                onClick={() => {
                  setReload((value) => value + 1);
                  setPicker(null);
                  optionsButton.current?.focus();
                }}
              >
                <RefreshCw size={14} />
                <span>Hinweise aktualisieren</span>
              </button>
              <button
                disabled={busy || !messages.length}
                onClick={() => {
                  setMessages([]);
                  setError("");
                  setActionFeedback("");
                  setPicker(null);
                  optionsButton.current?.focus();
                }}
              >
                <Trash2 size={14} />
                <span>Gespräch leeren</span>
              </button>
            </div>
          )}
          {error && (
            <div className="campus-ai-error" role="alert">
              {error}
            </div>
          )}
          <div
            className="campus-ai-conversation"
            ref={conversation}
            role="log"
            aria-label="Freddy Gespräch"
            aria-live="polite"
            aria-relevant="additions"
          >
            {!messages.length && (
              <div className="campus-ai-welcome">
                <p>
                  Hi, ich bin Freddy, dein CampusAI-Assistent. Wie kann ich dir
                  helfen?
                </p>
                {loading ? (
                  <div className="campus-ai-situation" role="status">
                    Ich prüfe die aktuelle Ansicht …
                  </div>
                ) : (
                  context && (
                    <div className="campus-ai-situation">
                      <span>Hier kann ich dir helfen</span>
                      {context.proactive?.notices?.length ? (
                        context.proactive.notices.map(
                          (notice: Row, index: number) => (
                            <p key={index}>{notice.text}</p>
                          ),
                        )
                      ) : (
                        <p>
                          Für diese Ansicht liegen derzeit keine passenden
                          Planungshinweise vor. Ich kann dir den nächsten
                          Schritt zeigen.
                        </p>
                      )}
                      <div
                        className="campus-ai-actions"
                        aria-label="Vorschläge zur aktuellen Seite"
                      >
                        {context.proactive?.actions?.map((action: Row) => (
                          <button
                            key={action.id}
                            onClick={() => runAction(action.id)}
                          >
                            {action.label}
                            <ArrowRight size={14} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                )}
                <div
                  className="campus-ai-questions"
                  aria-label="Beispielfragen"
                >
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
              </div>
            )}
            {actionFeedback && (
              <p className="campus-ai-action-feedback" role="status">
                {actionFeedback}
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
                    : message.intent
                      ? "Freddy"
                      : message.mode === "local"
                        ? "Freddy · lokale KI"
                        : "Freddy · Schnellhilfe"}
                </strong>
                <div className="campus-ai-answer">{message.content}</div>
                {message.service_note && (
                  <p className="campus-ai-service-note">
                    {message.service_note}
                  </p>
                )}
                {message.actions?.length > 0 && (
                  <div
                    className="campus-ai-actions"
                    aria-label="Nächste Schritte"
                  >
                    {message.actions.map((action: Row) => (
                      <button
                        key={action.id}
                        onClick={() => runAction(action.id)}
                      >
                        {action.label}
                        <ArrowRight size={14} />
                      </button>
                    ))}
                  </div>
                )}
                {message.sources?.length > 0 && (
                  <div
                    className="campus-ai-sources"
                    aria-label="Verwendete Hilfe"
                  >
                    {message.sources.map((source: Row) => (
                      <button
                        key={source.id}
                        onClick={() => {
                          const action = actionForGuide(source.id);
                          if (action) runAction(action.id);
                          else onNavigate(source.page);
                        }}
                      >
                        {source.title}
                        <ArrowRight size={12} />
                      </button>
                    ))}
                  </div>
                )}
                {message.role === "assistant" && !message.intent && (
                  <small>
                    Keine Daten geändert · Datenstand {message.revision}
                  </small>
                )}
              </article>
            ))}
            {!!messages.length &&
              context &&
              messages.at(-1)?.view_label !== context.view?.label &&
              !busy && (
                <div className="campus-ai-situation campus-ai-current-view">
                  <span>Zur aktuellen Ansicht · {context.view?.label}</span>
                  <p>
                    {context.proactive?.notices?.[0]?.text ||
                      "Ich kann dir hier die nächsten Schritte zeigen."}
                  </p>
                  <div
                    className="campus-ai-actions"
                    aria-label="Vorschläge zur aktuellen Seite"
                  >
                    {context.proactive?.actions
                      ?.slice(0, 1)
                      .map((action: Row) => (
                        <button
                          key={action.id}
                          onClick={() => runAction(action.id)}
                        >
                          {action.label}
                          <ArrowRight size={14} />
                        </button>
                      ))}
                  </div>
                </div>
              )}
            {busy && (
              <p className="campus-ai-working" role="status">
                <LoaderCircle className="spin" size={17} />
                {useModel
                  ? "Lokale KI formuliert eine Antwort …"
                  : "Hilfe zusammenstellen …"}
              </p>
            )}
          </div>
          <form className="campus-ai-composer" onSubmit={submit}>
            <label className="sr-only" htmlFor="campus-ai-question">
              Deine Frage an Freddy
            </label>
            <div className="campus-ai-input">
              <textarea
                ref={input}
                id="campus-ai-question"
                rows={2}
                maxLength={2000}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Nachricht an Freddy …"
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
            </div>
          </form>
        </section>
      )}
    </>
  );
}
