import knowledge from "../shared/campus-ai-knowledge.json";
import type { Row } from "./api";
import { replyActions } from "./campus-ai-actions";

export { knowledge };
export function campusHelp(question: string, context: Row) {
  const normalized = question.toLocaleLowerCase("de");
  const guides = knowledge
    .map((item) => ({
      ...item,
      score: item.keywords.filter((word) => normalized.includes(word)).length,
    }))
    .filter((item) => item.score)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (!guides.length) guides.push({ ...knowledge[0], score: 0 });
  return {
    answer:
      (guides[0].score
        ? ""
        : "Für diese Frage habe ich keine passende Schnellhilfe. Hier findest du den grundlegenden Ablauf für campusTIME:\n\n") +
      guides.map((item) => item.answer).join("\n\n") +
      (context.notices.length
        ? "\n\nAktuelle Planungshinweise:\n" +
          context.notices
            .slice(0, 4)
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
