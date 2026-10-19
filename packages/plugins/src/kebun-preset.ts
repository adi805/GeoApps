/**
 * KEBUN MODE preset — kurasi plugin buat pengguna kebun (TSJ).
 *
 * Alih-alih memunculkan 50+ plugin GIS (flight simulator, earth engine,
 * zarr, stac, dst) yang bikin menu bingung, preset ini nentuin:
 *   - KEBUN_PLUGINS: yang AKTIF & muncul di menu (inti kerjaan kebun)
 *   - HIDDEN_PLUGINS: yang TETAP ada di sistem tapi tidak diaktifkan
 *     default (disembunyikan dari menu utama)
 */
import { GEOFENCE_PLUGIN_ID } from "./plugin-ids";
import { ANNOTATIONS_PLUGIN_ID, GEO_EDITOR_PLUGIN_ID } from "./plugin-ids";

/** Plugin inti yang dibutuhin kerjaan kebun (aktif default). */
export const KEBUN_PLUGINS = [
  "maplibre-layer-control", // panel layer
  ANNOTATIONS_PLUGIN_ID, // gambar pin/garis/area
  GEO_EDITOR_PLUGIN_ID, // edit geometri
  GEOFENCE_PLUGIN_ID, // zona pantau blok kebun
  "maplibre-gl-basemap-control", // pilih basemap
  // measure & geolocation built-in di core (bukan plugin terpisah)
] as const;

/** Plugin yang TIDAK relevan ke kerjaan kebun (disembunyikan dari menu). */
export const HIDDEN_PLUGINS = [
  "maplibre-gl-flight-simulator",
  "maplibre-gl-earth-engine",
  "maplibre-gl-zarr",
  "maplibre-gl-stac",
  "maplibre-gl-samgeo",
  "maplibre-gl-huggingface",
  "maplibre-gl-deckgl-viz",
  "maplibre-gl-timelapse",
  "maplibre-gl-mapillary",
  "maplibre-gl-overture",
  "maplibre-gl-h3",
  "maplibre-gl-s2",
  "maplibre-gl-dggrid",
  "maplibre-gl-geohash",
  "maplibre-gl-planetary",
  "maplibre-gl-nasa-earthdata",
  "maplibre-gl-clouds",
  "maplibre-gl-sun",
  "maplibre-gl-precipitation",
  "maplibre-gl-weather",
  "maplibre-gl-route-animation",
  "maplibre-gl-vantor",
] as const;

/** True kalau plugin ini relevan buat kebun (harus muncul di menu). */
export function isKebunPlugin(pluginId: string): boolean {
  return (KEBUN_PLUGINS as readonly string[]).includes(pluginId);
}
