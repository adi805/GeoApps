import { useAppStore } from "@geolibre/core";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import * as maplibregl from "maplibre-gl";
import type { GeoLibreAppAPI, GeoLibreMapControlPosition, GeoLibrePlugin } from "../types";
import { GEOFENCE_PLUGIN_ID } from "../plugin-ids";

/**
 * Geofence plugin: define zones (polygons/circles) on the map, monitor the
 * device position (browser Geolocation API), and alert when the position
 * enters or leaves a zone. Pattern mirrors Avenza "always monitor geofence"
 * but keeps all data local (GeoJSON layer persisted in the project).
 *
 * Zone features carry simplestyle-spec properties so they render through the
 * standard layer-sync path (like annotations), plus a `geofence_monitor`
 * property (true/false) and `geofence_radius_m` for circle zones.
 */

export const GEOFENCE_SOURCE_KIND = "geofence";
const GEOFENCE_LAYER_NAME = "Geofences";
const GEOFENCE_SOURCE_PATH = "geofences://layer";

const PREVIEW_SOURCE_ID = "geolibre-geofence-preview";
const PREVIEW_FILL_LAYER_ID = "geolibre-geofence-preview-fill";
const PREVIEW_LINE_LAYER_ID = "geolibre-geofence-preview-line";
const GEOFENCE_TOOLS_ID = "geolibre-geofence-tools";
const GEOFENCE_STATUS_ID = "geolibre-geofence-status";

const DEFAULT_COLOR = "#3b82f6";
const DEFAULT_FILL = "#3b82f6";
const FILL_OPACITY = 0.2;
const DEFAULT_RADIUS_M = 50;

type GeofenceZone = Feature<Geometry>;
type ZoneStatus = "inside" | "outside";

// module-scope singleton state, same pattern as annotations plugin
let activeTool: "polygon" | "circle" | null = null;
let drawPoints: Position[] = [];
let previewSource: maplibregl.GeoJSONSource | null = null;
let watchId: number | null = null;
let lastStatus: Record<string, ZoneStatus> = {};
let lastKnownPos: Position | null = null;

function loadZones(): FeatureCollection {
  try {
    const raw = localStorage.getItem("geokebun:geofences");
    if (raw) return JSON.parse(raw) as FeatureCollection;
  } catch {
    /* ignore corrupt storage */
  }
  return { type: "FeatureCollection", features: [] };
}

function saveZones(fc: FeatureCollection) {
  try {
    localStorage.setItem("geokebun:geofences", JSON.stringify(fc));
  } catch {
    /* storage full/blocked — non fatal */
  }
}

function pointInPolygon(point: Position, polygon: Position[][]): boolean {
  // ray-casting algorithm
  const [x, y] = point;
  let inside = false;
  const ring = polygon[0];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function haversine(a: Position, b: Position): number {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function zoneContains(zone: GeofenceZone, pos: Position): boolean {
  const geom = zone.geometry;
  if (geom.type === "Polygon") {
    return pointInPolygon(pos, (geom as { coordinates: Position[][] }).coordinates);
  }
  if ((geom as { type: string }).type === "Circle") {
    const coords = (geom as unknown as { coordinates: Position[] }).coordinates;
    const center = Array.isArray(coords[0]) ? coords[0] : coords;
    const radius = Number(zone.properties?.geofence_radius_m ?? coords[1] ?? DEFAULT_RADIUS_M);
    return haversine(pos, center as Position) <= radius;
  }
  return false;
}

function statusChanged(zoneId: string, newStatus: ZoneStatus): boolean {
  const prev = lastStatus[zoneId];
  const changed = prev !== undefined && prev !== newStatus;
  lastStatus[zoneId] = newStatus;
  return changed;
}

function notify(zoneName: string, status: ZoneStatus) {
  const msg = `Geofence "${zoneName}": ${status === "inside" ? "MASUK" : "KELUAR"} zona`;
  // Try Notification API (Android WebView supports it when permission granted)
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("GeoKebun", { body: msg });
    }
  } catch {
    /* not supported */
  }
  // Always log to console + store last event for UI display
  console.log(`[geofence] ${msg}`);
  const statusEl = document.getElementById(GEOFENCE_STATUS_ID);
  if (statusEl) statusEl.textContent = msg;
}

function checkAllZones(pos: Position) {
  const fc = loadZones();
  for (const feature of fc.features) {
    if (!feature.properties?.geofence_monitor) continue;
    const id = String(feature.id ?? feature.properties?.name ?? "zone");
    const name = String(feature.properties?.name ?? id);
    const inside = zoneContains(feature as GeofenceZone, pos);
    if (statusChanged(id, inside ? "inside" : "outside")) {
      notify(name, inside ? "inside" : "outside");
    }
  }
}

function startMonitor(api: GeoLibreAppAPI) {
  if (watchId !== null) return;
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    console.warn("[geofence] Geolocation not available");
    return;
  }
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const p: Position = [pos.coords.longitude, pos.coords.latitude];
      lastKnownPos = p;
      checkAllZones(p);
    },
    (err) => console.warn("[geofence] position error", err.code),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
}

function stopMonitor() {
  if (watchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
}

function addZone(fc: FeatureCollection, zone: GeofenceZone): FeatureCollection {
  fc.features.push(zone as unknown as Feature);
  saveZones(fc);
  return fc;
}

export function registerGeofencePlugin(api: GeoLibreAppAPI): GeoLibrePlugin {
  return {
    id: GEOFENCE_PLUGIN_ID,
    name: "Geofence",
    version: "0.0.1",
    activeByDefault: false,
    activate: () => {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
      startMonitor(api);
    },
    deactivate: () => {
      stopMonitor();
    },
  };
}
