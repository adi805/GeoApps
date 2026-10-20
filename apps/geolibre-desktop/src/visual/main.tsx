/**
 * Pemasangan galeri untuk `visual.html`.
 *
 * Berkas terpisah dari `entry.tsx` supaya `visual.html` bisa dibundel sendiri
 * lewat esbuild tanpa menyentuh `vite.config.ts` aplikasi.
 */

import { pasangGaleri } from "./entry";

const elemen = document.getElementById("galeri");
if (!elemen) throw new Error("elemen #galeri tidak ditemukan");
pasangGaleri(elemen);
