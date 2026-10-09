import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { api, fmt, Row } from "./api";
import ResourceOverview from "./ResourceOverview";

type Props = {
  areaId: number | null;
  onAreaChange: (id: number) => void;
  onContextChange: (context: Row) => void;
  data: Record<string, Row[]>;
  zone: string;
  query: string;
  revision: number;
  onEdit: (resource: string, record?: Row, defaults?: Row) => void;
};

export default function RoomOverview({
  areaId,
  onAreaChange,
  data,
  zone,
  query,
  onEdit,
  onContextChange,
  revision,
}: Props) {
  const [view, setView] = useState("occupancy");
  const [floorId, setFloorId] = useState<number | null>(null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [occupancy, setOccupancy] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const areas = data.buildings || [];
  const area = areas.find((item) => item.id === areaId) || areas[0];
  const floors = (data.floors || [])
    .filter((item) => item.building === area?.id)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "de"));
  const currentFloor = floors.find((item) => item.id === floorId);
  useEffect(() => {
    setFloorId(null);
    setRoomId(null);
  }, [area?.id]);
  useEffect(
    () =>
      onContextChange({
        building: area?.id || null,
        floor: currentFloor?.id || null,
      }),
    [area?.id, currentFloor?.id, onContextChange],
  );
  const scopedRooms = (data.rooms || [])
    .filter((room) => floors.some((floor) => floor.id === room.floor))
    .filter((room) => !currentFloor || room.floor === currentFloor.id);
  const rooms = scopedRooms
    .filter((room) =>
      `${room.name} ${room.code} ${(room.equipment || []).join(" ")}`
        .toLocaleLowerCase("de")
        .includes(query.toLocaleLowerCase("de").trim()),
    )
    .filter((room) =>
      `${room.name} ${room.code} ${(room.equipment || []).join(" ")}`
        .toLocaleLowerCase("de")
        .includes(search.toLocaleLowerCase("de").trim()),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true }));
  const selected = rooms.find((room) => room.id === roomId);
  const selectedFloor = floors.find((floor) => floor.id === selected?.floor);
  useEffect(() => {
    let active = true;
    setOccupancy([]);
    setError("");
    setLoading(!!selected);
    if (selected) {
      api(`rooms/${selected.id}/occupancy/`)
        .then((result) => {
          if (active) setOccupancy(result.rows);
        })
        .catch((err) => {
          if (active) setError(err.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [selected]);

  function chooseArea(id: number) {
    onAreaChange(id);
    setFloorId(null);
    setRoomId(null);
  }

  return (
    <section className="room-overview" aria-label="Raumverwaltung">
      <div className="room-view-switch" role="group" aria-label="Raumansicht">
        <button
          aria-pressed={view === "occupancy"}
          onClick={() => setView("occupancy")}
        >
          Raumbelegung
        </button>
        <button
          aria-pressed={view === "catalog"}
          onClick={() => setView("catalog")}
        >
          Raumverwaltung
        </button>
      </div>
      <div className="room-header">
        <div
          className="room-actions"
          role="group"
          aria-label="Räume verwalten"
          hidden={view !== "catalog"}
        >
          <button
            className="button secondary"
            onClick={() => onEdit("buildings")}
          >
            Bereich hinzufügen
          </button>
          <button
            className="button secondary"
            disabled={!area}
            onClick={() => onEdit("floors", undefined, { building: area.id })}
          >
            Stockwerk hinzufügen
          </button>
          <button
            className="button primary"
            disabled={!floors.length}
            onClick={() =>
              onEdit("rooms", undefined, {
                floor: currentFloor?.id || floors[0]?.id,
              })
            }
          >
            Raum hinzufügen
          </button>
        </div>
        {areas.length > 0 && (
          <div className="room-area-tabs" role="group" aria-label="Bereiche">
            {areas.map((item) => (
              <button
                key={item.id}
                className={area.id === item.id ? "active" : ""}
                aria-pressed={area.id === item.id}
                onClick={() => chooseArea(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {areas.length ? (
        <>
          <div className="room-floor-bar">
            <div
              className="room-floor-tabs"
              role="group"
              aria-label="Stockwerke"
            >
              <button
                className={!currentFloor ? "active" : ""}
                aria-pressed={!currentFloor}
                onClick={() => {
                  setFloorId(null);
                  setRoomId(null);
                }}
              >
                Alle Stockwerke
              </button>
              {floors.map((floor) => (
                <button
                  key={floor.id}
                  className={currentFloor?.id === floor.id ? "active" : ""}
                  aria-pressed={currentFloor?.id === floor.id}
                  onClick={() => {
                    setFloorId(floor.id);
                    setRoomId(null);
                  }}
                >
                  {floor.name}
                </button>
              ))}
            </div>
            <button
              className="text-button"
              onClick={() => onEdit("buildings", area)}
            >
              Bereich bearbeiten
            </button>
            {currentFloor && (
              <button
                className="text-button"
                onClick={() => onEdit("floors", currentFloor)}
              >
                Stockwerk bearbeiten
              </button>
            )}
          </div>
          {view === "occupancy" ? (
            <ResourceOverview
              kind="rooms"
              zone={zone}
              data={data}
              revision={revision}
              query={query}
              roomIds={scopedRooms.map((room) => room.id)}
              onEdit={onEdit}
            />
          ) : (
            <div className="room-overview-layout">
              <div className="room-catalog">
                <label className="room-search">
                  <span>Raum suchen</span>
                  <input
                    type="search"
                    value={search}
                    placeholder="Bezeichnung oder Ausstattung"
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <p className="room-result-count">
                  {rooms.length} {rooms.length === 1 ? "Raum" : "Räume"} ·{" "}
                  {currentFloor?.name || area.name}
                </p>
                {rooms.length ? (
                  <div className="room-tile-grid">
                    {rooms.map((room) => (
                      <button
                        key={room.id}
                        className={`room-tile ${selected?.id === room.id ? "selected" : ""}`}
                        aria-label={room.name}
                        aria-pressed={selected?.id === room.id}
                        onClick={() => setRoomId(room.id)}
                      >
                        <span className="room-tile-floor">
                          {
                            floors.find((floor) => floor.id === room.floor)
                              ?.name
                          }
                        </span>
                        <strong>{room.name}</strong>
                        {room.code !== room.name && (
                          <span className="room-tile-code">{room.code}</span>
                        )}
                        <span className="room-tile-capacity">
                          {room.capacity == null
                            ? "Kapazität offen"
                            : `${room.capacity} Plätze`}
                        </span>
                        <span className="room-tile-equipment">
                          {room.equipment?.length
                            ? room.equipment.join(" · ")
                            : "Keine Ausstattung hinterlegt"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="room-empty">
                    {query || search
                      ? "Keine Räume für diese Suche gefunden."
                      : !floors.length
                        ? "Lege zuerst ein Stockwerk für diesen Bereich an."
                        : "Hier sind noch keine Räume angelegt."}
                  </div>
                )}
              </div>
              <aside className="room-detail-panel">
                {selected ? (
                  <>
                    <span className="small-label">Raumdetails</span>
                    <h2>{selected.name}</h2>
                    <p>
                      {area.name} · {selectedFloor?.name}
                    </p>
                    <dl className="room-facts">
                      <div>
                        <dt>Raumbezeichnung</dt>
                        <dd>{selected.code}</dd>
                      </div>
                      <div>
                        <dt>Kapazität</dt>
                        <dd>
                          {selected.capacity == null
                            ? "Noch nicht erfasst"
                            : `${selected.capacity} Plätze`}
                        </dd>
                      </div>
                    </dl>
                    <div className="equipment-list">
                      {selected.equipment?.map((item: string) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                    <div className="room-detail-actions">
                      <button
                        className="button secondary"
                        onClick={() => onEdit("rooms", selected)}
                      >
                        Raum bearbeiten
                      </button>
                      <button
                        className="button secondary"
                        onClick={() =>
                          onEdit("blocks", undefined, {
                            rooms: [selected.id],
                            start: DateTime.now()
                              .setZone(zone)
                              .startOf("hour")
                              .toISO(),
                            end: DateTime.now()
                              .setZone(zone)
                              .startOf("hour")
                              .plus({ hours: 1 })
                              .toISO(),
                          })
                        }
                      >
                        Raum blockieren
                      </button>
                    </div>
                    <h3>Veröffentlichte Belegung</h3>
                    {loading ? (
                      <p role="status">Belegung laden …</p>
                    ) : error ? (
                      <p className="error-box" role="alert">
                        {error}
                      </p>
                    ) : occupancy.length ? (
                      <div className="room-occupancy-list">
                        {occupancy
                          .slice()
                          .sort((a, b) => a.start.localeCompare(b.start))
                          .map((row, index) => (
                            <div className="occupancy" key={index}>
                              <span>
                                {fmt(row.start, zone, "dd.MM.")} ·{" "}
                                {fmt(row.start, zone)}–{fmt(row.end, zone)}
                              </span>
                              <strong>{row.name}</strong>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p>Keine veröffentlichte Belegung.</p>
                    )}
                  </>
                ) : (
                  <p className="room-selection-hint">
                    Wähle einen Raum, um Details und Belegung zu sehen.
                  </p>
                )}
              </aside>
            </div>
          )}
        </>
      ) : (
        <div className="room-empty">
          Noch keine Bereiche angelegt. Beginne mit einem Bereich, zum Beispiel
          „Hauptgebäude“ oder „Trakt A“.
        </div>
      )}
    </section>
  );
}
