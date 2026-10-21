/**
 * Titik masuk galeri visual.
 *
 * Berkas ini satu-satunya tempat yang memetakan nama komponen di `inventaris.ts`
 * ke komponen nyata. Kalau sebuah nama tidak ada di peta ini, galeri menampilkan
 * peringatan, dan `cek-inventaris.mjs` sudah gagal lebih dulu.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Galeri } from "./Gallery";
import { pasangGayaDasar } from "./dasar";
import { KomposisiBeranda, KomposisiChrome } from "./screens/beranda";
import {
  KomposisiAturGayaLapisan,
  KomposisiBukaTutupLapisan,
  KomposisiGaleriPeta,
  KomposisiImporGeojson,
  KomposisiImporGeopdf,
  KomposisiImporGeotiff,
  KomposisiLegenda,
} from "./screens/peta";
import {
  KomposisiMulaiJedaHentikan,
  KomposisiRekamJejak,
  KomposisiRingkasanJejak,
} from "./screens/lapangan-rekam";
import { KomposisiLampirkanFoto, KomposisiTitikBaru } from "./screens/lapangan-titik";
import {
  KomposisiBacaKoordinat,
  KomposisiSalinKoordinat,
  KomposisiUkurJarak,
  KomposisiUkurLuas,
} from "./screens/lapangan-ukur";
import {
  KomposisiDaftarRegion,
  KomposisiHapusRegion,
  KomposisiIndikatorOffline,
  KomposisiStatusPenyimpanan,
  KomposisiUnduhRegion,
} from "./screens/offline";
import {
  KomposisiBuatGeofence,
  KomposisiDaftarGeofence,
  KomposisiGpsAveraging,
  KomposisiPeringatanMasukKeluar,
} from "./screens/geofence";
import {
  KomposisiBahasa,
  KomposisiIzinLokasiDitolak,
  KomposisiLokasiMati,
  KomposisiPengaturan,
  KomposisiPlugin,
  KomposisiTema,
} from "./screens/sistem";

const KOMPONEN = {
  KomposisiBeranda,
  KomposisiChrome,
  KomposisiImporGeopdf,
  KomposisiImporGeotiff,
  KomposisiImporGeojson,
  KomposisiGaleriPeta,
  KomposisiBukaTutupLapisan,
  KomposisiAturGayaLapisan,
  KomposisiLegenda,
  KomposisiRekamJejak,
  KomposisiMulaiJedaHentikan,
  KomposisiRingkasanJejak,
  KomposisiTitikBaru,
  KomposisiLampirkanFoto,
  KomposisiUkurJarak,
  KomposisiUkurLuas,
  KomposisiBacaKoordinat,
  KomposisiSalinKoordinat,
  KomposisiUnduhRegion,
  KomposisiDaftarRegion,
  KomposisiHapusRegion,
  KomposisiStatusPenyimpanan,
  KomposisiIndikatorOffline,
  KomposisiBuatGeofence,
  KomposisiDaftarGeofence,
  KomposisiPeringatanMasukKeluar,
  KomposisiGpsAveraging,
  KomposisiPengaturan,
  KomposisiTema,
  KomposisiBahasa,
  KomposisiPlugin,
  KomposisiIzinLokasiDitolak,
  KomposisiLokasiMati,
};

export function pasangGaleri(elemen: HTMLElement) {
  pasangGayaDasar(elemen.ownerDocument);
  createRoot(elemen).render(
    <StrictMode>
      <Galeri komponen={KOMPONEN} />
    </StrictMode>,
  );
}

export { KOMPONEN };
