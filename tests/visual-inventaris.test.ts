/**
 * Kontrak inventaris komposisi visual (issue #42).
 *
 * `inventaris.ts` adalah daftar janji: tiap fungsi produk menyebut kelima
 * keadaan layar, dan tiap entri menunjuk komponen yang benar-benar diekspor
 * berkas layarnya. Dua arah kontrak itu yang diuji di sini, karena keduanya
 * hanya dijaga oleh `cek-inventaris.mjs` yang tidak dijalankan CI.
 *
 * Pemeriksaan komponen dibaca dari teks berkas layar, sama seperti yang
 * dilakukan `cek-inventaris.mjs`: menambah komposisi tanpa mendaftarkannya
 * harus gagal di sini, bukan diam-diam lolos.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  INVENTARIS,
  JUMLAH_KOMPOSISI,
  type Komposisi,
} from "../apps/geolibre-desktop/src/visual/inventaris";

const VISUAL = fileURLToPath(new URL("../apps/geolibre-desktop/src/visual/", import.meta.url));
const SCREENS = `${VISUAL}screens/`;

/** Kelima keadaan yang wajib disebut tiap entri. */
const KUNCI_KEADAAN = ["kosong", "memuat", "galat", "offline", "izinDitolak"] as const;

/** Jalur kerja yang dikenal inventaris. */
const JALUR_SAH = ["peta", "lapangan", "offline", "geofence", "sistem"] as const;

/** Alasan satu baris di bawah ini tidak menjelaskan apa pun. */
const MIN_ALASAN = 20;

/** Komponen `Komposisi*` yang benar-benar diekspor sebuah berkas layar. */
function komponenDiekspor(berkas: string): string[] {
  const isi = readFileSync(`${SCREENS}${berkas.replace(/^screens\//, "")}`, "utf8");
  return [...isi.matchAll(/export function (Komposisi[A-Za-z0-9]+)\s*\(/g)].map((m) => m[1]);
}

/** Semua berkas layar yang ada di disk. */
function berkasLayar(): string[] {
  return readdirSync(SCREENS)
    .filter((nama) => nama.endsWith(".tsx"))
    .sort();
}

describe("inventaris komposisi visual", () => {
  it("menghitung daftarnya sendiri, bukan angka yang dihafal", () => {
    assert.ok(INVENTARIS.length > 0, "inventaris tidak boleh kosong");
    assert.equal(JUMLAH_KOMPOSISI, INVENTARIS.length);
  });

  it("memberi id unik yang aman dipakai sebagai nama berkas tangkapan layar", () => {
    const id = INVENTARIS.map((entri) => entri.id);
    assert.equal(new Set(id).size, id.length, "ada id ganda di inventaris");
    for (const nilai of id) {
      assert.match(nilai, /^[a-z0-9]+(-[a-z0-9]+)*$/, `id tidak aman dipakai sebagai nama berkas: ${nilai}`);
    }
  });

  it("memakai jalur kerja yang dikenal saja", () => {
    for (const entri of INVENTARIS) {
      assert.ok(
        (JALUR_SAH as readonly string[]).includes(entri.jalur),
        `${entri.id}: jalur tidak dikenal: ${entri.jalur}`,
      );
    }
  });

  it("menyebut kelima keadaan di tiap entri, dengan alasan yang bisa dibantah", () => {
    for (const entri of INVENTARIS) {
      const keadaan: Record<string, unknown> = { ...entri.keadaan };
      assert.deepEqual(
        Object.keys(keadaan).sort(),
        [...KUNCI_KEADAAN].sort(),
        `${entri.id}: kunci keadaan tidak lengkap atau berlebih`,
      );
      for (const kunci of KUNCI_KEADAAN) {
        const nilai = keadaan[kunci];
        if (nilai === true) continue;
        assert.equal(typeof nilai, "string", `${entri.id}.${kunci}: harus true atau alasan berupa teks`);
        assert.ok(
          (nilai as string).trim().length >= MIN_ALASAN,
          `${entri.id}.${kunci}: alasan terlalu pendek untuk berarti: ${String(nilai)}`,
        );
      }
    }
  });

  it("menunjuk komponen yang benar-benar diekspor berkas layarnya", () => {
    for (const entri of INVENTARIS) {
      const nama = entri.berkas.replace(/^screens\//, "");
      assert.ok(berkasLayar().includes(nama), `${entri.id}: berkas layar tidak ada: ${entri.berkas}`);
      assert.ok(
        komponenDiekspor(entri.berkas).includes(entri.komponen),
        `${entri.id}: ${entri.berkas} tidak mengekspor ${entri.komponen}`,
      );
    }
  });

  it("mendaftarkan setiap komposisi yang diekspor, tanpa sisa", () => {
    const terdaftar = new Set(INVENTARIS.map((entri: Komposisi) => entri.komponen));
    const diekspor = berkasLayar().flatMap((nama) => komponenDiekspor(`screens/${nama}`));
    const belumTerdaftar = diekspor.filter((nama) => !terdaftar.has(nama));
    assert.deepEqual(belumTerdaftar, [], "ada komposisi yang diekspor tapi tidak terdaftar di inventaris");
    assert.equal(
      diekspor.length,
      INVENTARIS.length,
      "jumlah komposisi yang diekspor tidak sama dengan jumlah entri inventaris",
    );
  });

  it("memberi judul yang terbaca dan unik", () => {
    const judul = INVENTARIS.map((entri) => entri.judul);
    for (const entri of INVENTARIS) {
      assert.ok(entri.judul.trim().length > 0, `${entri.id}: judul kosong`);
      assert.ok(entri.catatan.trim().length > 0, `${entri.id}: catatan kosong`);
    }
    assert.equal(new Set(judul).size, judul.length, "ada judul ganda, galeri akan sulit dibedakan");
  });
});
