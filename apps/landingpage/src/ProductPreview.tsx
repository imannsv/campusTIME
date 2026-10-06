import { useState } from "react";
import { Icon, Logo } from "./Icon";

const days = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];
const events = [
  {
    day: 0,
    row: 1,
    title: "Projektmanagement",
    room: "A.204",
    group: "WI26 · Gruppe A",
    time: "08:30–10:00",
    tone: "mint",
  },
  {
    day: 1,
    row: 2,
    title: "Mathematik",
    room: "B.101",
    group: "WI26 · Gruppe A",
    time: "10:15–11:45",
    tone: "blue",
  },
  {
    day: 2,
    row: 1,
    title: "Datenbanken",
    room: "PC-Labor",
    group: "WI26 · Gruppe A",
    time: "08:30–10:00",
    tone: "lavender",
  },
  {
    day: 2,
    row: 3,
    title: "Wirtschaftsrecht",
    room: "A.202",
    group: "WI26 · Gruppe B",
    time: "12:15–13:45",
    tone: "sand",
  },
  {
    day: 3,
    row: 2,
    title: "Projektmanagement",
    room: "A.204",
    group: "WI26 · Gruppe B",
    time: "10:15–11:45",
    tone: "mint",
  },
  {
    day: 4,
    row: 1,
    title: "Statistik",
    room: "B.101",
    group: "WI26 · Gruppe B",
    time: "08:30–10:00",
    tone: "blue",
  },
];

function Event({ event }: { event: (typeof events)[number] }) {
  return (
    <div className={`schedule-event ${event.tone}`}>
      <span className="event-time">{event.time}</span>
      <strong>{event.title}</strong>
      <span>
        {event.room} · {event.group}
      </span>
    </div>
  );
}

export function Schedule({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "schedule compact" : "schedule"}>
      <div className="schedule-toolbar">
        <div>
          <strong>
            {compact ? "Das Semester im Überblick" : "Wochenplanung"}
          </strong>
          <span>Wirtschaftsinformatik · WI26</span>
        </div>
        <span className="status-label">
          <Icon name="check" />
          Freigegeben
        </span>
      </div>
      <div className="week-bar">
        <span>5.–9. Oktober 2026</span>
        <span className="week-selection">Woche 41</span>
      </div>
      <div className="week-calendar">
        <div className="calendar-corner" />
        {days.map((day, index) => (
          <div
            className="day-label"
            key={day}
            style={{ gridColumn: index + 2 }}
          >
            <span>{compact ? day.slice(0, 2) : day}</span>
            <strong>{index + 5}</strong>
          </div>
        ))}
        {["08:30", "10:15", "12:15", "14:00"].map((hour, index) => (
          <span
            className="hour-label"
            key={hour}
            style={{ gridRow: index + 2 }}
          >
            {hour}
          </span>
        ))}
        {days.flatMap((day, column) =>
          [1, 2, 3, 4].map((row) => (
            <div
              className="calendar-cell"
              key={`${day}-${row}`}
              style={{ gridColumn: column + 2, gridRow: row + 1 }}
            />
          )),
        )}
        {events.map((event, index) => (
          <div
            className="event-position"
            key={index}
            style={{ gridColumn: event.day + 2, gridRow: event.row + 1 }}
          >
            <Event event={event} />
          </div>
        ))}
      </div>
      <div className="mobile-calendar">
        {events.slice(0, 4).map((event, index) => (
          <div className="mobile-day" key={index}>
            <span>
              {days[event.day]}
              <strong>{event.day + 5}. Oktober</strong>
            </span>
            <Event event={event} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Rooms() {
  const rooms = [
    {
      name: "Seminarraum A.204",
      capacity: "32 Plätze",
      equipment: "Beamer · Whiteboard",
      available: "Ab 10:00 frei",
      kind: "seminar",
    },
    {
      name: "PC-Labor A.206",
      capacity: "24 Plätze",
      equipment: "PCs · Beamer",
      available: "Ab 11:45 frei",
      kind: "lab",
    },
    {
      name: "Seminarraum A.202",
      capacity: "28 Plätze",
      equipment: "Beamer · Whiteboard",
      available: "Heute keine Belegung",
      kind: "seminar",
    },
  ];
  return (
    <div className="room-demo">
      <div className="schedule-toolbar">
        <div>
          <strong>Räume und Belegung</strong>
          <span>Bereich A · 2. Stockwerk</span>
        </div>
        <Icon name="room" />
      </div>
      <div className="room-grid">
        {rooms.map((room) => (
          <article className="room-tile" key={room.name}>
            <div className={`room-drawing ${room.kind}`} aria-hidden="true">
              <div className="room-table" />
              <span />
              <span />
              <span />
              <span />
            </div>
            <h3>{room.name}</h3>
            <p>{room.capacity}</p>
            <span>{room.equipment}</span>
            <div className="room-availability">
              <span className="status-dot" />
              {room.available}
            </div>
          </article>
        ))}
      </div>
      <p className="preview-note">
        Raumdetails zeigen freigegebene Belegungen. Kapazitäten und Sperrzeiten
        werden bei der Planung geprüft.
      </p>
    </div>
  );
}

function Exams() {
  return (
    <div className="exam-demo">
      <div className="schedule-toolbar">
        <div>
          <strong>Prüfungen und Abgaben</strong>
          <span>WI26 · 1. Semester</span>
        </div>
        <Icon name="exam" />
      </div>
      <div className="exam-row">
        <div className="exam-date">
          <strong>19</strong>
          <span>Oktober</span>
        </div>
        <div>
          <h3>Statistik · Klausur</h3>
          <p>09:00–11:00 · 120 Minuten</p>
          <span>B.101 und B.102 · je eine Aufsicht</span>
        </div>
        <span className="exam-tag">Geplant</span>
      </div>
      <div className="exam-row">
        <div className="exam-date">
          <strong>26</strong>
          <span>Oktober</span>
        </div>
        <div>
          <h3>Projektmanagement · Hausarbeit</h3>
          <p>Interne Abgabefrist · 23:59</p>
          <span>Anforderung aus dem Modul übernommen</span>
        </div>
        <span className="exam-tag muted-tag">Abgabe</span>
      </div>
      <p className="preview-note">
        Prüfungsformen, Dauer und Anforderungen aus dem Lehrplan übernehmen;
        konkrete Termine und interne Abgaben getrennt verwalten.
      </p>
    </div>
  );
}

type View = "schedule" | "rooms" | "exams";
export function ProductPreview() {
  const [view, setView] = useState<View>("schedule");
  return (
    <figure
      className="product-preview"
      role="region"
      aria-label="Produktvorschau"
    >
      <div
        className="preview-switcher enhanced-only"
        role="group"
        aria-label="Produktansicht auswählen"
      >
        {(
          [
            ["schedule", "Stundenplan", "calendar"],
            ["rooms", "Räume", "room"],
            ["exams", "Prüfungen", "exam"],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            <Icon name={icon} />
            {label}
          </button>
        ))}
      </div>
      <div className="product-window">
        <div className="window-top">
          <Logo />
          <span>Fiktive Produktansicht</span>
          <span className="window-avatar" aria-hidden="true">
            V
          </span>
        </div>
        <div className="product-content">
          {view === "schedule" ? (
            <Schedule />
          ) : view === "rooms" ? (
            <Rooms />
          ) : (
            <Exams />
          )}
        </div>
      </div>
      <figcaption>
        Vereinfachte UI-Beispiele mit fiktiven Daten. Die vollständige
        Oberfläche können Sie in der Browser-Demo ausprobieren.
      </figcaption>
    </figure>
  );
}
