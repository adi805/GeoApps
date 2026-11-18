/**
 * Tiga tampilan panel geofence: daftar zona, buat batas, dan jurnal peringatan.
 *
 * Semuanya presentasional: tidak mengimpor plugin, tidak menyimpan state
 * sendiri, tidak menyentuh penyimpanan. Panel (`GeofenceDialog`) yang membaca
 * dan menulis, jadi satu tempat saja yang perlu diperiksa saat data berubah.
 *
 * Cara memakainya di lapangan yang menentukan bentuknya, bukan estetika:
 * setiap baris bisa disentuh dengan sarung tangan (>= 48 px lewat primitive),
 * tiap angka yang menentukan keputusan ikut tertulis (radius, peringatan hari
 * ini, jarak ke batas), dan aksi merusak butuh ketukan kedua.
 */

import type { ReactNode } from "react";
import {
  AlertTriangle,
  Bell,
  Crosshair,
  Download,
  MapPinned,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { GeofenceEvent, GeofenceZone } from "@geolibre/plugins";
import {
  GEOFENCE_MIN_RADIUS_M,
  eventCaption,
  eventTitle,
  isZoneEnabled,
  zoneRowCaption,
} from "../../lib/geofence-report";
import {
  MobileAction,
  MobileBadge,
  MobileCard,
  MobileFieldRow,
  MobileListRow,
  MobileNotice,
  MobileSectionHeading,
} from "./mobile/mobilePrimitives";

/** Kepala daftar: saklar pengawasan.
 *
 * Judulnya "Pengawasan", bukan jumlah zona: jumlahnya sudah tertulis di subjudul
 * panel, dan mengulanginya di kartu pertama membuat layar kecil menghabiskan dua
 * baris untuk satu angka yang sama.
 */
function ListSummary({
  monitorRunning,
  onToggleMonitor,
}: {
  monitorRunning: boolean;
  onToggleMonitor: () => void;
}) {
  return (
    <MobileCard
      title="Pengawasan"
      description={
        monitorRunning
          ? "Pengawasan jalan: peringatan dicatat selama aplikasi terbuka."
          : "Pengawasan mati: zona tersimpan, tapi belum ada peringatan yang dicatat."
      }
      footer={
        <MobileAction
          label={monitorRunning ? "Hentikan pengawasan" : "Mulai mengawasi"}
          variant={monitorRunning ? "secondary" : "primary"}
          icon={<Crosshair className="h-5 w-5" aria-hidden="true" />}
          onClick={onToggleMonitor}
          testId="geofence-toggle-monitor"
        />
      }
    >
      <span className="px-3 py-2 text-xs text-muted-foreground">
        Butuh izin lokasi. Membuat batas baru otomatis menyalakannya.
      </span>
    </MobileCard>
  );
}

export interface GeofenceListViewProps {
  zones: readonly GeofenceZone[];
  events: readonly GeofenceEvent[];
  /** "Hari ini" dipatok sekali saat panel dibuka, supaya tiap baris memakai hari yang sama. */
  today: Date;
  monitorRunning: boolean;
  /** Zona yang menunggu ketukan konfirmasi hapus. */
  pendingDeleteId: string | null;
  onToggleMonitor: () => void;
  onCreate: () => void;
  onOpenAlerts: () => void;
  onToggleZone: (zone: GeofenceZone) => void;
  onRequestDelete: (zone: GeofenceZone) => void;
  onDeleteConfirmed: (zone: GeofenceZone) => void;
  onCancelDelete: () => void;
}

/** Tampilan daftar: satu baris per zona, plus aksi buat dan jurnal. */
export function GeofenceListView({
  zones,
  events,
  today,
  monitorRunning,
  pendingDeleteId,
  onToggleMonitor,
  onCreate,
  onOpenAlerts,
  onToggleZone,
  onRequestDelete,
  onDeleteConfirmed,
  onCancelDelete,
}: GeofenceListViewProps) {
  const pending = zones.find((zone) => zone.id === pendingDeleteId) ?? null;
  return (
    <>
      <ListSummary
        monitorRunning={monitorRunning}
        onToggleMonitor={onToggleMonitor}
      />
      {zones.length === 0 ? (
        <MobileNotice
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          title="Belum ada geofence"
          description="Batas yang dibuat akan muncul di sini bersama status pengawasannya."
          testId="geofence-empty"
        />
      ) : (
        <>
          <MobileSectionHeading>Batasi lapangan</MobileSectionHeading>
          <MobileCard>
            {zones.map((zone) => {
              const enabled = isZoneEnabled(zone);
              return (
                <div key={zone.id} data-testid={`geofence-row-${zone.id}`}>
                  <MobileListRow
                    icon={<MapPinned className="h-4 w-4" aria-hidden="true" />}
                    title={zone.name}
                    description={zoneRowCaption(zone, events, today)}
                    badge={
                      <MobileBadge tone={enabled ? "success" : "info"}>
                        {enabled ? "Aktif" : "Nonaktif"}
                      </MobileBadge>
                    }
                  />
                  <div className="flex gap-2 px-3 pb-2">
                    <MobileAction
                      label={enabled ? "Matikan" : "Nyalakan"}
                      variant="secondary"
                      onClick={() => onToggleZone(zone)}
                      testId={`geofence-toggle-${zone.id}`}
                    />
                    <MobileAction
                      label={pendingDeleteId === zone.id ? "Konfirmasi hapus" : "Hapus"}
                      variant="danger"
                      icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                      onClick={() =>
                        pendingDeleteId === zone.id
                          ? onDeleteConfirmed(zone)
                          : onRequestDelete(zone)
                      }
                      testId={`geofence-delete-${zone.id}`}
                    />
                  </div>
                </div>
              );
            })}
          </MobileCard>
        </>
      )}
      {pending ? (
        <MobileNotice
          tone="danger"
          icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
          title={`Hapus ${pending.name}?`}
          description="Zona dan pengawasannya hilang dari perangkat ini. Jurnal peringatan yang sudah tercatat tetap tersimpan."
          action={
            <div className="flex gap-2">
              <MobileAction
                label="Hapus sekarang"
                variant="danger"
                onClick={() => onDeleteConfirmed(pending)}
                testId="geofence-delete-confirm"
              />
              <MobileAction
                label="Batal"
                variant="secondary"
                onClick={onCancelDelete}
                testId="geofence-delete-cancel"
              />
            </div>
          }
        />
      ) : null}
      <MobileAction
        label="Buat batas baru"
        icon={<Plus className="h-5 w-5" aria-hidden="true" />}
        onClick={onCreate}
        testId="geofence-create"
      />
      <MobileAction
        label="Lihat peringatan"
        variant="secondary"
        icon={<Bell className="h-5 w-5" aria-hidden="true" />}
        onClick={onOpenAlerts}
        testId="geofence-open-alerts"
      />
    </>
  );
}

export interface GeofenceFormViewProps {
  name: string;
  radiusM: string;
  lat: string;
  lng: string;
  locating: boolean;
  error: string | null;
  onNameChange: (value: string) => void;
  onRadiusChange: (value: string) => void;
  onLatChange: (value: string) => void;
  onLngChange: (value: string) => void;
  onUseDevicePosition: () => void;
  onSave: () => void;
  onCancel: () => void;
}

/** Tampilan buat batas: satu lingkaran radius dengan pusat dari posisi perangkat. */
export function GeofenceFormView({
  name,
  radiusM,
  lat,
  lng,
  locating,
  error,
  onNameChange,
  onRadiusChange,
  onLatChange,
  onLngChange,
  onUseDevicePosition,
  onSave,
  onCancel,
}: GeofenceFormViewProps) {
  const radiusValue = Number(radiusM);
  const tooSmall = Number.isFinite(radiusValue) && radiusValue < GEOFENCE_MIN_RADIUS_M;
  const canSave =
    name.trim().length > 0 &&
    Number.isFinite(radiusValue) &&
    radiusValue >= GEOFENCE_MIN_RADIUS_M &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng));
  return (
    <>
      <MobileCard title="Batas" description="Satu lingkaran: pusat dan radiusnya.">
        <label className="flex min-h-12 flex-col justify-center gap-1 px-3 py-2">
          <span className="text-xs text-muted-foreground">Nama batas</span>
          <input
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Blok C"
            data-testid="geofence-name-input"
            className="min-h-10 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="flex min-h-12 flex-col justify-center gap-1 px-3 py-2">
          <span className="text-xs text-muted-foreground">Radius (meter)</span>
          <input
            type="number"
            inputMode="numeric"
            min={GEOFENCE_MIN_RADIUS_M}
            step={10}
            value={radiusM}
            onChange={(event) => onRadiusChange(event.target.value)}
            data-testid="geofence-radius-input"
            className="min-h-10 rounded-md border bg-background px-2 font-mono text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <div className="border-t">
          <MobileFieldRow
            label="Lintang"
            value={
              <input
                type="text"
                inputMode="decimal"
                value={lat}
                onChange={(event) => onLatChange(event.target.value)}
                data-testid="geofence-lat-input"
                className="w-28 rounded-md border bg-background px-2 py-1 text-end font-mono text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            }
          />
          <MobileFieldRow
            label="Bujur"
            value={
              <input
                type="text"
                inputMode="decimal"
                value={lng}
                onChange={(event) => onLngChange(event.target.value)}
                data-testid="geofence-lng-input"
                className="w-28 rounded-md border bg-background px-2 py-1 text-end font-mono text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            }
          />
        </div>
        <div className="border-t p-2">
          <MobileAction
            label={locating ? "Mengambil posisi..." : "Pakai posisi perangkat"}
            variant="secondary"
            icon={<Crosshair className="h-5 w-5" aria-hidden="true" />}
            onClick={onUseDevicePosition}
            disabled={locating}
            testId="geofence-use-device-position"
          />
        </div>
      </MobileCard>
      {tooSmall ? (
        <MobileNotice
          tone="warning"
          title="Radius terlalu kecil"
          description={`Batas di bawah ${GEOFENCE_MIN_RADIUS_M} m lebih kecil dari galat GPS, jadi peringatannya akan salah terus.`}
          detail={`radius ${radiusM} m (minimum ${GEOFENCE_MIN_RADIUS_M} m)`}
          testId="geofence-radius-warning"
        />
      ) : null}
      {error ? (
        <MobileNotice
          tone="danger"
          title="Posisi tidak didapat"
          description="Isi lintang dan bujur sendiri, atau coba lagi di tempat terbuka."
          detail={error}
          testId="geofence-position-error"
        />
      ) : null}
      {name.trim().length === 0 ? (
        <MobileNotice
          title="Beri nama batasnya"
          description="Nama ini yang tertulis di jurnal dan CSV, jadi tulislah yang bisa dikenali kembali di kantor."
          testId="geofence-name-hint"
        />
      ) : null}
      <MobileAction
        label="Simpan batas"
        onClick={onSave}
        disabled={!canSave}
        testId="geofence-save"
      />
      <MobileAction label="Batal" variant="secondary" onClick={onCancel} testId="geofence-cancel" />
    </>
  );
}

export interface GeofenceAlertsViewProps {
  events: readonly GeofenceEvent[];
  onExport: () => void;
  onClear: () => void;
  exportNotice: ReactNode;
}

/** Tampilan jurnal: peringatan masuk/keluar yang sudah tercatat di perangkat. */
export function GeofenceAlertsView({
  events,
  onExport,
  onClear,
  exportNotice,
}: GeofenceAlertsViewProps) {
  return (
    <>
      {events.length === 0 ? (
        <MobileNotice
          icon={<Bell className="h-5 w-5" aria-hidden="true" />}
          title="Belum ada peringatan"
          description="Peringatan muncul saat kamu melewati batas geofence yang aktif. Tidak ada peringatan berarti belum ada yang dilewati."
          testId="geofence-alerts-empty"
        />
      ) : (
        <>
          <MobileSectionHeading>Peringatan tercatat</MobileSectionHeading>
          <MobileCard>
            {events.map((event, index) => (
              <MobileListRow
                key={`${event.area}-${event.at}-${index}`}
                title={eventTitle(event)}
                description={eventCaption(event)}
                badge={
                  <MobileBadge tone={event.kind === "masuk" ? "success" : "warning"}>
                    {event.kind === "masuk" ? "Masuk" : "Keluar"}
                  </MobileBadge>
                }
              />
            ))}
          </MobileCard>
          <MobileNotice
            title="Peringatan dicatat di perangkat lebih dulu"
            description="Catatan ini tetap ada saat tidak ada sinyal, dan hanya bisa hilang kalau kamu menghapusnya sendiri."
          />
        </>
      )}
      {exportNotice}
      <MobileAction
        label="Ekspor CSV"
        variant="secondary"
        icon={<Download className="h-5 w-5" aria-hidden="true" />}
        onClick={onExport}
        testId="geofence-export-csv"
      />
      <MobileAction
        label="Kosongkan jurnal"
        variant="danger"
        onClick={onClear}
        disabled={events.length === 0}
        testId="geofence-clear-events"
      />
    </>
  );
}