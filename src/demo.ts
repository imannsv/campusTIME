import { DateTime } from "luxon";
import example from "./demo-data.json";
import type { Field, Row } from "./api";
import { cohortProgression, limitFields } from "./demo-progression";
import {
  checkStructure,
  validateStudy,
  studyAction,
  prepareSemester,
} from "./demo-study";

export type Store = {
  reference: string;
  schema: Record<string, Field[]>;
  institution: Row;
  data: Record<string, Row[]>;
  publications: Row[];
  audit: Row[];
};
const KEY = "campustime-browser-demo-v1";
const ZONE = "Europe/Berlin";
function initial(): Store {
  const copy = structuredClone(example) as unknown as Store;
  // Preserve weekdays when moving the fictional semester to the current week.
  const weeks = Math.floor(
    DateTime.now()
      .setZone(ZONE)
      .startOf("day")
      .diff(DateTime.fromISO(copy.reference, { zone: ZONE }), "days").days / 7,
  );
  function shift(value: any): any {
    if (Array.isArray(value)) return value.map(shift);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, shift(item)]),
      );
    if (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)
    ) {
      const time = DateTime.fromISO(value, { zone: ZONE }).plus({ weeks });
      return value.length === 10 ? time.toISODate() : time.toISO();
    }
    return value;
  }
  return shift(copy);
}
function read(): Store {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      const value = JSON.parse(saved);
      if (!value.data || !value.schema || !Array.isArray(value.publications))
        throw new Error();
      if (!value.data.studyversions) {
        // Upgrade the earlier demo in place; preserve room and schedule edits.
        const fresh = initial();
        value.schema = fresh.schema;
        for (const resource of ["studyversions", "modules", "teachingunits"])
          value.data[resource] = fresh.data[resource];
        for (const [resource, rows] of Object.entries(value.data) as [
          string,
          Row[],
        ][])
          for (const row of rows)
            for (const field of fresh.schema[resource] || [])
              if (row[field.name] === undefined)
                row[field.name] =
                  field.type === "relation"
                    ? null
                    : structuredClone(field.default);
        const cohortIds = new Map<number, number>();
        for (const item of fresh.data.cohorts.filter((row) =>
          row.code.startsWith("STUDY-"),
        )) {
          const existing = value.data.cohorts.find(
            (row: Row) => row.code === item.code,
          );
          const id =
            existing?.id ||
            Math.max(0, ...value.data.cohorts.map((row: Row) => row.id)) + 1;
          cohortIds.set(item.id, id);
          if (!existing) value.data.cohorts.push({ ...item, id });
        }
        for (const item of fresh.data.groups.filter((row) =>
          row.code.startsWith("STUDY-"),
        ))
          if (!value.data.groups.some((row: Row) => row.code === item.code))
            value.data.groups.push({
              ...item,
              id:
                Math.max(0, ...value.data.groups.map((row: Row) => row.id)) + 1,
              cohort: cohortIds.get(item.cohort),
            });
        localStorage.setItem(KEY, JSON.stringify(value));
      }
      if (
        !value.schema.teachingunits.some(
          (field: Field) => field.name === "group_mode",
        )
      ) {
        value.schema = initial().schema;
        for (const unit of value.data.teachingunits)
          unit.group_mode ??= "combined";
        for (const course of value.data.courses) course.study_group ??= null;
        localStorage.setItem(KEY, JSON.stringify(value));
      }
      if (
        !value.schema.modules.some(
          (field: Field) => field.name === "difficulty",
        )
      ) {
        value.schema = initial().schema;
        for (const module of value.data.modules) module.difficulty ??= 2;
        for (const cohort of value.data.cohorts) {
          cohort.study_schedule ??= {};
          for (const field of limitFields) cohort[field] ??= 0;
        }
        localStorage.setItem(KEY, JSON.stringify(value));
      }
      return value;
    }
    const value = initial();
    localStorage.setItem(KEY, JSON.stringify(value));
    return value;
  } catch {
    throw new Error(
      "Demodaten können nicht geladen werden. Erlaube Browserspeicher oder setze die Demo zurück.",
    );
  }
}
export function resetDemo() {
  localStorage.removeItem(KEY);
  window.location.reload();
}
function save(state: Store, action: string) {
  state.institution.revision++;
  state.audit.unshift({ action, created: DateTime.now().toISO() });
  state.audit = state.audit.slice(0, 10);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    throw new Error(
      "Browserspeicher voll oder gesperrt. Die Änderung wurde nicht gespeichert.",
    );
  }
}
function get(state: Store, resource: string, id: number): Row {
  const row = state.data[resource]?.find((item) => item.id === id);
  if (!row) throw new Error("Eintrag nicht gefunden.");
  return row;
}
function attendance(state: Store, entity: Row, exam: boolean) {
  const learnerIds = new Set<number>(entity.learners || []);
  let unknown = 0;
  const groupResources: number[] = [];
  if (!exam && !entity.elective)
    for (const id of entity.groups || []) {
      const group = get(state, "groups", id);
      const roster = state.data.people.filter(
        (person) => person.kind === "learner" && person.groups.includes(id),
      );
      roster.forEach((person) => learnerIds.add(person.id));
      unknown += Math.max(0, group.size - roster.length);
      if (group.size > roster.length) groupResources.push(id);
    }
  return {
    learner_ids: [...learnerIds],
    count: learnerIds.size + unknown,
    group_resources: groupResources,
  };
}
function rowsFor(state: Store, planId: number): Row[] {
  return state.data.sessions
    .filter((row) => row.plan === planId)
    .map((session) => {
      const isExam = !!session.exam;
      const entity = get(
        state,
        isExam ? "exams" : "courses",
        session.exam || session.course,
      );
      const rooms = (session.rooms || []).map((id: number) =>
        get(state, "rooms", id),
      );
      const teachers = session.teachers?.length
        ? session.teachers
        : entity[isExam ? "supervisors" : "teachers"];
      return {
        ...attendance(state, entity, isExam),
        id: session.id,
        plan_id: planId,
        course: session.course,
        exam: session.exam,
        name: session.name || entity.name,
        start: session.start,
        end: session.end,
        color: isExam ? "rose" : entity.color,
        equipment: entity.equipment,
        room_ids: rooms.map((room: Row) => room.id),
        room_names: rooms.map((room: Row) => room.name),
        teacher_ids: teachers,
        teacher_names: teachers.map(
          (id: number) => get(state, "people", id).name,
        ),
        group_names: isExam
          ? [entity.resit ? "Nachschreibeklausur" : "Klausur"]
          : entity.groups.map((id: number) => get(state, "groups", id).name),
        locked: session.locked,
        room_allocations: [],
      };
    });
}
const overlap = (a: Row, b: Row) =>
  Date.parse(a.start) < Date.parse(b.end) &&
  Date.parse(b.start) < Date.parse(a.end);
const intersects = (a: number[] = [], b: number[] = []) =>
  a.some((id) => b.includes(id));
function blocksFor(state: Store, start: string, end: string): Row[] {
  return state.data.blocks.flatMap((block) => {
    const result: Row[] = [];
    let from = DateTime.fromISO(block.start, { zone: ZONE });
    let to = DateTime.fromISO(block.end, { zone: ZONE });
    for (let index = 0; index < 80; index++) {
      const row = {
        ...block,
        start: from.toISO(),
        end: to.toISO(),
        room_ids: block.rooms,
      };
      if (overlap(row, { start, end })) result.push(row);
      if (!block.repeat_weekly) break;
      from = from.plus({ weeks: 1 });
      to = to.plus({ weeks: 1 });
      if (
        !block.repeat_until ||
        from.toISODate()! > block.repeat_until ||
        from.toMillis() >= Date.parse(end)
      )
        break;
    }
    return result;
  });
}
// Only basic overlap and capacity checks. The real Django validation remains local.
function conflictsFor(state: Store, planId: number): string[] {
  const own = rowsFor(state, planId);
  const other = state.publications
    .filter((publication) => publication.plan_id !== planId)
    .flatMap((publication) => publication.snapshot);
  const errors = new Set<string>();
  for (const row of own) {
    const rooms = row.room_ids.map((id: number) => get(state, "rooms", id));
    if (
      !rooms.length ||
      rooms.reduce((sum: number, room: Row) => sum + room.capacity, 0) <
        row.count
    )
      errors.add(`${row.name}: Raumkapazität reicht nicht aus.`);
    if (
      blocksFor(state, row.start, row.end).some((block) =>
        intersects(row.room_ids, block.room_ids),
      )
    )
      errors.add(`${row.name}: Raum ist blockiert.`);
    for (const candidate of [
      ...own.filter((item) => item.id !== row.id),
      ...other,
    ]) {
      if (
        overlap(row, candidate) &&
        (intersects(row.room_ids, candidate.room_ids) ||
          intersects(row.teacher_ids, candidate.teacher_ids) ||
          intersects(row.learner_ids, candidate.learner_ids) ||
          intersects(row.group_resources, candidate.group_resources))
      )
        errors.add(`${row.name}: Überschneidung mit ${candidate.name}.`);
    }
  }
  return [...errors];
}
function publicRow(row: Row, teachers: boolean): Row {
  const {
    learner_ids,
    teacher_ids,
    group_resources,
    room_allocations,
    count,
    equipment,
    ...visible
  } = row;
  return { ...visible, teacher_names: teachers ? row.teacher_names : [] };
}
function displayFor(state: Store, token: string, query: URLSearchParams) {
  const display = state.data.displays.find(
    (item) => item.token === token && item.active,
  );
  if (!display) throw new Error("Anzeige nicht gefunden oder deaktiviert.");
  const mode = display.view_mode;
  let start = query.get("since"),
    end = query.get("until");
  if (mode === "today" || mode === "tomorrow") {
    const day = DateTime.now()
      .setZone(ZONE)
      .startOf("day")
      .plus({ days: mode === "tomorrow" ? 1 : 0 });
    start = day.toISO();
    end = day.plus({ days: 1 }).toISO();
  }
  const publications = state.publications.filter((item) =>
    display.plans.includes(item.plan_id),
  );
  const allRows: Row[] = publications.flatMap((item) => item.snapshot);
  const periods = display.plans.map((id: number) =>
    get(state, "periods", get(state, "plans", id).period),
  );
  return {
    name: display.name,
    institution: state.institution.name,
    timezone: ZONE,
    view_mode: mode,
    window_start: start,
    window_end: end,
    revision: state.institution.revision,
    rows: allRows
      .filter(
        (row) =>
          (!start || Date.parse(row.end) > Date.parse(start)) &&
          (!end || Date.parse(row.start) < Date.parse(end)),
      )
      .map((row) => ({
        ...publicRow(row, display.show_teachers),
        blocked: blocksFor(state, row.start, row.end).some((block) =>
          intersects(row.room_ids, block.room_ids),
        ),
      })),
    available_from: allRows.map((row) => row.start).sort()[0] || null,
    weekdays: periods.length
      ? [...new Set(periods.flatMap((period: Row) => period.weekdays))].sort()
      : [0, 1, 2, 3, 4],
    day_start: periods.length
      ? Math.min(
          ...periods.map((period: Row) => {
            const [hour, minute] = period.day_start.split(":").map(Number);
            return hour + minute / 60;
          }),
        )
      : 8,
    day_end: periods.length
      ? Math.max(
          ...periods.map((period: Row) => {
            const [hour, minute] = period.day_end.split(":").map(Number);
            return hour + minute / 60;
          }),
        )
      : 18,
    auto_scroll: display.auto_scroll,
    scroll_seconds: display.scroll_seconds,
    updated:
      publications
        .map((item) => item.created)
        .sort()
        .at(-1) || null,
  };
}

export async function demoApi(
  path: string,
  method = "GET",
  body?: Row,
): Promise<any> {
  const state = read();
  const url = new URL(path, "https://demo.invalid/");
  const [resource, key, operation] = url.pathname.split("/").filter(Boolean);
  const id = Number(key);
  const query = url.searchParams;
  if (resource === "auth")
    return {
      authenticated: true,
      user: "Demo-Verwaltung",
      role: "admin",
      institution: state.institution,
      map_style: "",
    };
  if (resource === "bootstrap")
    return {
      schema: state.schema,
      counts: Object.fromEntries(
        Object.entries(state.data).map(([name, rows]) => [name, rows.length]),
      ),
      audit: state.audit,
    };
  if (resource === "jobs" && !key) return [];
  if (resource === "public") return displayFor(state, key, query);
  if (resource === "cohorts" && operation === "progression") {
    const cohort = get(state, resource, id);
    if (method !== "GET" && method !== "POST")
      throw new Error("GET oder POST erforderlich.");
    if (
      method === "POST" &&
      !["preview", "propose", "save"].includes(body?.operation || "preview")
    )
      throw new Error("Ungültige Aktion.");
    if (method === "POST" && body?.revision !== state.institution.revision)
      throw new Error(
        "Daten wurden inzwischen geändert. Gespeicherten Verlauf neu laden und Änderungen prüfen.",
      );
    const result = cohortProgression(
      state,
      cohort,
      method === "GET" ? {} : body || {},
    );
    if (method === "POST" && body?.operation === "save") {
      if (result.errors.length) throw new Error(result.errors.join("\n"));
      cohort.study_schedule = result.schedule;
      Object.assign(cohort, result.limits);
      save(state, `${cohort.name}: Jahrgangsverlauf angepasst`);
      result.revision = state.institution.revision;
    }
    return result;
  }
  if (resource === "studyversions" && operation) {
    const version = get(state, resource, id);
    if (operation === "check" && method === "GET")
      return checkStructure(state, version);
    if (method !== "POST") throw new Error("POST erforderlich.");
    const result = studyAction(state, version, operation, body || {});
    save(state, "Demo-Lehrplanversion aktualisiert");
    return result;
  }
  if (
    resource === "imports" ||
    resource === "jobs" ||
    ["solve", "template"].includes(operation)
  )
    throw new Error(
      "Diese Funktion benötigt das echte Backend und ist in der Browser-Demo nicht verfügbar.",
    );
  if (resource === "preferences") {
    for (const field of ["unit_minutes", "exam_max_per_day", "exam_gap_hours"])
      if (body?.[field] !== undefined) {
        const value = Number(body[field]);
        if (
          !Number.isInteger(value) ||
          value < (field === "exam_gap_hours" ? 0 : 1) ||
          value > (field === "unit_minutes" ? 240 : 10000)
        )
          throw new Error("Einstellung außerhalb des erlaubten Bereichs.");
        state.institution[field] = value;
      }
    save(state, "Demo-Einstellungen geändert");
    return { ok: true };
  }
  if (resource === "plans" && operation) {
    const plan = get(state, resource, id);
    if (operation === "prepare" && method === "POST") {
      const result = prepareSemester(state, plan, body || {});
      if (result.created) save(state, "Demo-Semester vorbereitet");
      return result;
    }
    const rows = rowsFor(state, id);
    const conflicts = conflictsFor(state, id);
    const publication =
      state.publications.find((item) => item.plan_id === id) || null;
    if (operation === "check") return { rows, conflicts, publication };
    if (operation === "publish") {
      if (conflicts.length) throw new Error(conflicts.join("\n"));
      const number = (publication?.number || 0) + 1;
      state.publications = state.publications.filter(
        (item) => item.plan_id !== id,
      );
      state.publications.push({
        plan_id: id,
        number,
        created: DateTime.now().toISO(),
        snapshot: rows,
      });
      save(state, "Demoanzeige aktualisiert");
      return { number };
    }
  }
  if (resource === "rooms" && operation === "occupancy") {
    get(state, resource, id);
    return {
      rows: state.publications
        .flatMap((item) => item.snapshot)
        .filter((row) => row.room_ids.includes(id))
        .map((row) => publicRow(row, true)),
    };
  }
  if (!state.data[resource] || operation)
    throw new Error("Diese Funktion ist in der Browser-Demo nicht verfügbar.");
  if (method === "GET") {
    if (key) return get(state, resource, id);
    let rows = state.data[resource];
    const search = query.get("search")?.toLocaleLowerCase("de");
    if (search)
      rows = rows.filter((row) =>
        `${row.name} ${row.code}`.toLocaleLowerCase("de").includes(search),
      );
    for (const field of [
      "plan",
      "floor",
      "building",
      "kind",
      "cohort",
      "program",
      "study_version",
      "module",
      "semester",
      "status",
    ])
      if (query.has(field))
        rows = rows.filter((row) => String(row[field]) === query.get(field));
    if (query.has("groups"))
      rows = rows.filter((row) =>
        row.groups?.includes(Number(query.get("groups"))),
      );
    const page = Math.max(1, Number(query.get("page")) || 1),
      size = Math.min(1000, Math.max(1, Number(query.get("page_size")) || 100));
    return {
      results: rows.slice((page - 1) * size, page * size),
      count: rows.length,
      next: page * size < rows.length ? true : null,
    };
  }
  if (method === "DELETE") {
    const record = get(state, resource, id);
    if (
      resource === "people" &&
      state.data.teachingunits.some(
        (unit) =>
          unit.teachers.includes(id) &&
          get(
            state,
            "studyversions",
            get(state, "modules", unit.module).study_version,
          ).status === "approved",
      )
    )
      throw new Error(
        "Person ist einer freigegebenen Studienstruktur zugeordnet. Verfügbarkeiten können weiterhin angepasst werden.",
      );
    validateStudy(state, resource, record, record, true);
    const inUse = Object.entries(state.schema).some(([name, fields]) =>
      fields.some(
        (field) =>
          field.resource === resource &&
          state.data[name].some((row) =>
            field.type === "many"
              ? row[field.name]?.includes(id)
              : row[field.name] === id,
          ),
      ),
    );
    if (inUse)
      throw new Error(
        "Eintrag wird noch verwendet. Zuerst die Zuordnungen entfernen.",
      );
    state.data[resource] = state.data[resource].filter((row) => row.id !== id);
    if (resource === "plans")
      state.publications = state.publications.filter(
        (item) => item.plan_id !== id,
      );
    save(state, `${resource}: Demo-Eintrag gelöscht`);
    return null;
  }
  const record = key
    ? structuredClone(get(state, resource, id))
    : Object.fromEntries(
        state.schema[resource].map((field) => [
          field.name,
          structuredClone(field.default),
        ]),
      );
  Object.assign(record, body);
  if (!key)
    record.id = Math.max(0, ...state.data[resource].map((row) => row.id)) + 1;
  if (
    state.data[resource].some(
      (row) => row.id !== record.id && record.code && row.code === record.code,
    )
  )
    throw new Error("Kennung ist bereits vergeben.");
  for (const field of state.schema[resource]) {
    const value = record[field.name];
    if (
      field.required &&
      (value === "" ||
        value === null ||
        value === undefined ||
        (Array.isArray(value) && !value.length))
    )
      throw new Error(`${field.name}: Pflichtfeld ausfüllen.`);
    if (field.resource && value !== "" && value !== null && value !== undefined)
      for (const related of field.type === "many" ? value : [value])
        get(state, field.resource, Number(related));
  }
  if (
    ["rooms", "groups"].includes(resource) &&
    (!Number.isInteger(record[resource === "rooms" ? "capacity" : "size"]) ||
      record[resource === "rooms" ? "capacity" : "size"] < 0)
  )
    throw new Error(
      "Kapazität und Gruppengröße müssen nichtnegative Ganzzahlen sein.",
    );
  if (
    record.start &&
    record.end &&
    Date.parse(record.end) <= Date.parse(record.start)
  )
    throw new Error("Ende muss nach Beginn liegen.");
  if (resource === "sessions") {
    if (!!record.course === !!record.exam)
      throw new Error("Genau einen Kurs oder eine Prüfung auswählen.");
    if (
      get(
        state,
        record.exam ? "exams" : "courses",
        record.exam || record.course,
      ).plan !== record.plan
    )
      throw new Error(
        "Veranstaltung und Termin müssen zum selben Plan gehören.",
      );
    if (record.repeat_weekly)
      throw new Error(
        "Wiederholungsserien sind in der Demo nicht verfügbar. Lege einzelne Termine an.",
      );
  }
  if (resource === "displays" && !key) record.token = crypto.randomUUID();
  if (resource === "cohorts")
    record.study_schedule = key
      ? get(state, resource, id).study_schedule || {}
      : {};
  validateStudy(state, resource, record, key ? get(state, resource, id) : null);
  if (resource === "blocks" && record.repeat_weekly && !record.repeat_until)
    throw new Error("Wiederholungsende auswählen.");
  state.data[resource] = [
    ...state.data[resource].filter((row) => row.id !== record.id),
    record,
  ].sort((a, b) => a.id - b.id);
  if (resource === "sessions") {
    const conflicts = conflictsFor(state, record.plan);
    if (conflicts.length) throw new Error(conflicts.join("\n"));
  }
  save(state, `${resource}: Demo-Eintrag gespeichert`);
  return record;
}
