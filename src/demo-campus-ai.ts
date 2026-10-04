import type { Row } from "./api";
import type { Store } from "./demo";
import { cohortProgression } from "./demo-progression";
import { campusHelp } from "./campus-ai-help";

export const demoAIStatus = {
  ready: false,
  model: "",
  reason:
    "In der Browser-Demo sind Schnellhilfe und Datenhinweise verfügbar. Das lokale Sprachmodell wird in der lokalen Anwendung verbunden.",
};

export function demoAIContext(
  state: Store,
  selection: Row,
  conflicts: string[],
) {
  const find = (resource: string, id: any) => {
    if (id === undefined || id === null || id === "") return null;
    if (!Number.isInteger(Number(id)) || Number(id) < 1)
      throw new Error("Gültige Auswahl angeben.");
    const row = state.data[resource].find((item) => item.id === Number(id));
    if (!row) throw new Error("Auswahl nicht gefunden.");
    return row;
  };
  const plan = find("plans", selection.plan);
  const cohort =
    find("cohorts", selection.cohort) || find("cohorts", plan?.cohort);
  if (plan && selection.cohort && cohort?.id !== plan.cohort)
    throw new Error("Jahrgang muss zum ausgewählten Semesterplan gehören.");
  const notices: Row[] = [];
  const notice = (text: string, page: string, severity = "hint") => {
    if (!notices.some((item) => item.text === text))
      notices.push({ text, page, severity });
  };
  const rooms = state.data.rooms;
  const teachers = state.data.people.filter(
    (person) => person.kind === "teacher",
  );
  const facts: Row = {
    rooms: rooms.length,
    teachers: teachers.length,
    programs: state.data.programs.length,
    cohorts: state.data.cohorts.length,
    unit_minutes: state.institution.unit_minutes,
  };
  if (!rooms.length) notice("Noch keine Räume eingerichtet.", "map");
  if (!teachers.length) notice("Noch keine Lehrenden erfasst.", "setup");
  if (plan) {
    const period = find("periods", plan.period)!;
    facts.plan = {
      id: plan.id,
      name: plan.name,
      semester: plan.semester,
      period_start: period.start,
      period_end: period.end,
    };
    const courses = state.data.courses.filter(
      (course) => course.plan === plan.id,
    );
    facts.courses = courses.length;
    facts.exams = state.data.exams.filter(
      (exam) => exam.plan === plan.id,
    ).length;
    for (const exam of state.data.exams.filter((row) => row.plan === plan.id)) {
      if (!exam.learners.length)
        notice(`${exam.name}: Prüfungsteilnehmer fehlen.`, "exams");
      if (!exam.supervisors.length)
        notice(`${exam.name}: Prüfungsaufsichten fehlen.`, "exams");
    }
    for (const item of state.data.assessments.filter(
      (row) =>
        row.plan === plan.id &&
        row.status === "open" &&
        ["exam", "oral", "presentation", "practical"].includes(
          row.assessment_type,
        ),
    )) {
      if (
        !state.data.exams.some((exam) => exam.assessment_template === item.id)
      )
        notice(
          `${item.name}: Aus der Vorlage wurde noch keine konkrete Prüfung angelegt.`,
          "exams",
        );
    }
    if (!courses.length)
      notice(
        "In diesem Semesterplan sind noch keine Veranstaltungen erfasst.",
        "setup",
      );
    for (const course of courses) {
      if (!course.teachers.length)
        notice(`${course.name}: Lehrende fehlen.`, "data");
      if (
        course.teachers.some((id: number) => {
          const person = teachers.find((item) => item.id === id);
          return !(
            person?.availability?.windows ??
            person?.availability?.weekdays ?? [0, 1, 2, 3, 4]
          ).length;
        })
      )
        notice(
          `${course.name}: Mindestens eine zugeordnete Lehrperson hat keine Zeitfenster.`,
          "setup",
        );
      const roster = new Set<number>(course.learners);
      let unknown = 0;
      if (!course.elective)
        for (const id of course.groups) {
          const group = find("groups", id)!;
          const people = state.data.people.filter(
            (person) => person.kind === "learner" && person.groups.includes(id),
          );
          people.forEach((person) => roster.add(person.id));
          unknown += Math.max(0, group.size - people.length);
        }
      const count = roster.size + unknown;
      if (course.elective && !count)
        notice(`${course.name}: Wahlpflichtbelegungen fehlen.`, "data");
      if (
        count &&
        !rooms.some(
          (room) =>
            room.capacity >= count &&
            course.equipment.every((item: string) =>
              room.equipment.includes(item),
            ),
        )
      )
        notice(
          `${course.name}: Kein Raum mit ausreichend Plätzen und benötigter Ausstattung vorhanden.`,
          "map",
          "error",
        );
    }
    for (const text of conflicts) notice(text, "schedule", "error");
    for (const item of state.data.assessments.filter(
      (row) =>
        row.plan === plan.id &&
        row.status === "open" &&
        !["exam", "oral", "presentation", "practical"].includes(
          row.assessment_type,
        ),
    )) {
      if (!item.due_at)
        notice(`${item.name}: Abgabefrist noch offen.`, "exams");
      else if (Date.parse(item.due_at) < Date.now())
        notice(`${item.name}: Abgabefrist ist verstrichen.`, "exams");
    }
    if (!cohort?.study_version)
      notice(
        "Dieser Plan hat keine Zuordnung zu einem Jahrgang mit Lehrplanversion. Prüfungsanforderungen können daher nicht übernommen werden.",
        "setup",
      );
    notice(
      "Diese Browser-Demo prüft einfache Konflikte. Die vollständige Soll- und Verfügbarkeitsprüfung erfolgt im Backend.",
      "schedule",
    );
  }
  let semesters: Row[] = [];
  if (cohort) {
    facts.cohort = { id: cohort.id, name: cohort.name };
    if (
      state.data.studyversions.find(
        (version) => version.id === cohort.study_version,
      )?.status === "approved"
    ) {
      const report = cohortProgression(state, cohort);
      semesters = report.semesters;
      report.errors.forEach((text: string) => notice(text, "setup", "error"));
      report.warnings.forEach((text: string) => notice(text, "setup"));
    } else
      notice("Dem Jahrgang fehlt eine freigegebene Lehrplanversion.", "setup");
  }
  notices.sort(
    (a, b) => Number(a.severity !== "error") - Number(b.severity !== "error"),
  );
  return {
    revision: state.institution.revision,
    facts,
    semesters,
    notices: notices.slice(0, 40),
    notice_count: notices.length,
  };
}

export function demoAIReply(body: Row, context: Row) {
  if (
    typeof body.question !== "string" ||
    !body.question.trim() ||
    body.question.length > 2000
  )
    throw new Error("Eine Frage mit höchstens 2.000 Zeichen eingeben.");
  return {
    ...campusHelp(body.question, context),
    ...(body.use_model ? { service_note: demoAIStatus.reason } : {}),
  };
}
