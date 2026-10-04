import type { Row } from "./api";
import type { Store } from "./demo";

export function enrichDemoSnapshot(state: Store, rows: Row[]): Row[] {
  return rows.map((row) => {
    if (row.overview_scope) return row;
    const learnerGroups = state.data.people
      .filter(
        (person) =>
          person.kind === "learner" && row.learner_ids?.includes(person.id),
      )
      .flatMap((person) => person.groups);
    const hasNamedGroups = state.data.groups.some((group) =>
      row.group_names?.includes(group.name),
    );
    const groups = state.data.groups
      .filter(
        (group) =>
          (row.group_ids
            ? row.group_ids.includes(group.id)
            : row.group_names?.includes(group.name)) ||
          ((row.exam || !hasNamedGroups) && learnerGroups.includes(group.id)),
      )
      .map((group) => ({
        id: group.id,
        name: group.name,
        cohort: group.cohort,
        cohort_name:
          state.data.cohorts.find((cohort) => cohort.id === group.cohort)
            ?.name || "Jahrgang",
      }));
    const exam = state.data.exams.find((item) => item.id === row.exam);
    const courseId = row.course || exam?.course;
    const publishedCourse = rows.find((item) => item.course === courseId);
    const course = state.data.courses.find((item) => item.id === courseId);
    return {
      ...row,
      overview_scope: {
        groups,
        course: courseId ? `course:${courseId}` : `exam:${row.exam}`,
        course_name:
          publishedCourse?.course_name ||
          publishedCourse?.name ||
          course?.name ||
          row.name,
      },
    };
  });
}

export function overviewCatalog(rows: Row[]): Row {
  const cohorts = new Map(),
    groups = new Map(),
    courses = new Map();
  for (const row of rows) {
    const scope = row.overview_scope;
    const course = courses.get(scope.course) || {
      id: scope.course,
      name: scope.course_name,
      group_ids: new Set(),
      cohort_ids: new Set(),
    };
    for (const group of scope.groups) {
      cohorts.set(group.cohort, { id: group.cohort, name: group.cohort_name });
      groups.set(group.id, {
        id: group.id,
        name: group.name,
        cohort: group.cohort,
      });
      course.group_ids.add(group.id);
      course.cohort_ids.add(group.cohort);
    }
    courses.set(scope.course, course);
  }
  return Object.fromEntries(
    [
      ["cohorts", cohorts],
      ["groups", groups],
      ["courses", courses],
    ].map(([key, items]) => [
      key,
      [...(items as Map<any, any>).values()]
        .map((item) =>
          item.group_ids
            ? {
                ...item,
                group_ids: [...item.group_ids],
                cohort_ids: [...item.cohort_ids],
              }
            : item,
        )
        .sort((a, b) => a.name.localeCompare(b.name, "de")),
    ]),
  );
}

export function matchesOverview(row: Row, filters: Row): boolean {
  const scope = row.overview_scope;
  return (
    (!filters.course || scope.course === filters.course) &&
    (!filters.group ||
      scope.groups.some((group: Row) => String(group.id) === filters.group)) &&
    (!filters.cohort ||
      scope.groups.some(
        (group: Row) => String(group.cohort) === filters.cohort,
      ))
  );
}
