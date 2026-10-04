import type { Row } from "./api";
import { DateTime } from "luxon";
import type { Store } from "./demo";
import { timedAssessment } from "./assessment";
import { cohortProgression, effectiveSemester } from "./demo-progression";

function moduleUnits(state: Store, id: number): Row[] {
  const ids = new Set([id]);
  for (let depth = 0; depth < 12; depth++) {
    const previous = ids.size;
    for (const module of state.data.modules)
      if (ids.has(module.parent)) ids.add(module.id);
    if (ids.size === previous) break;
  }
  return state.data.teachingunits.filter((unit) => ids.has(unit.module));
}
function semesterFor(state: Store, module: Row, cohort: Row) {
  return Math.max(
    0,
    ...moduleUnits(state, module.id).map((unit) =>
      effectiveSemester(cohort, unit),
    ),
  );
}

export function prepareAssessments(state: Store, plan: Row): Row {
  const cohort = state.data.cohorts.find((row) => row.id === plan.cohort);
  const version =
    cohort &&
    state.data.studyversions.find((row) => row.id === cohort.study_version);
  if (!version || version.status !== "approved")
    throw new Error("Jahrgang mit freigegebener Lehrplanversion auswählen.");
  const report = cohortProgression(state, cohort!);
  if (report.errors.length) throw new Error(report.errors.join("\n"));
  let created = 0,
    existing = 0;
  const warnings: string[] = [];
  for (const module of state.data.modules.filter(
    (row) => row.study_version === version.id,
  )) {
    const semester = semesterFor(state, module, cohort!);
    if (!semester && !["none", "unspecified"].includes(module.assessment_type))
      warnings.push(
        `${module.name}: Ohne Lehrveranstaltung ist kein Prüfungssemester bestimmbar.`,
      );
    if (semester !== plan.semester || module.assessment_type === "none")
      continue;
    if (module.assessment_type === "unspecified") {
      warnings.push(
        `${module.name}: Prüfungsanforderung im Lehrplan noch nicht festgelegt.`,
      );
      continue;
    }
    if (
      state.data.assessments.some(
        (row) => row.plan === plan.id && row.module === module.id,
      )
    ) {
      existing++;
      continue;
    }
    const code = `PLAN${plan.id}-PRUEF${module.id}`;
    if (state.data.assessments.some((row) => row.code === code))
      throw new Error(`Kennung ${code} ist bereits vergeben.`);
    state.data.assessments.push({
      id: Math.max(0, ...state.data.assessments.map((row) => row.id)) + 1,
      code,
      name: module.name,
      plan: plan.id,
      module: module.id,
      assessment_type: module.assessment_type,
      assessment_duration_minutes: module.assessment_duration_minutes,
      assessment_notes: module.assessment_notes,
      due_at: null,
      status: "open",
    });
    created++;
  }
  return { created, existing, warnings };
}

export function examDraft(state: Store, assessment: Row): Row {
  if (
    assessment.status !== "open" ||
    !timedAssessment(assessment.assessment_type)
  )
    throw new Error(
      "Nur offene zeitgebundene Vorgaben können als Prüfung geplant werden.",
    );
  if (
    state.data.exams.some((exam) => exam.assessment_template === assessment.id)
  )
    throw new Error("Für diese Vorlage wurde bereits eine Prüfung angelegt.");
  const plan = state.data.plans.find((row) => row.id === assessment.plan)!;
  const period = state.data.periods.find((row) => row.id === plan.period)!;
  const units = moduleUnits(state, assessment.module);
  const planIds = state.data.plans
    .filter((row) => row.cohort === plan.cohort)
    .map((row) => row.id);
  const courses = state.data.courses.filter(
    (row) =>
      planIds.includes(row.plan) &&
      units.some((unit) => unit.id === row.teaching_unit),
  );
  const learners = new Set<number>(),
    warnings: string[] = [];
  if (courses.length)
    for (const course of courses) {
      for (const id of course.learners) learners.add(id);
      if (!course.elective)
        for (const id of course.groups) {
          const group = state.data.groups.find((row) => row.id === id)!;
          const roster = state.data.people.filter(
            (person) => person.kind === "learner" && person.groups.includes(id),
          );
          for (const person of roster) learners.add(person.id);
          if (group.size > roster.length)
            warnings.push(
              `${course.name}: Gruppenliste unvollständig; Teilnehmer prüfen.`,
            );
        }
      if (course.elective && !course.learners.length)
        warnings.push(
          `${course.name}: Wahlpflichtbelegungen fehlen; Teilnehmer auswählen.`,
        );
    }
  else if (units.length && units.every((unit) => unit.elective))
    warnings.push(
      "Wahlpflichtbelegungen fehlen; Teilnehmer ausdrücklich auswählen.",
    );
  else {
    const groups = state.data.groups
      .filter((group) => group.cohort === plan.cohort)
      .map((group) => group.id);
    for (const person of state.data.people.filter(
      (row) =>
        row.kind === "learner" &&
        row.groups.some((id: number) => groups.includes(id)),
    ))
      learners.add(person.id);
    warnings.push(
      "Teilnehmer aus dem Jahrgang vorgeschlagen; Belegungen und Gruppenlisten prüfen.",
    );
  }
  if (!learners.size)
    warnings.push("Es wurden noch keine Prüfungsteilnehmer erfasst.");
  const ownCourses = courses.filter((course) => course.plan === plan.id);
  return {
    warnings,
    defaults: {
      code: `VORLAGE${assessment.id}-PRUEF`,
      name: assessment.name,
      plan: plan.id,
      course: ownCourses.length === 1 ? ownCourses[0].id : null,
      assessment_template: assessment.id,
      assessment_type: assessment.assessment_type,
      assessment_notes: assessment.assessment_notes,
      duration_minutes: assessment.assessment_duration_minutes,
      window_start: period.start,
      window_end: period.end,
      learners: [...learners].sort((a, b) => a - b),
      supervisors: [],
      resit: false,
    },
  };
}

export function validateAssessment(
  state: Store,
  resource: string,
  record: Row,
  previous?: Row,
) {
  if (resource === "assessments") {
    if (
      record.due_at &&
      (typeof record.due_at !== "string" ||
        !DateTime.fromISO(record.due_at).isValid)
    )
      throw new Error("Gültige Abgabefrist angeben.");
    if (!["open", "waived"].includes(record.status))
      throw new Error("Gültigen Status auswählen.");
    const plan = state.data.plans.find((row) => row.id === record.plan)!;
    const module = state.data.modules.find((row) => row.id === record.module)!;
    const cohort = state.data.cohorts.find((row) => row.id === plan.cohort);
    const version = state.data.studyversions.find(
      (row) => row.id === module.study_version,
    );
    if (
      !cohort ||
      cohort.study_version !== module.study_version ||
      version?.status !== "approved"
    )
      throw new Error(
        "Modul muss zur freigegebenen Lehrplanversion des Jahrgangs gehören.",
      );
    if (
      previous &&
      (record.plan !== previous.plan || record.module !== previous.module)
    )
      throw new Error("Herkunftsmodul und Semesterplan bleiben erhalten.");
    if (!previous && semesterFor(state, module, cohort) !== plan.semester)
      throw new Error(
        "Prüfungsvorgabe gehört in das letzte zugehörige Fachsemester.",
      );
    if (
      state.data.assessments.some(
        (row) =>
          row.id !== record.id &&
          row.plan === plan.id &&
          row.module === module.id,
      )
    )
      throw new Error(
        "Für dieses Modul existiert bereits eine Prüfungsvorlage.",
      );
    if (timedAssessment(record.assessment_type)) {
      if (
        !Number.isInteger(record.assessment_duration_minutes) ||
        record.assessment_duration_minutes < 1 ||
        record.assessment_duration_minutes > 1440
      )
        throw new Error("Prüfungsdauer von 1 bis 1.440 Minuten angeben.");
      if (record.due_at)
        throw new Error(
          "Für zeitgebundene Prüfungen den Prüfungszeitraum statt einer Abgabefrist planen.",
        );
    } else if (record.assessment_duration_minutes != null)
      throw new Error("Hausarbeiten und Abgaben haben keine Minutendauer.");
    if (
      previous &&
      state.data.exams.some((row) => row.assessment_template === record.id) &&
      (record.status !== "open" ||
        record.assessment_type !== previous.assessment_type ||
        record.assessment_duration_minutes !==
          previous.assessment_duration_minutes)
    )
      throw new Error(
        "Prüfung bereits angelegt. Art und Dauer bleiben an der Vorlage erhalten; konkrete Prüfung separat bearbeiten.",
      );
  }
  if (resource === "exams") {
    if (
      record.learners.some(
        (id: number) =>
          state.data.people.find((person) => person.id === id)?.kind !==
          "learner",
      )
    )
      throw new Error("Nur Lernende auswählen.");
    if (
      record.supervisors.some(
        (id: number) =>
          state.data.people.find((person) => person.id === id)?.kind !==
          "teacher",
      )
    )
      throw new Error("Nur Lehrende auswählen.");
    if (
      previous &&
      (record.assessment_template || null) !==
        (previous.assessment_template || null)
    )
      throw new Error("Die Herkunft der Prüfung bleibt erhalten.");
    if (record.assessment_template) {
      const source = state.data.assessments.find(
        (row) => row.id === record.assessment_template,
      )!;
      if (
        source.plan !== record.plan ||
        source.status !== "open" ||
        !timedAssessment(source.assessment_type)
      )
        throw new Error(
          "Offene zeitgebundene Vorlage aus demselben Semesterplan wählen.",
        );
      if (source.assessment_type !== record.assessment_type)
        throw new Error("Prüfungsart muss zur Vorlage passen.");
      if (record.resit)
        throw new Error(
          "Nachschreibeklausuren separat mit eigener Teilnehmerliste anlegen.",
        );
      if (
        state.data.exams.some(
          (row) =>
            row.id !== record.id && row.assessment_template === source.id,
        )
      )
        throw new Error(
          "Für diese Vorlage wurde bereits eine Prüfung angelegt.",
        );
      if (!record.learners.length)
        throw new Error("Prüfungsteilnehmer auswählen.");
    }
    if (record.window_end < record.window_start)
      throw new Error("Prüfungszeitraum ungültig.");
    if (
      !Number.isInteger(record.duration_minutes) ||
      record.duration_minutes < 1 ||
      record.duration_minutes > 1440
    )
      throw new Error("Dauer von 1 bis 1.440 Minuten angeben.");
    if (
      record.course &&
      state.data.courses.find((row) => row.id === record.course)?.plan !==
        record.plan
    )
      throw new Error("Kurs und Prüfung müssen zum selben Plan gehören.");
  }
  if (["assessments", "exams"].includes(resource)) {
    if (
      typeof record.assessment_notes !== "string" ||
      record.assessment_notes.length > 2000
    )
      throw new Error(
        "Prüfungsanforderungen mit höchstens 2.000 Zeichen angeben.",
      );
    const choices = state.schema[resource].find(
      (field) => field.name === "assessment_type",
    )!.choices;
    if (!choices.some(([id]) => id === record.assessment_type))
      throw new Error("Gültige Prüfungsart auswählen.");
  }
}
