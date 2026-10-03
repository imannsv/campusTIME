import type { Row } from "./api";
import type { Store } from "./demo";

export const limitFields = [
  "semester_credit_limit",
  "semester_weekly_limit",
  "semester_difficulty_limit",
];
export const effectiveSemester = (cohort: Row, unit: Row) =>
  cohort.study_schedule?.[unit.id]?.semester ?? unit.semester;

export function cohortProgression(
  state: Store,
  cohort: Row,
  body: Row = {},
): Row {
  const selectedVersion = state.data.studyversions.find(
    (row) => row.id === cohort.study_version,
  );
  if (!selectedVersion || selectedVersion.status !== "approved")
    throw new Error("Jahrgang mit freigegebener Lehrplanversion wählen.");
  const version: Row = selectedVersion;
  const modules = state.data.modules.filter(
    (row) => row.study_version === version.id,
  );
  const units = state.data.teachingunits.filter((unit) =>
    modules.some((module) => module.id === unit.module),
  );
  const children = (id: number) => modules.filter((row) => row.parent === id);
  const owned = (id: number) => units.filter((row) => row.module === id);
  const descendants = (id: number): Row[] => [
    ...owned(id),
    ...children(id).flatMap((row) => descendants(row.id)),
  ];
  const shares: Row = {},
    difficulty: Row = {};
  function allocate(module: Row, budget: number) {
    const parts = children(module.id),
      direct = owned(module.id);
    const childCredits = parts.reduce(
      (sum, row) => sum + Number(row.credits),
      0,
    );
    const weights = parts.map((row) =>
      childCredits ? Number(row.credits) : 1,
    );
    const ownWeight = childCredits
      ? Math.max(Number(module.credits) - childCredits, 0)
      : direct.length
        ? 1
        : 0;
    const total = weights.reduce((sum, weight) => sum + weight, 0) + ownWeight;
    parts.forEach((part, index) =>
      allocate(part, total ? (budget * weights[index]) / total : 0),
    );
    direct.forEach((unit) => {
      shares[unit.id] = total
        ? (budget * ownWeight) / total / direct.length
        : 0;
      difficulty[unit.id] = Number(module.difficulty ?? 2);
    });
  }
  modules
    .filter((row) => !row.parent)
    .forEach((row) => allocate(row, Number(row.credits)));
  const edges = modules.flatMap((module) =>
    module.prerequisites.flatMap((id: number) =>
      descendants(id).flatMap((before) =>
        descendants(module.id).map((after) => ({
          before: before.id,
          after: after.id,
          beforeName: modules.find((row) => row.id === id)!.name,
          afterName: module.name,
        })),
      ),
    ),
  );
  const locked = new Set(
    state.data.courses
      .filter(
        (course) =>
          state.data.plans.some(
            (plan) => plan.id === course.plan && plan.cohort === cohort.id,
          ) && course.teaching_unit,
      )
      .map((course) => course.teaching_unit),
  );
  let schedule: Row = Object.fromEntries(
    units.map((unit) => [unit.id, unit.semester]),
  );
  const pins = new Set<number>(locked),
    changes = body.schedule ?? cohort.study_schedule ?? {};
  if (!changes || Array.isArray(changes) || typeof changes !== "object")
    throw new Error("Semesterverteilung muss ein Objekt sein.");
  let normalized: Row = {};
  for (const [key, value] of Object.entries(changes) as [string, Row][]) {
    const unit = units.find((row) => String(row.id) === key);
    if (
      !unit ||
      !value ||
      typeof value !== "object" ||
      Object.keys(value).some((key) => !["semester", "pinned"].includes(key))
    )
      throw new Error(
        "Nur Lehrveranstaltungen der gewählten Lehrplanversion verschieben.",
      );
    if (
      !Number.isInteger(value.semester) ||
      value.semester < 1 ||
      value.semester > version.duration_semesters ||
      (value.pinned !== undefined && typeof value.pinned !== "boolean")
    )
      throw new Error("Gültiges Fachsemester und Fixierung angeben.");
    schedule[unit.id] = value.semester;
    if (value.pinned) pins.add(unit.id);
    if (value.semester !== unit.semester || value.pinned)
      normalized[key] = { semester: value.semester, pinned: !!value.pinned };
  }
  for (const unit of units)
    if (
      locked.has(unit.id) &&
      schedule[unit.id] !== effectiveSemester(cohort, unit)
    )
      throw new Error(
        `${unit.name}: Semesterplan besteht bereits; die Zuordnung bleibt erhalten.`,
      );
  const limits: Row = {};
  for (const field of limitFields) {
    const value = Number(body.limits?.[field] ?? cohort[field] ?? 0);
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > 10000 ||
      (field !== "semester_credit_limit" && !Number.isInteger(value)) ||
      (field === "semester_credit_limit" &&
        Math.abs(value * 10 - Math.round(value * 10)) > 0.00001)
    )
      throw new Error("Gültige Belastungsgrenzen von 0–10.000 angeben.");
    limits[field] = value;
  }
  const caps: Row = {
    credits:
      limits.semester_credit_limit ||
      Object.values(shares).reduce(
        (sum: number, value: any) => sum + value,
        0,
      ) / version.duration_semesters,
    weekly_units: limits.semester_weekly_limit,
    difficulty:
      limits.semester_difficulty_limit ||
      units.reduce(
        (sum, unit) =>
          sum + (shares[unit.id] || 0) * (difficulty[unit.id] || 2),
        0,
      ) / version.duration_semesters,
  };
  function loads(assignment: Row): Row[] {
    const rows: Row[] = Array.from(
      { length: version.duration_semesters },
      (_, index) => ({
        semester: index + 1,
        credits: 0,
        weekly_units: 0,
        total_units: 0,
        difficulty: 0,
        count: 0,
      }),
    );
    for (const unit of units) {
      const row = rows[assignment[unit.id] - 1],
        share = shares[unit.id] || 0;
      row.credits += share;
      row.difficulty += share * (difficulty[unit.id] || 2);
      row.count++;
      if (unit.target_mode === "weekly")
        row.weekly_units +=
          unit.target_units * (unit.week_pattern === "all" ? 1 : 0.5);
      else row.total_units += unit.target_units;
    }
    return rows;
  }
  function report(assignment: Row, overrides: Row): Row {
    const errors = [
      ...new Set(
        edges
          .filter((edge) => assignment[edge.before] >= assignment[edge.after])
          .map(
            (edge) =>
              `${edge.afterName}: Voraussetzung ${edge.beforeName} muss vorher abgeschlossen sein (Semester ${assignment[edge.before]} vor Semester ${assignment[edge.after]}).`,
          ),
      ),
    ];
    const semesters = loads(assignment),
      warnings: string[] = [],
      names: Row = {
        credits: "CP-Anteile",
        weekly_units: "UE pro Woche",
        difficulty: "Belastungspunkte",
      };
    for (const row of semesters) {
      row.overloaded = false;
      for (const metric of Object.keys(caps))
        if (caps[metric] && row[metric] > caps[metric] + 0.001) {
          warnings.push(
            `Semester ${row.semester}: ${row[metric].toFixed(1)} ${names[metric]} überschreiten die Planungsgrenze ${caps[metric].toFixed(1)}.`,
          );
          row.overloaded = true;
        }
      for (const metric of ["credits", "weekly_units", "difficulty"])
        row[metric] = Math.round(row[metric] * 100) / 100;
    }
    return {
      revision: state.institution.revision,
      schedule: overrides,
      limits,
      caps,
      semesters,
      errors,
      warnings,
      entries: units.map((unit) => ({
        id: unit.id,
        name: unit.name,
        module: unit.module,
        standard_semester: unit.semester,
        semester: assignment[unit.id],
        pinned: !!overrides[unit.id]?.pinned,
        locked: locked.has(unit.id),
        credits: Math.round((shares[unit.id] || 0) * 100) / 100,
        difficulty: difficulty[unit.id] || 2,
      })),
    };
  }
  if (body.operation !== "propose") return report(schedule, normalized);
  const initial = { ...schedule };
  function repair(assignment: Row, fixed: Set<number>): Row | null {
    for (let pass = 0; pass < units.length * 2 + 1; pass++) {
      const violations = edges.filter(
        (edge) => assignment[edge.before] >= assignment[edge.after],
      );
      if (!violations.length) return assignment;
      let changed = false;
      for (const edge of violations) {
        if (
          !fixed.has(edge.after) &&
          assignment[edge.before] < version.duration_semesters
        ) {
          assignment[edge.after] = assignment[edge.before] + 1;
          changed = true;
        } else if (!fixed.has(edge.before) && assignment[edge.after] > 1) {
          assignment[edge.before] = assignment[edge.after] - 1;
          changed = true;
        }
      }
      if (!changed) break;
    }
    return null;
  }
  const repaired = repair(schedule, pins);
  if (!repaired)
    return {
      ...report(initial, normalized),
      moves: [],
      message:
        "Voraussetzungen lassen sich mit den fixierten Semestern nicht erfüllen. Fixierungen oder Verschiebungen prüfen.",
    };
  schedule = repaired;
  const score = (assignment: Row) =>
    loads(assignment).reduce(
      (sum, row) =>
        sum +
        Object.keys(caps).reduce((part, metric) => {
          if (!caps[metric]) return part;
          const ratio = row[metric] / caps[metric];
          return part + ratio * ratio + 12 * Math.max(0, ratio - 1) ** 2;
        }, 0),
      0,
    ) +
    0.03 *
      Object.keys(assignment).reduce(
        (sum, id) => sum + Math.abs(assignment[id] - initial[id]),
        0,
      );
  const movable = units
    .filter((unit) => !pins.has(unit.id))
    .map((unit) => unit.id);
  let evaluated = 0;
  for (let pass = 0; pass < 12; pass++) {
    let best: Row | null = null,
      bestScore = score(schedule);
    const consider = (candidate: Row, fixed: number[]) => {
      if (evaluated++ >= 10000) return;
      const repaired = repair(candidate, new Set([...pins, ...fixed]));
      if (!repaired) return;
      const value = score(candidate);
      if (value < bestScore - 0.000001) {
        best = candidate;
        bestScore = value;
      }
    };
    for (const id of movable)
      for (
        let semester = 1;
        semester <= version.duration_semesters && evaluated < 10000;
        semester++
      )
        consider({ ...schedule, [id]: semester }, [id]);
    if (!best)
      for (let i = 0; i < movable.length; i++)
        for (let j = i + 1; j < movable.length && evaluated < 10000; j++) {
          const left = movable[i],
            right = movable[j];
          if (schedule[left] !== schedule[right])
            consider(
              {
                ...schedule,
                [left]: schedule[right],
                [right]: schedule[left],
              },
              [left, right],
            );
        }
    if (!best) break;
    schedule = best;
  }
  normalized = Object.fromEntries(
    units
      .filter(
        (unit) =>
          schedule[unit.id] !== unit.semester || normalized[unit.id]?.pinned,
      )
      .map((unit) => [
        unit.id,
        { semester: schedule[unit.id], pinned: !!normalized[unit.id]?.pinned },
      ]),
  );
  const moves = units
    .filter((unit) => schedule[unit.id] !== initial[unit.id])
    .map((unit) => ({
      id: unit.id,
      name: unit.name,
      from: initial[unit.id],
      to: schedule[unit.id],
    }));
  return {
    ...report(schedule, normalized),
    moves,
    message: moves.length
      ? "Vorschlag berücksichtigt Voraussetzungen, Fixierungen und Semesterbelastung. Vor dem Speichern fachlich prüfen."
      : "Mit diesen Grenzen und Fixierungen wurde keine weitere Verbesserung gefunden.",
  };
}
