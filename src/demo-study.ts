import type { Store } from "./demo";
import type { Row } from "./api";

const get = (state: Store, resource: string, id: number) => {
  const row = state.data[resource].find((item) => item.id === id);
  if (!row) throw new Error("Eintrag nicht gefunden.");
  return row;
};
const versionFor = (state: Store, resource: string, row: Row): Row | null => {
  if (resource === "studyversions") return row;
  if (resource === "modules")
    return get(state, "studyversions", row.study_version);
  if (resource === "teachingunits")
    return get(
      state,
      "studyversions",
      get(state, "modules", row.module).study_version,
    );
  return null;
};
export function validateStudy(
  state: Store,
  resource: string,
  row: Row,
  old: Row | null,
  deleting = false,
) {
  if (resource === "periods") {
    const span = (Date.parse(row.end) - Date.parse(row.start)) / 86400000;
    if (
      !Number.isFinite(span) ||
      span < 0 ||
      span > 550 ||
      row.day_start >= row.day_end ||
      !Number.isInteger(row.slot_minutes) ||
      row.slot_minutes < 1 ||
      row.slot_minutes > 240 ||
      !Array.isArray(row.weekdays) ||
      !row.weekdays.length ||
      row.weekdays.some(
        (day: number) => !Number.isInteger(day) || day < 0 || day > 6,
      )
    )
      throw new Error(
        "Gültigen Zeitraum, Tageszeiten, Unterrichtstage und ein Zeitraster von 1–240 Minuten angeben.",
      );
  }
  const owner = old && versionFor(state, resource, old);
  const target = versionFor(state, resource, row);
  if (
    owner?.status === "approved" ||
    (target?.status === "approved" && resource !== "studyversions")
  )
    throw new Error(
      "Freigegebene Lehrplanversionen bleiben unverändert. Eine neue Version als Kopie anlegen.",
    );
  if (deleting) return;
  if (
    ["programs", "studyversions"].includes(resource) &&
    (!Number.isInteger(Number(row.duration_semesters)) ||
      row.duration_semesters < 1 ||
      row.duration_semesters > 24 ||
      row.total_credits < 0 ||
      row.total_credits > 10000)
  )
    throw new Error(
      "Regelstudienzeit: 1–24 Semester; Credit Points: 0–10.000.",
    );
  if (resource === "studyversions") row.status = "draft";
  if (resource === "modules") {
    if (old && old.study_version !== row.study_version)
      throw new Error("Module bleiben in ihrer Lehrplanversion.");
    if (row.credits < 0 || row.credits > 10000)
      throw new Error("Credit Points müssen zwischen 0 und 10.000 liegen.");
    let parent = row.parent ? get(state, "modules", row.parent) : null;
    const visited = new Set([row.id]);
    while (parent) {
      if (visited.has(parent.id) || parent.study_version !== row.study_version)
        throw new Error(
          "Obermodul muss in derselben Version liegen; keine zyklische Zuordnung.",
        );
      visited.add(parent.id);
      parent = parent.parent ? get(state, "modules", parent.parent) : null;
    }
    if (
      row.prerequisites.some(
        (id: number) =>
          id === row.id ||
          get(state, "modules", id).study_version !== row.study_version,
      )
    )
      throw new Error(
        "Andere Module derselben Version als Voraussetzungen auswählen.",
      );
  }
  if (resource === "teachingunits") {
    if (old && versionFor(state, resource, old)?.id !== target?.id)
      throw new Error("Lehrveranstaltungen bleiben in ihrer Lehrplanversion.");
    if (
      !Number.isInteger(row.semester) ||
      row.semester < 1 ||
      row.semester > target!.duration_semesters ||
      row.target_units < 1 ||
      row.duration_minutes < 1 ||
      row.block_days < 1 ||
      row.block_days > 7
    )
      throw new Error("Fachsemester oder Unterrichtsumfang ungültig.");
    if (
      row.teachers.some(
        (id: number) => get(state, "people", id).kind !== "teacher",
      )
    )
      throw new Error("Nur Lehrende auswählen.");
    if (
      row.block_days > 1 &&
      (row.target_mode !== "total" ||
        (row.target_units * state.institution.unit_minutes) %
          (row.duration_minutes * row.block_days))
    )
      throw new Error(
        "Mehrtagige Blöcke benötigen einen passenden Gesamtumfang.",
      );
  }
  if (resource === "cohorts") {
    const version = row.study_version
      ? get(state, "studyversions", row.study_version)
      : null;
    if (
      version &&
      (version.program !== row.program || version.status !== "approved")
    )
      throw new Error(
        "Freigegebene Lehrplanversion des gewählten Studiengangs auswählen.",
      );
    if (old?.study_version && old.study_version !== row.study_version)
      throw new Error("Der Jahrgang behält seine Lehrplanversion.");
  }
  if (resource === "plans") {
    const cohort = row.cohort ? get(state, "cohorts", row.cohort) : null;
    if (
      row.semester < 1 ||
      (cohort?.study_version &&
        row.semester >
          get(state, "studyversions", cohort.study_version).duration_semesters)
    )
      throw new Error("Gültiges Fachsemester auswählen.");
    if (
      old &&
      state.data.courses.some(
        (course) => course.plan === old.id && course.teaching_unit,
      ) &&
      (old.cohort !== row.cohort || old.semester !== row.semester)
    )
      throw new Error(
        "Für ein anderes Fachsemester oder einen anderen Jahrgang einen neuen Plan anlegen.",
      );
  }
  if (resource === "courses" && row.teaching_unit) {
    const unit = get(state, "teachingunits", row.teaching_unit),
      plan = get(state, "plans", row.plan);
    if (
      unit.group_mode === "per_group"
        ? !row.study_group ||
          get(state, "groups", row.study_group).cohort !== plan.cohort
        : !!row.study_group
    )
      throw new Error(
        "Gruppe der Studienstruktur passt nicht zur Durchführung.",
      );
    if (
      old?.teaching_unit &&
      (old.study_group || null) !== (row.study_group || null)
    )
      throw new Error("Die Herkunftsgruppe bleibt erhalten.");
    if (
      !plan.cohort ||
      get(state, "cohorts", plan.cohort).study_version !==
        versionFor(state, "teachingunits", unit)!.id ||
      plan.semester !== unit.semester
    )
      throw new Error("Lehrveranstaltung passt nicht zum Semesterplan.");
    if (
      state.data.courses.some(
        (course) =>
          course.id !== row.id &&
          course.plan === row.plan &&
          course.teaching_unit === row.teaching_unit &&
          (course.study_group || null) === (row.study_group || null),
      )
    )
      throw new Error("Lehrveranstaltung bereits im Semesterplan vorhanden.");
  }
  if (
    resource === "courses" &&
    old?.teaching_unit &&
    old.teaching_unit !== row.teaching_unit
  )
    throw new Error("Die Herkunft aus der Studienstruktur bleibt erhalten.");
  if (resource === "people") {
    if (
      old &&
      old.kind !== row.kind &&
      (state.data.teachingunits.some((unit) =>
        unit.teachers.includes(row.id),
      ) ||
        state.data.courses.some((course) => course.teachers.includes(row.id)) ||
        state.data.exams.some((exam) => exam.supervisors.includes(row.id)))
    )
      throw new Error(
        "Person ist als Lehrende oder Aufsicht zugeordnet; die Art kann nicht geändert werden.",
      );
    const availability = row.availability || {};
    const validTime = (value: unknown) =>
      typeof value === "string" &&
      /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
    if (
      availability.windows !== undefined &&
      (!Array.isArray(availability.windows) ||
        availability.windows.some(
          (item: Row) =>
            !Number.isInteger(item.weekday) ||
            item.weekday < 0 ||
            item.weekday > 6 ||
            !validTime(item.from) ||
            !validTime(item.to) ||
            item.from >= item.to,
        ))
    )
      throw new Error(
        "Verfügbarkeitsfenster enthalten ungültige Tage oder Uhrzeiten.",
      );
    if (
      (availability.exclusions || []).some(
        (item: Row) =>
          !Number.isFinite(Date.parse(item.start)) ||
          !Number.isFinite(Date.parse(item.end)) ||
          Date.parse(item.end) <= Date.parse(item.start),
      )
    )
      throw new Error("Sperrzeit: Ende muss nach Beginn liegen.");
  }
}

export function checkStructure(state: Store, version: Row): Row {
  const modules = state.data.modules.filter(
    (item) => item.study_version === version.id,
  );
  const units = state.data.teachingunits.filter((item) =>
    modules.some((module) => module.id === item.module),
  );
  const errors = new Set<string>(),
    warnings: string[] = [];
  const credits = modules
    .filter((item) => !item.parent)
    .reduce((sum, item) => sum + Number(item.credits), 0);
  const descendants = (id: number, visited = new Set<number>()): number[] => {
    if (visited.has(id)) {
      errors.add("Zyklische Modulstruktur.");
      return [];
    }
    const next = new Set([...visited, id]);
    return [
      id,
      ...modules
        .filter((item) => item.parent === id)
        .flatMap((item) => descendants(item.id, next)),
    ];
  };
  const semesters = new Map(
    modules.map((module) => [
      module.id,
      units
        .filter((unit) => descendants(module.id).includes(unit.module))
        .map((unit) => unit.semester),
    ]),
  );
  if (!modules.length) errors.add("Noch keine Module angelegt.");
  if (Math.abs(credits - Number(version.total_credits)) > 0.001)
    errors.add(
      `Obermodule umfassen ${credits} statt ${version.total_credits} Credit Points.`,
    );
  for (const module of modules) {
    const children = modules.filter((item) => item.parent === module.id),
      total = children.reduce((sum, item) => sum + Number(item.credits), 0);
    if (!semesters.get(module.id)!.length)
      errors.add(`${module.name}: keine Lehrveranstaltung zugeordnet.`);
    if (
      children.length &&
      total &&
      Math.abs(total - Number(module.credits)) > 0.001
    )
      errors.add(
        `${module.name}: Credit Points der Teilmodule stimmen nicht überein.`,
      );
    for (const id of module.prerequisites) {
      const before = semesters.get(id) || [],
        after = semesters.get(module.id)!;
      if (!semesters.has(id))
        errors.add(
          `${module.name}: Voraussetzung liegt in einer anderen Lehrplanversion.`,
        );
      else if (
        before.length &&
        after.length &&
        Math.max(...before) >= Math.min(...after)
      )
        errors.add(
          `${module.name}: Voraussetzung muss in einem früheren Semester liegen.`,
        );
    }
  }
  for (let semester = 1; semester <= version.duration_semesters; semester++)
    if (!units.some((unit) => unit.semester === semester))
      errors.add(`Semester ${semester}: noch keine Lehrveranstaltungen.`);
  for (const unit of units) {
    if (unit.semester < 1 || unit.semester > version.duration_semesters)
      errors.add(`${unit.name}: Semester außerhalb der Regelstudienzeit.`);
    if (!unit.teachers.length)
      warnings.push(`${unit.name}: Lehrende bei der Semesterplanung ergänzen.`);
  }
  return {
    errors: [...errors],
    warnings,
    credits: String(credits),
    module_count: modules.length,
    unit_count: units.length,
  };
}
export function studyAction(
  state: Store,
  version: Row,
  operation: string,
  body: Row,
): Row {
  if (operation === "approve") {
    const report = checkStructure(state, version);
    if (report.errors.length) throw new Error(report.errors.join("\n"));
    version.status = "approved";
    return { ok: true, ...report };
  }
  if (operation !== "clone") throw new Error("Funktion nicht verfügbar.");
  if (
    !["code", "name", "version"].every(
      (key) => typeof body[key] === "string" && body[key].trim(),
    )
  )
    throw new Error("Kennung, Name und Versionsbezeichnung angeben.");
  if (state.data.studyversions.some((item) => item.code === body.code))
    throw new Error("Kennung ist bereits vergeben.");
  const copy = {
    ...structuredClone(version),
    id: Math.max(0, ...state.data.studyversions.map((item) => item.id)) + 1,
    code: body.code.trim(),
    name: body.name.trim(),
    version: body.version.trim(),
    status: "draft",
  };
  state.data.studyversions.push(copy);
  const modules = state.data.modules.filter(
      (item) => item.study_version === version.id,
    ),
    mapping = new Map<number, number>();
  for (const module of modules) {
    const id = Math.max(0, ...state.data.modules.map((item) => item.id)) + 1;
    mapping.set(module.id, id);
    state.data.modules.push({
      ...structuredClone(module),
      id,
      code: `SV${copy.id}-M${module.id}`,
      study_version: copy.id,
    });
  }
  for (const id of mapping.values()) {
    const module = get(state, "modules", id);
    module.parent = mapping.get(module.parent) || null;
    module.prerequisites = module.prerequisites.map((id: number) =>
      mapping.get(id),
    );
  }
  const units = state.data.teachingunits.filter((item) =>
    mapping.has(item.module),
  );
  for (const unit of units)
    state.data.teachingunits.push({
      ...structuredClone(unit),
      id: Math.max(0, ...state.data.teachingunits.map((item) => item.id)) + 1,
      code: `SV${copy.id}-L${unit.id}`,
      module: mapping.get(unit.module),
    });
  return copy;
}
export function prepareSemester(state: Store, plan: Row, body: Row): Row {
  const cohort = plan.cohort && get(state, "cohorts", plan.cohort),
    version =
      cohort?.study_version &&
      get(state, "studyversions", cohort.study_version);
  if (
    !version ||
    version.status !== "approved" ||
    plan.semester < 1 ||
    plan.semester > version.duration_semesters
  )
    throw new Error(
      "Jahrgang mit freigegebener Lehrplanversion und gültigem Fachsemester auswählen.",
    );
  let groups = state.data.groups.filter((item) => item.cohort === cohort.id);
  if (body.groups !== undefined) {
    if (
      !Array.isArray(body.groups) ||
      body.groups.some((id: number) => !groups.some((item) => item.id === id))
    )
      throw new Error("Gruppen müssen zum Jahrgang gehören.");
    groups = groups.filter((item) => body.groups.includes(item.id));
  }
  if (!groups.length)
    throw new Error("Zuerst mindestens eine Gruppe für den Jahrgang anlegen.");
  const units = state.data.teachingunits.filter(
    (unit) =>
      versionFor(state, "teachingunits", unit)!.id === version.id &&
      unit.semester === plan.semester,
  );
  if (!units.length)
    throw new Error(
      "Für dieses Fachsemester sind keine Lehrveranstaltungen hinterlegt.",
    );
  let created = 0,
    total = 0;
  const warnings: string[] = [];
  for (const unit of units) {
    const deliveries =
      unit.group_mode === "per_group"
        ? groups.map((group) => [group])
        : [groups];
    for (const assigned of deliveries) {
      total++;
      const studyGroup =
        unit.group_mode === "per_group" ? assigned[0].id : null;
      let course = state.data.courses.find(
        (item) =>
          item.plan === plan.id &&
          item.teaching_unit === unit.id &&
          (item.study_group || null) === studyGroup,
      );
      if (!course) {
        course = Object.fromEntries(
          state.schema.courses.map((field) => [
            field.name,
            structuredClone(field.default),
          ]),
        );
        Object.assign(
          course,
          ...[
            "name",
            "target_mode",
            "target_units",
            "duration_minutes",
            "block_days",
            "week_pattern",
            "elective",
            "equipment",
          ].map((field) => ({ [field]: structuredClone(unit[field]) })),
          {
            id: Math.max(0, ...state.data.courses.map((item) => item.id)) + 1,
            code:
              `PLAN${plan.id}-LEHRE${unit.id}` +
              (studyGroup ? `-GR${studyGroup}` : ""),
            plan: plan.id,
            teaching_unit: unit.id,
            study_group: studyGroup,
            teachers: [...unit.teachers],
            groups: assigned.map((item) => item.id),
            learners: [],
          },
        );
        if (studyGroup) course.name = `${unit.name} · ${assigned[0].name}`;
        if (state.data.courses.some((item) => item.code === course!.code))
          throw new Error(
            "Kennung für die Semesterveranstaltung ist bereits vergeben.",
          );
        state.data.courses.push(course);
        created++;
      }
      if (!course.teachers.length)
        warnings.push(`${course.name}: Lehrende zuordnen.`);
      if (course.elective && !course.learners.length)
        warnings.push(
          `${course.name}: konkrete Wahlpflichtteilnehmer auswählen.`,
        );
    }
  }
  return { created, existing: total - created, warnings };
}
