import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Building2,
  Layers,
  MousePointer2,
  Pencil,
  Save,
  Undo2,
  ZoomIn,
  ZoomOut,
  Upload,
  MapPin,
} from "lucide-react";
import { Row, api, all, fmt } from "./api";
type Props = {
  data: Record<string, Row[]>;
  styleUrl: string;
  zone: string;
  reload: () => void;
  notify: (s: string) => void;
};
export default function MapEditor({
  data,
  styleUrl,
  zone,
  reload,
  notify,
}: Props) {
  const [buildingId, setBuildingId] = useState(data.buildings?.[0]?.id),
    [floorId, setFloorId] = useState(data.floors?.[0]?.id),
    [selected, setSelected] = useState<Row | null>(null),
    [drawing, setDrawing] = useState(false),
    [points, setPoints] = useState<number[][]>([]),
    [roomId, setRoomId] = useState(""),
    [zoom, setZoom] = useState(1),
    [occupancy, setOccupancy] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [outdoor, setOutdoor] = useState(false),
    [mapDraw, setMapDraw] = useState(false),
    [mapPoints, setMapPoints] = useState<number[][]>([]);
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    svg = useRef<SVGSVGElement>(null),
    drawRef = useRef(false);
  drawRef.current = mapDraw;
  const building = data.buildings?.find((r) => r.id === Number(buildingId)),
    floors =
      data.floors?.filter((r) => r.building === Number(buildingId)) || [],
    floor = floors.find((r) => r.id === Number(floorId)) || floors[0],
    rooms = data.rooms?.filter((r) => r.floor === floor?.id) || [];
  useEffect(() => {
    if (selected) {
      api(`rooms/${selected.id}/occupancy/`)
        .then((r) => setOccupancy(r.rows))
        .catch((e) => setError(e.message));
    } else setOccupancy([]);
  }, [selected?.id]);
  useEffect(() => {
    if (!outdoor || !container.current || !building) return;
    const instance = new maplibregl.Map({
      container: container.current,
      style: styleUrl,
      center: [building.longitude, building.latitude],
      zoom: 17,
    });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl(), "top-right");
    instance.on("load", () => {
      instance.addSource("buildings", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: (data.buildings || [])
            .filter((r) => r.geometry?.type)
            .map((r) => ({
              type: "Feature",
              properties: { name: r.name },
              geometry: r.geometry,
            })),
        },
      });
      instance.addLayer({
        id: "building-fill",
        type: "fill",
        source: "buildings",
        paint: { "fill-color": "#32689a", "fill-opacity": 0.35 },
      });
      instance.addLayer({
        id: "building-line",
        type: "line",
        source: "buildings",
        paint: { "line-color": "#214b76", "line-width": 2 },
      });
    });
    instance.on("click", (e) => {
      if (drawRef.current)
        setMapPoints((p) => [...p, [e.lngLat.lng, e.lngLat.lat]]);
    });
    instance.on("error", () =>
      setError(
        "Außenkarte nicht erreichbar. Die Innenräume können weiterhin bearbeitet werden.",
      ),
    );
    return () => {
      instance.remove();
      map.current = null;
    };
  }, [outdoor, buildingId, styleUrl, JSON.stringify(data.buildings)]);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !instance.isStyleLoaded()) return;
    const features: any[] = mapPoints.map((coordinates) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates },
    }));
    if (mapPoints.length >= 2)
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: mapPoints },
      });
    const geo: any = { type: "FeatureCollection", features };
    const source = instance.getSource("drawing") as
      maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(geo);
    else {
      instance.addSource("drawing", { type: "geojson", data: geo });
      instance.addLayer({
        id: "drawing-line",
        type: "line",
        source: "drawing",
        paint: { "line-color": "#214b76", "line-width": 3 },
      });
      instance.addLayer({
        id: "drawing-points",
        type: "circle",
        source: "drawing",
        filter: ["==", ["geometry-type"], "Point"],
        paint: { "circle-color": "#214b76", "circle-radius": 5 },
      });
    }
  }, [mapPoints]);
  async function savePolygon() {
    if (!roomId || points.length < 3) return;
    try {
      await api(`rooms/${roomId}/`, "PATCH", { polygon: points });
      setDrawing(false);
      setPoints([]);
      reload();
      notify("Raumfläche gespeichert.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function saveBuilding() {
    if (!building || mapPoints.length < 3) return;
    try {
      await api(`buildings/${building.id}/`, "PATCH", {
        geometry: {
          type: "Polygon",
          coordinates: [[...mapPoints, mapPoints[0]]],
        },
      });
      setMapDraw(false);
      setMapPoints([]);
      reload();
      notify("Gebäudeumriss gespeichert.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function upload(file: File) {
    if (!floor) return;
    try {
      const form = new FormData();
      form.append("file", file);
      await api(`floors/${floor.id}/upload/`, "POST", form);
      reload();
      notify("Grundriss hochgeladen.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function click(e: React.MouseEvent<SVGSVGElement>) {
    if (!drawing || !svg.current) return;
    const point = svg.current.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const matrix = svg.current.getScreenCTM();
    if (matrix) {
      const p = point.matrixTransform(matrix.inverse());
      setPoints((v) => [...v, [Math.round(p.x), Math.round(p.y)]]);
    }
  }
  return (
    <>
      <div className="page-actions">
        <div className="segmented">
          <button
            className={!outdoor ? "active" : ""}
            onClick={() => setOutdoor(false)}
          >
            <Layers size={16} />
            Etagen
          </button>
          <button
            className={outdoor ? "active" : ""}
            onClick={() => setOutdoor(true)}
          >
            <MapPin size={16} />
            Gelände
          </button>
        </div>
      </div>
      <div className="map-toolbar">
        <Building2 size={17} />
        <select
          value={buildingId || ""}
          onChange={(e) => {
            setBuildingId(Number(e.target.value));
            setSelected(null);
            setDrawing(false);
          }}
        >
          {data.buildings?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {!outdoor && (
          <>
            <span className="divider" />
            <select
              value={floor?.id || ""}
              onChange={(e) => {
                setFloorId(Number(e.target.value));
                setSelected(null);
                setDrawing(false);
                setPoints([]);
              }}
            >
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <label className="button secondary">
              <Upload size={15} />
              Grundriss
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => {
                  if (e.target.files?.[0]) upload(e.target.files[0]);
                }}
              />
            </label>
          </>
        )}
        <div className="spacer" />
        {outdoor ? (
          <button
            className="button secondary"
            onClick={() => {
              setMapDraw(!mapDraw);
              setMapPoints([]);
            }}
          >
            <Pencil size={15} />
            Gebäude zeichnen
          </button>
        ) : (
          <button
            className="button primary"
            onClick={() => {
              setDrawing(!drawing);
              setPoints([]);
            }}
          >
            <Pencil size={15} />
            Raum zeichnen
          </button>
        )}
      </div>
      {error && <div className="error-box">{error}</div>}
      {(drawing || mapDraw) && (
        <div className="drawing-toolbar">
          <MousePointer2 size={17} />
          <span>
            {outdoor
              ? `${mapPoints.length} Punkte gesetzt. Gebäudeumriss durch Klicken zeichnen.`
              : "Raumecken anklicken, dann die Fläche einem Raum zuordnen."}
          </span>
          {!outdoor && (
            <select
              aria-label="Fläche zuordnen"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            >
              <option value="">Raum auswählen …</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
          <button
            className="button secondary"
            onClick={() =>
              outdoor
                ? setMapPoints((p) => p.slice(0, -1))
                : setPoints((p) => p.slice(0, -1))
            }
          >
            <Undo2 size={14} />
            Zurück
          </button>
          <button
            className="button primary"
            disabled={
              outdoor ? mapPoints.length < 3 : points.length < 3 || !roomId
            }
            onClick={outdoor ? saveBuilding : savePolygon}
          >
            <Save size={14} />
            Fläche speichern
          </button>
        </div>
      )}
      <div className="map-layout">
        <div className="map-canvas">
          {outdoor ? (
            <div ref={container} className="outdoor-map" />
          ) : floor ? (
            <>
              <div className="floor-caption">
                <span>{building?.name}</span>
                <strong>{floor.name}</strong>
              </div>
              <div className="floor-scroll">
                <svg
                  ref={svg}
                  className={drawing ? "floorplan drawing" : "floorplan"}
                  viewBox="0 0 1000 950"
                  onClick={click}
                  style={{ width: `${zoom * 100}%` }}
                  role="img"
                  aria-label={`Grundriss ${floor.name}`}
                >
                  <defs>
                    <pattern
                      id="floor-grid"
                      width="25"
                      height="25"
                      patternUnits="userSpaceOnUse"
                    >
                      <circle cx="1" cy="1" r="1" fill="#cbd5df" />
                    </pattern>
                  </defs>
                  <rect width="1000" height="950" fill="url(#floor-grid)" />
                  {floor.background && (
                    <image
                      href={`/api/floors/${floor.id}/file/`}
                      x="0"
                      y="0"
                      width="1000"
                      height="950"
                      preserveAspectRatio="xMidYMid meet"
                      opacity=".65"
                    />
                  )}
                  {rooms
                    .filter((r) => r.polygon?.length >= 3)
                    .map((r, i) => {
                      const center = r.polygon.reduce(
                        (a: number[], p: number[]) => [
                          a[0] + p[0] / r.polygon.length,
                          a[1] + p[1] / r.polygon.length,
                        ],
                        [0, 0],
                      );
                      return (
                        <g
                          key={r.id}
                          className={`floor-room ${selected?.id === r.id ? "selected" : ""}`}
                          tabIndex={0}
                          role="button"
                          aria-label={r.name}
                          onClick={(e) => {
                            if (!drawing) {
                              e.stopPropagation();
                              setSelected(r);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") setSelected(r);
                          }}
                        >
                          <polygon
                            points={r.polygon
                              .map((p: number[]) => p.join(","))
                              .join(" ")}
                            fill={i % 2 ? "#e4ecf3" : "#e1efea"}
                          />
                          <text
                            x={center[0]}
                            y={center[1] - 6}
                            textAnchor="middle"
                          >
                            {r.name}
                          </text>
                          <text
                            className="room-capacity"
                            x={center[0]}
                            y={center[1] + 21}
                            textAnchor="middle"
                          >
                            {r.capacity} Plätze
                          </text>
                        </g>
                      );
                    })}
                  {points.length > 0 && (
                    <polyline
                      fill="rgba(43,93,139,.12)"
                      stroke="#214b76"
                      strokeWidth="3"
                      points={points.map((p) => p.join(",")).join(" ")}
                    />
                  )}{" "}
                  {points.map((p, i) => (
                    <circle key={i} cx={p[0]} cy={p[1]} r="6" fill="#214b76" />
                  ))}
                </svg>
              </div>
              <div className="zoom-controls">
                <button
                  aria-label="Verkleinern"
                  onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}
                >
                  <ZoomOut size={18} />
                </button>
                <span>{Math.round(zoom * 100)} %</span>
                <button
                  aria-label="Vergrößern"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                >
                  <ZoomIn size={18} />
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Building2 size={34} />
              <h3>Noch keine Etage vorhanden</h3>
              <p>Gebäude und Etagen können unter Stammdaten angelegt werden.</p>
            </div>
          )}
        </div>
        <aside className="room-details">
          {selected ? (
            <>
              <span className="small-label">Raumdetails</span>
              <h2>{selected.name}</h2>
              <p>
                {floor?.name} · {selected.capacity} Plätze
              </p>
              <div className="equipment-list">
                {selected.equipment?.map((s: string) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
              <h3>Veröffentlichte Belegung</h3>
              {occupancy.slice(0, 8).map((r, i) => (
                <div className="occupancy" key={i}>
                  <span>
                    {fmt(r.start, zone, "dd.MM.")} · {fmt(r.start, zone)}–
                    {fmt(r.end, zone)}
                  </span>
                  <strong>{r.name}</strong>
                </div>
              ))}
              {!occupancy.length && <p>Keine veröffentlichte Belegung.</p>}
            </>
          ) : (
            <>
              <Layers size={30} />
              <h2>Räume entdecken</h2>
              <p>
                Wähle einen Raum im Grundriss, um Ausstattung und Belegung zu
                sehen.
              </p>
              <div className="room-list">
                {rooms.map((r) => (
                  <button key={r.id} onClick={() => setSelected(r)}>
                    <span>{r.name}</span>
                    <small>{r.capacity} Plätze</small>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
