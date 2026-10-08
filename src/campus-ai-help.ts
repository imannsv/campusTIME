import knowledge from "../shared/campus-ai-knowledge.json";
import {
  socialReply,
  resolveFAQ,
  isFollowup,
  normalizeQuestion,
} from "./campus-ai-language";
import type { Row } from "./api";
import { replyActions } from "./campus-ai-actions";

export { knowledge };
export function campusHelp(
  question: string,
  context: Row,
  history: { role: string; content: string }[] = [],
) {
  const social = socialReply(question, context.revision);
  if (social) return social;
  const faq = resolveFAQ(question, history);
  if (faq) {
    if (faq.kind === "issues") {
      const notices = context.proactive?.notices || [];
      return {
        answer: notices.length
          ? `Für ${context.view?.label || "die aktuelle Ansicht"} sehe ich folgende Hinweise:\n` +
            notices
              .slice(0, 3)
              .map((item: Row) => "• " + item.text)
              .join("\n")
          : faq.answer,
        mode: "help",
        model: null,
        changed: false,
        revision: context.revision,
        sources: [],
        actions: context.proactive?.actions || [],
        auto_action: null,
      };
    }
    const guides = knowledge.filter((item) => item.id === faq.guide);
    return {
      answer: faq.answer,
      mode: "help",
      model: null,
      changed: false,
      revision: context.revision,
      sources: guides.map(({ id, title, page }) => ({ id, title, page })),
      ...replyActions(question, guides, context),
    };
  }
  if (isFollowup(question))
    return {
      answer:
        "Auf welche Funktion beziehst du dich? Nenne mir kurz das Thema, zum Beispiel Räume, Prüfungen oder die Veröffentlichung.",
      mode: "help",
      model: null,
      changed: false,
      revision: context.revision,
      sources: [],
      actions: [],
      auto_action: null,
    };
  const normalized = normalizeQuestion(question);
  const guides = knowledge
    .map((item) => ({
      ...item,
      score: item.keywords.filter((word) =>
        normalized
          .split(/[^a-z0-9]+/)
          .some(
            (token) =>
              token === normalizeQuestion(word) ||
              (normalizeQuestion(word).length >= 4 &&
                token.startsWith(normalizeQuestion(word))),
          ),
      ).length,
    }))
    .filter((item) => item.score)
    .sort((a, b) => b.score - a.score)
    .slice(0, 1);
  if (!guides.length) guides.push({ ...knowledge[0], score: 0 });
  return {
    answer:
      (guides[0].score
        ? ""
        : "Für diese Frage habe ich keine passende Schnellhilfe. Hier findest du den grundlegenden Ablauf für campusTIME:\n\n") +
      guides.map((item) => item.answer).join("\n\n") +
      (context.notices.length
        ? "\n\nAktuelle Planungshinweise:\n" +
          (context.proactive?.notices || [])
            .slice(0, 1)
            .map((item: Row) => "• " + item.text)
            .join("\n")
        : ""),
    sources: guides.map(({ id, title, page }) => ({ id, title, page })),
    mode: "help",
    model: null,
    changed: false,
    revision: context.revision,
    ...replyActions(question, guides, context),
  };
}
