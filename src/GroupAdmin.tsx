import { useState } from "react";
import { GraduationCap, UsersRound, Pencil, Plus, Users } from "lucide-react";
import type { Row } from "./api";
import "./groups.css";

export default function GroupAdmin({
  data,
  query,
  currentYear,
  onEdit,
  onOpenPeople,
}: {
  data: Record<string, Row[]>;
  query: string;
  currentYear: number;
  onEdit: (resource: string, record?: Row, defaults?: Row) => void;
  onOpenPeople: (group: number) => void;
}) {
  const [year, setYear] = useState("");
  const [program, setProgram] = useState("");
  const cohorts = data.cohorts || [];
  const groups = data.groups || [];
  const programs = data.programs || [];
  const search = query.trim().toLocaleLowerCase("de");
  const visible = cohorts
    .filter((cohort) => {
      const children = groups.filter((group) => group.cohort === cohort.id);
      const course = programs.find((item) => item.id === cohort.program);
      return (
        (!year || String(cohort.entry_year || "other") === year) &&
        (!program || cohort.program === Number(program)) &&
        `${cohort.name} ${cohort.code} ${cohort.entry_year || ""} ${course?.name || ""} ${children.map((group) => `${group.name} ${group.code}`).join(" ")}`
          .toLocaleLowerCase("de")
          .includes(search)
      );
    })
    .sort(
      (a, b) =>
        (b.entry_year || 0) - (a.entry_year || 0) ||
        a.name.localeCompare(b.name, "de", { numeric: true }),
    );
  const years = [
    ...new Set(cohorts.map((cohort) => String(cohort.entry_year || "other"))),
  ].sort((a, b) =>
    a === "other" ? 1 : b === "other" ? -1 : Number(b) - Number(a),
  );
  function add(resource: string, defaults: Row = {}) {
    const random = crypto.getRandomValues(new Uint8Array(8));
    const code = `${resource === "cohorts" ? "JG" : resource === "groups" ? "GR" : "SG"}-${Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    onEdit(resource, undefined, { code, ...defaults });
  }
  const addCohort = () =>
    add("cohorts", {
      entry_year: year && year !== "other" ? Number(year) : currentYear,
      program: program
        ? Number(program)
        : programs.length === 1
          ? programs[0].id
          : null,
    });
  return (
    <section className="group-admin">
      <header className="page-actions">
        <div>
          <span className="group-eyebrow">
            <UsersRound size={16} aria-hidden="true" /> Verwaltung
          </span>
          <h1>Gruppen & Jahrgänge</h1>
          <p className="resource-description">
            Jahrgänge anlegen, Gruppen ergänzen und alles direkt zuordnen.
          </p>
        </div>
        <div className="group-actions">
          <button
            className="button secondary"
            disabled={!cohorts.length}
            onClick={() =>
              add("groups", {
                cohort: visible.length === 1 ? visible[0].id : null,
                size: 0,
              })
            }
          >
            <Plus size={17} aria-hidden="true" /> Gruppe hinzufügen
          </button>
          <button
            className="button primary"
            disabled={!programs.length}
            onClick={addCohort}
          >
            <Plus size={17} aria-hidden="true" /> Jahrgang hinzufügen
          </button>
        </div>
      </header>
      <div className="group-filters">
        <label>
          Aufnahmejahr filtern
          <select
            value={year}
            onChange={(event) => setYear(event.target.value)}
          >
            <option value="">Alle Aufnahmejahre</option>
            {years.map((value) => (
              <option key={value} value={value}>
                {value === "other" ? "Ohne Aufnahmejahr" : value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Studien-/Bildungsgang filtern
          <select
            value={program}
            onChange={(event) => setProgram(event.target.value)}
          >
            <option value="">Alle Studien- und Bildungsgänge</option>
            {programs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <p role="status">
          {visible.length} von {cohorts.length} Jahrgängen
        </p>
      </div>
      {!programs.length ? (
        <div className="group-empty">
          <GraduationCap size={30} aria-hidden="true" />
          <h2>Der erste Schritt: ein Studien- oder Bildungsgang</h2>
          <p>Danach kannst du hier Jahrgänge und ihre Gruppen hinzufügen.</p>
          <button className="button primary" onClick={() => add("programs")}>
            <Plus size={17} aria-hidden="true" /> Studien-/Bildungsgang
            hinzufügen
          </button>
        </div>
      ) : !visible.length ? (
        <div className="group-empty">
          <Users size={30} aria-hidden="true" />
          <h2>
            {cohorts.length
              ? "Keine passenden Jahrgänge"
              : "Platz für deinen ersten Jahrgang"}
          </h2>
          <p>
            {cohorts.length
              ? "Passe die Suche oder die Filter an."
              : "Lege einen Jahrgang an und ergänze anschließend seine Gruppen oder Klassen."}
          </p>
          {!cohorts.length && (
            <button className="button primary" onClick={addCohort}>
              Jahrgang hinzufügen
            </button>
          )}
        </div>
      ) : (
        <div className="group-cohorts">
          {visible.map((cohort) => {
            const children = groups
              .filter((group) => group.cohort === cohort.id)
              .sort((a, b) =>
                a.name.localeCompare(b.name, "de", { numeric: true }),
              );
            const course = programs.find((item) => item.id === cohort.program);
            return (
              <article
                key={cohort.id}
                className="group-cohort"
                aria-label={cohort.name}
              >
                <header>
                  <span className="group-year">
                    {cohort.entry_year || "Ohne Aufnahmejahr"}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Jahrgang bearbeiten"
                    onClick={() => onEdit("cohorts", cohort)}
                  >
                    <Pencil size={17} aria-hidden="true" />
                  </button>
                </header>
                <h2>{cohort.name}</h2>
                <p className="group-program">
                  <GraduationCap size={16} aria-hidden="true" />{" "}
                  {course?.name || "Ohne Studien-/Bildungsgang"}
                </p>
                <div className="group-children">
                  {children.map((group) => (
                    <div className="group-child" key={group.id}>
                      <div>
                        <strong>{group.name}</strong>
                        <span>Gruppengröße: {group.size}</span>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`Gruppe ${group.name} bearbeiten`}
                        onClick={() => onEdit("groups", group)}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Personen der Gruppe ${group.name} öffnen`}
                        title="Personen verwalten"
                        onClick={() => onOpenPeople(group.id)}
                      >
                        <Users size={18} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  {!children.length && (
                    <p className="group-no-children">
                      Noch keine Gruppen. Füge die erste Gruppe oder Klasse
                      hinzu.
                    </p>
                  )}
                </div>
                <button
                  className="button secondary group-add-child"
                  onClick={() => add("groups", { cohort: cohort.id, size: 0 })}
                >
                  <Plus size={16} aria-hidden="true" /> Gruppe hinzufügen
                </button>
              </article>
            );
          })}
        </div>
      )}
      <p className="group-help">
        Eine Kennung wird beim Anlegen vorgeschlagen und kann geändert werden.
        Lehrplan und Semesterverteilung verwaltest du weiterhin unter
        Einrichtung & Studienstruktur.
      </p>
    </section>
  );
}
