import smalltalk from "../shared/campus-ai-smalltalk.json";
import faq from "../shared/campus-ai-faq.json";

export function normalizeQuestion(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("de")
    .replace(/ß/g, "ss")
    .replace(/[.!?…👋🙂😊👍🙏\uFE0F\s]+$/u, "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function socialReply(question: string, revision: number | null = null) {
  const text = normalizeQuestion(question);
  const item = smalltalk.find((item) =>
    item.phrases.some((phrase) => normalizeQuestion(phrase) === text),
  );
  return item
    ? {
        answer: item.answer,
        intent: item.intent,
        mode: "help",
        model: null,
        sources: [],
        actions: [],
        auto_action: null,
        changed: false,
        revision,
      }
    : null;
}

export function faqFor(question: string) {
  const text = normalizeQuestion(question).replace(
    /^(?:hi|hallo|hey)(?: freddy)?\s+/,
    "",
  );
  return faq.find((item) =>
    item.phrases.some((phrase) => normalizeQuestion(phrase) === text),
  );
}
