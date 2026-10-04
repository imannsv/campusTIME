import smalltalk from "../shared/campus-ai-smalltalk.json";
import faq from "../shared/campus-ai-faq.json";
import language from "../shared/campus-ai-language.json";

export function normalizeQuestion(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("de")
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
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

function questionText(question: string) {
  return normalizeQuestion(question)
    .replace(/^(?:(?:hi|hallo|hey|moin)(?: freddy)?|freddy)\s+/, "")
    .replace(/\s+(?:bitte|freddy)$/, "")
    .trim();
}

function core(value: string) {
  const synonyms: Record<string, string> = language.synonyms;
  return (questionText(value).match(/[a-z0-9]+/g) || [])
    .filter((token) => !language.stopwords.includes(token))
    .map((token) => synonyms[token] || token)
    .sort();
}

function oneTypo(a: string, b: string) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1)
    return false;
  if (a.length === b.length)
    return [...a].filter((value, index) => value !== b[index]).length === 1;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return [...long].some(
    (_, index) => long.slice(0, index) + long.slice(index + 1) === short,
  );
}

export function faqFor(question: string): (typeof faq)[number] | undefined {
  const text = questionText(question);
  const exact = faq.find((item) =>
    item.phrases.some((phrase) => questionText(phrase) === text),
  );
  if (exact) return exact;
  if (
    (text.match(/[a-z0-9]+/g) || []).some((token) =>
      language.qualifiers.includes(token),
    )
  )
    return;
  if (
    !/^(wie|wo|was|warum|wieso|welche\w*|kann\w*|koenn\w*|muss|soll|darf|sind|ist|gibt|erklaer\w*)\b/.test(
      text,
    )
  )
    return;
  const tokens = core(text);
  if (tokens.length < 2) return;
  const matches = faq.filter((item) =>
    item.phrases.some((phrase) => {
      const candidate = core(phrase);
      return (
        tokens.length === candidate.length &&
        tokens.filter((token, index) => token !== candidate[index]).length <=
          1 &&
        tokens.every((token, index) => oneTypo(token, candidate[index]))
      );
    }),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function isFollowup(question: string) {
  return language.followups.some(
    (phrase) => questionText(phrase) === questionText(question),
  );
}

export function resolveFAQ(
  question: string,
  history: { role: string; content: string }[] = [],
) {
  const direct = faqFor(question);
  if (direct || !isFollowup(question)) return direct;
  for (const item of [...history].reverse()) {
    if (item.role !== "user" || isFollowup(item.content)) continue;
    return faqFor(item.content);
  }
}
