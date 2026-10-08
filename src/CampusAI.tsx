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
  Maximize2,
  Minimize2,
  Square,
} from "lucide-react";
import { api, type Row, DEMO_MODE } from "./api";
import FreddyAvatar from "./FreddyAvatar";
import { actionForGuide } from "./campus-ai-actions";
import {
  socialReply,
  faqFor,
  resolveFAQ,
  isFollowup,
} from "./campus-ai-language";
import { campusHelp } from "./campus-ai-help";
import FreddyAnswer from "./FreddyAnswer";

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
  const [expanded, setExpanded] = useState(false);
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
    cancelRequest();
    setPicker(null);
    setOpen(false);
    launcher.current?.focus();
  }
  const [cohortId, setCohortId] = useState("");
  const [context, setContext] = useState<Row | null>(null),
    [status, setStatus] = useState<Row | null>(null);
  const [conversations, setConversations] = useState<
    Record<string, { messages: Row[]; question: string }>
  >({});
  const request = useRef<{
    controller: AbortController;
    scope: string;
    question: string;
    messageId: number;
  } | null>(null);
  const sequence = useRef(0);
  const [elapsed, setElapsed] = useState(0);
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
  const scope = selectedPlanId
    ? `plan:${selectedPlanId}`
    : `cohort:${cohort || "general"}`;
  const messages = conversations[scope]?.messages || [];
  const question = conversations[scope]?.question || "";
  function setMessages(value: Row[] | ((current: Row[]) => Row[])) {
    setConversations((current) => {
      const entry = current[scope] || { messages: [], question: "" };
      return {
        ...current,
        [scope]: {
          ...entry,
          messages: typeof value === "function" ? value(entry.messages) : value,
        },
      };
    });
  }
  function setQuestion(value: string | ((current: string) => string)) {
    setConversations((current) => {
      const entry = current[scope] || { messages: [], question: "" };
      return {
        ...current,
        [scope]: {
          ...entry,
          question: typeof value === "function" ? value(entry.question) : value,
        },
      };
    });
  }
  function cancelRequest(
    reason = "Antwort abgebrochen. Deine Frage bleibt zur erneuten Bearbeitung erhalten.",
  ) {
    const pending = request.current;
    if (!pending) return;
    request.current = null;
    pending.controller.abort();
    generation.current++;
    setBusy(false);
    setConversations((current) => {
      const entry = current[pending.scope] || { messages: [], question: "" };
      return {
        ...current,
        [pending.scope]: {
          ...entry,
          question: entry.question || pending.question,
          messages: entry.messages.map((message) =>
            message.id === pending.messageId
              ? { ...message, unanswered: true }
              : message,
          ),
        },
      };
    });
    setActionFeedback(reason);
  }
  const selection = {
    ...view,
    // The independently selected chat plan must not inherit a term from another plan.
    ...(selectedPlanId !== planId ? { session_id: null } : {}),
    plan: selectedPlanId,
    cohort,
  };
  const query = new URLSearchParams();
  if (selectedPlanId) query.set("plan", String(selectedPlanId));
  if (cohort) query.set("cohort", String(cohort));
  Object.entries(selection).forEach(([key, value]) => {
    if (value !== null && value !== undefined) query.set(key, String(value));
  });
  const contextQuery = query.toString();
  useEffect(() => {
    if (!activated) return;
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    api("campusai/status/", "GET", undefined, { signal: controller.signal })
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
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [reload, activated]);
  useEffect(() => {
    if (!activated) return;
    let active = true;
    cancelRequest(
      "Ansicht gewechselt. Die laufende Antwort wurde abgebrochen; deine Frage bleibt erhalten.",
    );
    generation.current++;
    setBusy(false);
    setLoading(true);
    setError("");
    setContext(null);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    api(`campusai/context/?${contextQuery}`, "GET", undefined, {
      signal: controller.signal,
    })
      .then((result) => {
        if (active) setContext(result);
      })
      .catch((err) => {
        if (active)
          setError(
            controller.signal.aborted
              ? "Die Datenprüfung dauert zu lange. Aktualisiere die Hinweise und versuche es erneut."
              : err.message,
          );
      })
      .finally(() => {
        if (active) setLoading(false);
        window.clearTimeout(timer);
      });
    return () => {
      active = false;
      generation.current++;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [contextQuery, refresh, reload, activated]);
  useEffect(() => {
    setActionFeedback("");
  }, [scope]);
  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [busy]);
  useEffect(() => () => request.current?.controller.abort(), []);
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
    if (!value.trim() || value.length > 2000 || busy) return;
    // Static greetings never wait for the server, planning checks or a model.
    const social = socialReply(value, context?.revision);
    let historySize = 0;
    const history: { role: string; content: string }[] = [];
    for (const message of messages
      .filter((item) => !item.unanswered)
      .slice(-12)
      .reverse()) {
      if (historySize + message.content.length > 12000) break;
      history.unshift({ role: message.role, content: message.content });
      historySize += message.content.length;
    }
    if (
      social ||
      (!useModel &&
        !loading &&
        context &&
        (resolveFAQ(value, history) || isFollowup(value)))
    ) {
      const result = social || campusHelp(value, context!, history);
      setPicker(null);
      setActionFeedback("");
      setQuestion("");
      setMessages((items) => [
        ...items,
        { role: "user", content: value.trim() },
        {
          ...result,
          role: "assistant",
          content: result.answer,
          view_label: context?.view?.label,
        },
      ]);
      return;
    }
    if (busy || loading || !context) return;
    const current = generation.current;
    const controller = new AbortController();
    const messageId = ++sequence.current;
    request.current = { controller, scope, question: value, messageId };
    const timer = window.setTimeout(() => {
      cancelRequest(
        "Die Antwort dauert zu lange. Du kannst die Frage erneut senden oder Schnellhilfe nutzen.",
      );
    }, 45000);
    setBusy(true);
    setPicker(null);
    setError("");
    setActionFeedback("");
    setQuestion("");
    setMessages((items) => [
      ...items.filter(
        (item) => !(item.unanswered && item.content === value.trim()),
      ),
      { id: messageId, role: "user", content: value.trim() },
    ]);
    try {
      const result = await api(
        "campusai/chat/",
        "POST",
        {
          ...selection,
          question: value.trim(),
          history,
          use_model: useModel,
        },
        { signal: controller.signal },
      );
      if (typeof result.answer !== "string" || !result.answer.trim())
        throw new Error(
          "Freddy hat keine gültige Antwort geliefert. Deine Frage bleibt erhalten; versuche es erneut.",
        );
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
        setError(
          (err as Error).message ||
            "Die Verbindung ist fehlgeschlagen. Sende deine Frage erneut.",
        );
        setQuestion((draft) => draft || value);
        setMessages((items) =>
          items.map((message) =>
            message.id === messageId
              ? { ...message, unanswered: true }
              : message,
          ),
        );
      }
    } finally {
      window.clearTimeout(timer);
      if (request.current?.controller === controller) request.current = null;
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
          className={`campus-ai${expanded ? " campus-ai-expanded" : ""}`}
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
                className="campus-ai-icon"
                aria-label={
                  expanded ? "Freddy verkleinern" : "Freddy vergrößern"
                }
                aria-pressed={expanded}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
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
          {context?.calendar && view.page === "schedule" && (
            <div className="campus-ai-calendar-context">
              {context.calendar.selected_session
                ? `Termin: ${context.calendar.selected_session.name}`
                : `Woche ab ${context.calendar.week || view.week}`}
              {!!context.calendar.room_filter && (
                <span>Raum: {context.calendar.room_filter}</span>
              )}
              {!!context.calendar.group_filter && (
                <span>Gruppe: {context.calendar.group_filter}</span>
              )}
            </div>
          )}
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
              {!busy && (
                <button onClick={() => setReload((value) => value + 1)}>
                  Hinweise erneut laden
                </button>
              )}
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
                      disabled={loading || !context}
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
                    : message.mode === "verified"
                      ? "Freddy · Datenprüfung"
                      : message.intent
                        ? "Freddy"
                        : message.mode === "local"
                          ? "Freddy · lokale KI"
                          : "Freddy · Schnellhilfe"}
                </strong>
                {message.role === "assistant" ? (
                  <FreddyAnswer content={message.content} />
                ) : (
                  <div className="campus-ai-answer">{message.content}</div>
                )}
                {message.unanswered && (
                  <small>
                    Noch nicht beantwortet · du kannst die Frage erneut senden.
                  </small>
                )}
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
                  <details
                    className="campus-ai-sources"
                    aria-label="Verwendete Hilfe"
                  >
                    <summary>Verwendete Anleitung</summary>
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
                  </details>
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
              <div className="campus-ai-working">
                <p role="status">
                  <LoaderCircle className="spin" size={17} />
                  {useModel
                    ? "Freddy prüft deine Frage und überlegt …"
                    : "Hilfe zusammenstellen …"}
                  {elapsed > 1 && <span>{elapsed} s</span>}
                </p>
                <button
                  type="button"
                  className="campus-ai-stop"
                  onClick={() => cancelRequest()}
                >
                  <Square size={14} />
                  Antwort abbrechen
                </button>
              </div>
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
                disabled={
                  busy ||
                  !question.trim() ||
                  question.length > 2000 ||
                  (!socialReply(question) &&
                    !(
                      !useModel &&
                      !loading &&
                      context &&
                      (faqFor(question) || isFollowup(question))
                    ) &&
                    (busy || loading || !context))
                }
              >
                <Send size={18} />
              </button>
            </div>
            <div className="campus-ai-footer">
              <small>
                {DEMO_MODE
                  ? "Schnellhilfe · kein Sprachmodell"
                  : useModel
                    ? "Lokale KI · Antworten prüfen"
                    : "Anleitung und geprüfte Hinweise"}
              </small>
              <small>Gespräch je Plan · nur in dieser Sitzung</small>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
