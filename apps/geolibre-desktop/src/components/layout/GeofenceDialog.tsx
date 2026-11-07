/**
 * Panel geofence: daftar zona, buat batas, dan jurnal peringatan.
 *
 * Kenapa panelnya ada: mesin geofence (`@geolibre/plugins`) sudah lengkap sejak
 * lama, tapi tidak punya satu pun tampilan, jadi fiturnya tidak bisa dipakai
 * siapa pun. Panel ini pemilik tunggal state-nya: satu tempat membaca dan
 * menulis zona, satu tempat memutuskan pengawasan jalan atau tidak.
 *
 * Tiga tampilan dalam satu dialog, bukan tiga dialog: berpindah antara daftar,
 * form, dan jurnal itu satu alur kerja di lapangan (lihat batas, buat batas,
 * periksa peringatan), dan dialog terpisah akan menutup peta yang sedang
 * dilihat pengguna di antara langkah-langkah itu.
 *
 * Yang belum divalidasi di sini: `startGeofenceMonitor` memakai
 * `navigator.geolocation.watchPosition` langsung (bukan pembungkus native
 * `lib/geolocation`), jadi di Android ia bergantung pada WebView yang
 * mengizinkan geolokasi. Pengambilan posisi untuk *membuat* batas memakai
 * pembungkus native itu, dan itulah jalur yang sudah diuji e2e.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Position } from "geojson";
import {
  addGeofenceZone,
  clearGeofenceEvents,
  exportGeofenceEventsCsv,
  getAllGeofenceZones,
  getGeofenceEvents,
  isGeofenceMonitorRunning,
  removeGeofenceZone,
  setGeofenceZoneEnabled,
  startGeofenceMonitor,
  stopGeofenceMonitor,
  type GeofenceEvent,
  type GeofenceZone,
} from "@geolibre/plugins";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@geolibre/ui";
import { clampRadiusM, newZoneId, zonesSummary } from "../../lib/geofence-report";
import { getCurrentPosition } from "../../lib/geolocation";
import { saveTextFileWithFallback } from "../../lib/tauri-io";
import { GeofenceAlertsView, GeofenceFormView, GeofenceListView } from "./geofence-views";
import { MOBILE_DIALOG_SURFACE } from "./mobile/mobile-dialog-surface";
import { MobileNotice, MobileScreenBody, MobileScreenHeader } from "./mobile/mobilePrimitives";

/** Tampilan yang sedang dibuka. Satu state, tiga layar. */
type GeofenceView = "daftar" | "buat" | "peringatan";

/** Radius awal form, meter. Cukup lebar untuk satu blok bangunan. */
const DEFAULT_NEW_RADIUS_M = 250;

export interface GeofenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Panel geofence, dibuka dari sheet mobile dan dari jalur dialog malas toolbar.
 *
 * Args:
 *   props: Open flag dan setternya; state lainnya milik panel ini sendiri.
 */
export function GeofenceDialog({ open, onOpenChange }: GeofenceDialogProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<GeofenceView>("daftar");
  const [zones, setZones] = useState<GeofenceZone[]>([]);
  const [events, setEvents] = useState<GeofenceEvent[]>([]);
  const [monitorRunning, setMonitorRunning] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // "Hari ini" dipatok sekali saat panel dibuka: kalau tiap baris memanggil
  // `new Date()` sendiri, daftar bisa menghitung dua hari berbeda di tengah
  // pergantian hari dan angkanya tidak bisa dibandingkan.
  const [today, setToday] = useState(() => new Date());
  const [name, setName] = useState("");
  const [radiusM, setRadiusM] = useState(String(DEFAULT_NEW_RADIUS_M));
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locating, setLocating] = useState(false);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setZones(getAllGeofenceZones());
    setEvents(getGeofenceEvents());
    setMonitorRunning(isGeofenceMonitorRunning());
  }, []);

  useEffect(() => {
    if (!open) return;
    setView("daftar");
    setPendingDeleteId(null);
    setExportNotice(null);
    setToday(new Date());
    refresh();
  }, [open, refresh]);

  const locateDevice = useCallback(async () => {
    setLocating(true);
    setPositionError(null);
    try {
      const fix = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      });
      setLat(fix.coords.latitude.toFixed(6));
      setLng(fix.coords.longitude.toFixed(6));
    } catch (error) {
      setPositionError(error instanceof Error ? error.message : String(error));
    } finally {
      setLocating(false);
    }
  }, []);

  const openForm = useCallback(() => {
    setView("buat");
    setPositionError(null);
    setRadiusM(String(DEFAULT_NEW_RADIUS_M));
    setName("");
    void locateDevice();
  }, [locateDevice]);

  const saveZone = useCallback(() => {
    const center: Position = [Number(lng), Number(lat)];
    const zone: GeofenceZone = {
      id: newZoneId(zones.map((existing) => existing.id)),
      name: name.trim(),
      kind: "circle",
      center,
      radiusM: clampRadiusM(Number(radiusM)),
      enabled: true,
    };
    addGeofenceZone(zone);
    // Membuat batas lalu membiarkan pengawasannya mati itu janji kosong: yang
    // dicari pengguna adalah peringatan saat melewatinya.
    if (!isGeofenceMonitorRunning()) startGeofenceMonitor();
    setView("daftar");
    setPendingDeleteId(null);
    refresh();
  }, [lat, lng, name, radiusM, refresh, zones]);

  const toggleMonitor = useCallback(() => {
    if (isGeofenceMonitorRunning()) stopGeofenceMonitor();
    else startGeofenceMonitor();
    refresh();
  }, [refresh]);

  const toggleZone = useCallback(
    (zone: GeofenceZone) => {
      setGeofenceZoneEnabled(zone.id, zone.enabled === false);
      refresh();
    },
    [refresh],
  );

  const confirmDelete = useCallback(
    (zone: GeofenceZone) => {
      removeGeofenceZone(zone.id);
      setPendingDeleteId(null);
      refresh();
    },
    [refresh],
  );

  const exportCsv = useCallback(async () => {
    try {
      const path = await saveTextFileWithFallback(exportGeofenceEventsCsv(), {
        defaultName: `geofence-${new Date().toISOString().slice(0, 10)}.csv`,
        filters: [{ name: "CSV", extensions: ["csv"] }],
        browserTypes: [{ description: "CSV", accept: { "text/csv": [".csv"] } }],
        mimeType: "text/csv",
      });
      setExportNotice(
        path
          ? t("geofence.exported", "Jurnal diekspor ke {{path}}", { path })
          : t("geofence.exportCancelled", "Ekspor dibatalkan"),
      );
    } catch {
      setExportNotice(t("geofence.exportFailed", "Ekspor gagal; tidak ada berkas yang ditulis"));
    }
  }, [t]);

  const clearJournal = useCallback(() => {
    clearGeofenceEvents();
    setExportNotice(null);
    refresh();
  }, [refresh]);

  const header =
    view === "daftar"
      ? {
          title: t("geofence.title", "Geofence"),
          description: zones.length === 0 ? t("geofence.none", "Belum ada batas") : zonesSummary(zones),
        }
      : view === "buat"
        ? {
            title: t("geofence.create", "Buat geofence"),
            description: t("geofence.createHint", "Batas baru · belum disimpan"),
          }
        : {
            title: t("geofence.alerts", "Peringatan"),
            description: t("geofence.alertCount", "{{count}} peringatan tercatat", {
              count: events.length,
            }),
          };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-md ${MOBILE_DIALOG_SURFACE}`}
        bodyClassName="p-0"
        data-testid="geofence-dialog"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("geofence.title", "Geofence")}</DialogTitle>
          <DialogDescription>
            {t(
              "geofence.description",
              "Batas yang diawasi di perangkat: daftar zona, pembuatan batas baru, dan jurnal peringatan.",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <MobileScreenHeader
            title={header.title}
            description={header.description}
            onBack={view === "daftar" ? undefined : () => setView("daftar")}
          />
          <MobileScreenBody>
            {view === "daftar" ? (
              <GeofenceListView
                zones={zones}
                events={events}
                today={today}
                monitorRunning={monitorRunning}
                pendingDeleteId={pendingDeleteId}
                onToggleMonitor={toggleMonitor}
                onCreate={openForm}
                onOpenAlerts={() => setView("peringatan")}
                onToggleZone={toggleZone}
                onRequestDelete={(zone) => setPendingDeleteId(zone.id)}
                onDeleteConfirmed={confirmDelete}
                onCancelDelete={() => setPendingDeleteId(null)}
              />
            ) : view === "buat" ? (
              <GeofenceFormView
                name={name}
                radiusM={radiusM}
                lat={lat}
                lng={lng}
                locating={locating}
                error={positionError}
                onNameChange={setName}
                onRadiusChange={setRadiusM}
                onLatChange={setLat}
                onLngChange={setLng}
                onUseDevicePosition={() => void locateDevice()}
                onSave={saveZone}
                onCancel={() => setView("daftar")}
              />
            ) : (
              <GeofenceAlertsView
                events={events}
                onExport={() => void exportCsv()}
                onClear={clearJournal}
                exportNotice={
                  exportNotice ? (
                    <MobileNotice title={exportNotice} testId="geofence-export-notice" />
                  ) : null
                }
              />
            )}
          </MobileScreenBody>
        </div>
      </DialogContent>
    </Dialog>
  );
}