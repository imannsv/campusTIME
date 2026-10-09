import catalog from "../shared/campus-ai-actions.json";
import type { Row } from "./api";
import language from "../shared/campus-ai-language.json";
import { normalizeQuestion } from "./campus-ai-language";

export const campusActions: Row[] = catalog;
export const actionForGuide = (id: string) =>
  campusActions.find((action) => action.guides.includes(id));

// Whole-sentence matching: questions, negation and compound commands never execute.
export function requestedAction(question: string) {
  const text = normalizeQuestion(
    normalizeQuestion(question).replace(/\bbitte\b/g, ""),
  ).replace(/^freddy\s+/, "");
  return campusActions.find((action) =>
    action.targets.some((target: string) => {
      const templates = action.create
        ? language.creation_templates
        : language.navigation_templates;
      return templates.some(
        (template) =>
          template.replace("{target}", normalizeQuestion(target)) === text,
      );
    }),
  );
}

export function replyActions(question: string, guides: Row[], context: Row) {
  const command = requestedAction(question);
  const actions = command
    ? [command]
    : guides.map((guide) => actionForGuide(guide.id)).filter(Boolean);
  const allowed = actions.filter(
    (action) =>
      !action!.requires || context.action_requirements?.[action!.requires],
  );
  return {
    actions: allowed.map((action) => ({
      id: action!.id,
      label: action!.label,
    })),
    auto_action: command && allowed.length ? command.id : null,
    ...(command
      ? {
          sources: [],
          answer: allowed.length
            ? command.create
              ? `Ich öffne das Formular: ${command.label}. Trage die Angaben ein und speichere sie anschließend selbst.`
              : `Ich öffne die Ansicht: ${command.label}.`
            : "Dafür fehlen noch Voraussetzungen. " +
              (command.requires === "approved_version"
                ? "Lege zuerst einen Studiengang mit freigegebener Lehrplanversion an."
                : command.requires === "plan"
                  ? "Wähle zuerst einen Semesterplan aus."
                  : "Richte zuerst den benötigten Bereich, das Stockwerk oder die Räume ein."),
        }
      : {}),
  };
}

export function pageContext(selection: Row) {
  const page = String(selection.page || "schedule");
  const step = Number(selection.step || 0);
  const steps = [
    "Räume",
    "Lehrende",
    "Studiengänge",
    "Studienstruktur",
    "Jahrgänge",
    "Semester planen",
  ];
  const names: Row = {
    map: "Räume",
    schedule: "Stundenplanung",
    teachers: "Lehrendenübersicht",
    data: "Stammdaten",
    exams: "Prüfungen",
    displays: "Öffentliche Anzeigen",
    students: "Studierendenübersicht",
    settings: "Einstellungen",
  };
  const labels: Row = {
    courses: "Veranstaltungen",
    people: "Personen",
    blocks: "Raumblockierungen",
    groups: "Gruppen",
    rooms: "Räume",
  };
  const defaults: Row = {
    map: ["add_room", "blocks"],
    schedule: ["courses", "semester"],
    teachers: ["teachers", "schedule"],
    exams: ["exams", "add_exam"],
    displays: ["displays", "schedule"],
    students: ["students", "displays"],
    settings: ["settings", "setup"],
    data: ["courses", "blocks"],
  };
  const setup = [
    ["rooms", "add_building"],
    ["teachers", "add_teacher"],
    ["programs", "add_program"],
    ["structure", "programs"],
    ["cohorts", "add_cohort"],
    ["semester", "schedule"],
  ];
  return {
    page,
    step,
    resource: selection.resource || "",
    label:
      page === "setup"
        ? `Einrichtung · ${steps[step] || steps[0]}`
        : page === "data"
          ? `Stammdaten · ${labels[selection.resource] || selection.resource || "Übersicht"}`
          : names[page],
    defaults:
      page === "setup" ? setup[step] || setup[0] : defaults[page] || ["setup"],
  };
}

export function proactiveContext(context: Row, selection: Row) {
  const view = pageContext(selection);
  const resourceScopes: Row = {
    people: ["setup", 1, "teachers"],
    programs: ["setup", 2, "programs"],
    studyversions: ["setup", 3, "structure"],
    modules: ["setup", 3, "structure"],
    teachingunits: ["setup", 3, "structure"],
    cohorts: ["setup", 4, "cohorts"],
    groups: ["setup", 4, "cohorts"],
    buildings: ["map", 0, "rooms"],
    floors: ["map", 0, "rooms"],
    rooms: ["map", 0, "rooms"],
    blocks: ["blocks", 0, "blocks"],
  };
  const scope = view.page === "data" ? resourceScopes[view.resource] : null;
  const scopePage = scope?.[0] || view.page;
  const scopeStep = scope?.[1] ?? view.step;
  const relevant = context.notices.filter(
    (item: Row) =>
      !item.context_only &&
      ((item.page === scopePage &&
        (scopePage !== "setup" || (item.step ?? scopeStep) === scopeStep)) ||
        (view.page === "setup" && view.step === 0 && item.page === "map")),
  );
  const ids = [
    ...relevant.slice(0, 2).map((item: Row) => item.action),
    ...(scope ? [scope[2]] : view.defaults),
  ];
  const actions = [...new Set(ids)]
    .map((id) => campusActions.find((action) => action.id === id))
    .filter(
      (action) =>
        action &&
        (!action.requires || context.action_requirements?.[action.requires]),
    )
    .slice(0, 2);
  return {
    view,
    proactive: {
      notices: relevant.slice(0, 2),
      actions: actions.map((action) => ({
        id: action!.id,
        label: action!.label,
      })),
    },
  };
}
