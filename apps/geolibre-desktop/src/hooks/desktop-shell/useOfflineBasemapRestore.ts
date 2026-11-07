/**
 * Memulihkan basemap offline setiap kali URL gaya basemap berubah.
 *
 * KENAPA dipisah dari `usePluginStateRestore`: hook itu berjalan pada
 * `projectGeneration` dan `mapReadyGeneration`, dan urutannya terhadap
 * pemuatan proyek tidak dijamin. Kalau hook itu jalan lebih dulu,
 * `basemapStyleUrl` di store masih menunjuk basemap default, sehingga
 * `restoreStartupOfflineBasemap` keluar sebagai "bukan sentinel offline" dan
 * tidak pernah diulang untuk proyek itu. Gejalanya sudah tertangkap probe:
 * arsipnya ada, tapi sentinel di store tetap `.../<id>/1` dan peta memasang
 * basemap default.
 *
 * Dengan berlangganan ke `basemapStyleUrl`, pemulihan terjadi pada saat yang
 * benar tanpa bergantung pada urutan efek lain, dan tetap sekali per sentinel
 * karena modul startup menyimpan daftar URL yang sudah dicoba.
 */

import { useAppStore } from "@geolibre/core";
import { useEffect } from "react";
import { restoreStartupOfflineBasemap } from "../../lib/offline-basemap-startup";

export function useOfflineBasemapRestore(): void {
  const basemapStyleUrl = useAppStore((state) => state.basemapStyleUrl);
  useEffect(() => {
    void restoreStartupOfflineBasemap();
  }, [basemapStyleUrl]);
}