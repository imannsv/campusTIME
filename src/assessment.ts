import type { Row } from "./api";

export const assessmentTypes: [string, string][] = [
  ["unspecified", "Noch nicht festgelegt"],
  ["none", "Keine eigene Prüfung"],
  ["exam", "Klausur"],
  ["term_paper", "Hausarbeit"],
  ["submission", "Abgabe"],
  ["oral", "Mündliche Prüfung"],
  ["presentation", "Präsentation"],
  ["practical", "Praktische Prüfung"],
  ["portfolio", "Portfolio"],
  ["other", "Sonstige Prüfungsleistung"],
];

export function timedAssessment(type: string): boolean {
  return ["exam", "oral", "presentation", "practical"].includes(type);
}

export function assessmentSummary(module: Row): string {
  const type = module.assessment_type || "unspecified";
  const label = assessmentTypes.find(([key]) => key === type)?.[1] || type;
  return timedAssessment(type) && module.assessment_duration_minutes
    ? `${label} · ${module.assessment_duration_minutes} Min.`
    : label;
}
