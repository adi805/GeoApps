import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Bukti otomatis celah P0 G1 di jalur terdekat ke HP, tanpa menunggu emulator.
 *
 * Yang dibuktikan: byte PDF yang diimpor benar-benar mendarat di IndexedDB
 * (`geolibre-geopdf-pdfs`) dan MASIH ADA setelah proses browser dibunuh lalu
 * profil yang sama dibuka lagi. Itu tepat klaim perbaikannya — dulu byte PDF
 * hanya hidup di memori, jadi `restoreGeoPdfTileSets` tidak punya sumber apa pun
 * setelah app ditutup.
 *
 * Model "mode pesawat" di sini: request ke luar localhost DITOLAK, localhost
 * tetap boleh. Di APK, aset app ikut di dalam paket, jadi jaringan mati tidak
 * mematikan shell-nya; localhost adalah padanan aset lokal itu. Mematikan
 * seluruh context (`setOffline(true)`) salah model: chunk JS ikut gagal dan
 * yang diuji jadi service worker, bukan arsip GeoPDF.
 *
 * BUKAN cakupan spec ini, dan tidak boleh diklaim darinya: peta GeoPDF utuh
 * pulih setelah app dibuka lagi (itu bergantung pemulihan proyek, yang di build
 * browser memang tidak berjalan), wake lock layar, izin kamera `content://`,
 * GPS asli, dan background track recording. Semua itu butuh HP/emulator.
 */

const BASE = process.env.BASE_URL || "http://localhost:4173";
const GEOPDF_FIXTURE = "tests/fixtures/geopdf/qgis-3.35-getprint.pdf";
const PDF_DB = "geolibre-geopdf-pdfs";
const PDF_STORE = "pdfs";

const SETTINGS_KEY = (() => {
  const src = readFileSync("apps/geolibre-desktop/src/lib/storage-keys.ts", "utf8");
  const m = src.match(/DESKTOP_SETTINGS_STORAGE_KEY\s*=\s*["'`]([^"'`]+)/);
  return m ? m[1] : null;
})();

/** Proyek seed yang sama dengan `e2e/helpers.ts`, supaya viewer bisa dimasuki. */
const SEED = {
  path: "/e2e/seed-project.geolibre.json",
  name: "E2E Seed Project",
  openedAt: "2026-01-01T00:00:00.000Z",
};
const RECENT_KEY = "geolibre.recentProjects";

/**
 * Request ke luar localhost ditolak: padanan mode pesawat untuk build web.
 *
 * @param context - Context yang requestnya dibatasi.
 */
async function blockExternalNetwork(context: BrowserContext): Promise<void> {
  await context.route("**/*", (route) => {
    const { hostname } = new URL(route.request().url());
    if (hostname === "localhost" || hostname === "127.0.0.1") return route.continue();
    return route.abort("internetdisconnected");
  });
}

/**
 * Menyemai onboarding + proyek recent pada SETIAP navigasi.
 *
 * Onboarding harus dilewati karena modalnya menutupi seluruh layar dan menelan
 * klik; proyek recent adalah pintu masuk viewer di build browser.
 *
 * @param context - Context yang akan disemai.
 */
async function seedStorage(context: BrowserContext): Promise<void> {
  await context.addInitScript(
    ({ settingsKey, recentKey, seed }) => {
      try {
        if (settingsKey) {
          const cur = JSON.parse(window.localStorage.getItem(settingsKey) || "{}");
          cur.uiProfile = { ...(cur.uiProfile || {}), onboarded: true };
          window.localStorage.setItem(settingsKey, JSON.stringify(cur));
        }
        const stored = window.localStorage.getItem(recentKey);
        const parsed = stored ? JSON.parse(stored) : [];
        const others = Array.isArray(parsed)
          ? parsed.filter((e) => e && typeof e === "object" && e.path !== seed.path)
          : [];
        window.localStorage.setItem(recentKey, JSON.stringify([seed, ...others]));
      } catch {
        /* storage tidak tersedia: klik proyek akan gagal dengan pesan jelas */
      }
    },
    { settingsKey: SETTINGS_KEY, recentKey: RECENT_KEY, seed: SEED },
  );
}

/**
 * Jumlah entri di arsip byte PDF.
 *
 * `indexedDB.databases()` diperiksa lebih dulu. Membuka database yang belum ada
 * akan membangunnya di versi 1 tanpa object store, dan `open(name, 1)` milik app
 * lalu tidak pernah memicu `onupgradeneeded`, sehingga setiap put gagal. Probe
 * yang meracuni arsip yang sedang diukur itu jebakan yang sudah tercatat di
 * `e2e/geopdf-tiles.ts`.
 *
 * @param page - Halaman yang arsipnya dibaca.
 * @returns Jumlah entri, atau -1 kalau databasenya belum ada.
 */
async function countArchivedPdfs(page: Page): Promise<number> {
  return page.evaluate(
    async ({ dbName, storeName }) => {
      const existing = (await indexedDB.databases?.()) ?? [];
      if (!existing.some((db) => db.name === dbName)) return -1;
      return new Promise<number>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.close();
            resolve(0);
            return;
          }
          const keys = db.transaction(storeName, "readonly").objectStore(storeName).getAllKeys();
          keys.onsuccess = () => {
            resolve(keys.result.length);
            db.close();
          };
          keys.onerror = () => reject(keys.error);
        };
      });
    },
    { dbName: PDF_DB, storeName: PDF_STORE },
  );
}

/**
 * Membuka profil persisten dan menunggu shell app ter-mount.
 *
 * Profil persisten (bukan context sekali pakai) adalah inti pengujian: menutup
 * context mematikan proses Chrome-nya, dan membukanya lagi membaca IndexedDB
 * yang sama. Itu padanan "tutup paksa aplikasi" di HP.
 *
 * @param userDataDir - Direktori profil.
 * @param offline - Blokir semua request non-localhost.
 * @returns Context dan page yang sudah siap.
 */
async function openApp(
  userDataDir: string,
  offline: boolean,
): Promise<{ context: BrowserContext; page: Page }> {
  // Tanpa `channel`: runner CI memakai chromium bawaan Playwright, dan build
  // di laptop hanya punya headless shell. Memaksa channel "chrome" membuat tes
  // ini hijau di satu mesin dan merah di mesin lain.
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--no-sandbox"],
  });
  await seedStorage(context);
  if (offline) await blockExternalNetwork(context);
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90_000 });
  // `#root` kosong sampai React selesai mount (terukur ~9 s pada mesin ini),
  // jadi menunggu tombol tanpa ini hanya membakar timeout.
  await page.waitForFunction(() => (document.getElementById("root")?.children.length ?? 0) > 0, null, {
    timeout: 90_000,
  });
  return { context, page };
}

test.describe("GeoPDF offline (model APK: aset lokal, jaringan luar mati)", () => {
  /**
   * Kontrol negatif untuk probe arsip.
   *
   * Tanpa ini, tes utama hanya membuktikan `countArchivedPdfs` "pernah balik 1".
   * Probe yang selalu mengembalikan angka positif akan lolos tes itu juga. Di
   * profil baru tanpa impor, arsip memang belum ada, jadi probe WAJIB balik -1.
   * Itu yang membuat tes utama punya daya beda: -1 di sini, >=1 di sana.
   */
  test("profil baru tanpa impor: arsip belum ada (probe bisa merah)", async () => {
    test.setTimeout(180_000);
    const userDataDir = mkdtempSync(join(tmpdir(), "geoapps-control-"));
    try {
      const { context, page } = await openApp(userDataDir, false);
      expect(await page.getByRole("button").count()).toBeGreaterThan(0);
      const count = await countArchivedPdfs(page);
      expect(count, "arsip sudah berisi padahal belum ada PDF yang diimpor").toBe(-1);
      console.log(JSON.stringify({ controlArchiveCount: count }));
      await context.close();
    } finally {
      rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  test("arsip byte PDF bertahan setelah proses browser dibunuh", async () => {
    test.setTimeout(600_000);
    const userDataDir = mkdtempSync(join(tmpdir(), "geoapps-field-"));
    const notes: string[] = [];
    const record = (p: Page) => {
      p.on("pageerror", (e) => notes.push(`pageerror: ${String(e)}`));
      p.on("console", (m) => {
        if (m.type() === "error") notes.push(`console: ${m.text().slice(0, 200)}`);
      });
    };

    let archiveBefore = -1;
    let tilesBefore = -1;

    try {
      // --- Putaran 1: impor GeoPDF selagi online ---
      {
        const { context, page } = await openApp(userDataDir, false);
        record(page);
        await page.getByRole("button", { name: new RegExp(SEED.name) }).click({ timeout: 60_000 });
        await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 90_000 });

        await page.getByTestId("mobile-tab-project").click();
        await expect(page.getByTestId("mobile-project-sheet")).toBeVisible({ timeout: 30_000 });
        await page.getByTestId("mobile-import-input").setInputFiles(GEOPDF_FIXTURE);

        // Tunggu sampai rasterisasi benar-benar jalan, supaya jalur arsip pasti
        // sudah dilewati (arsip ditulis setelah hashPdfBytes, sebelum tiles).
        const deadline = Date.now() + 240_000;
        while (Date.now() < deadline) {
          archiveBefore = await countArchivedPdfs(page);
          if (archiveBefore >= 1) break;
          await page.waitForTimeout(2_000);
        }
        tilesBefore = await page.evaluate(
          async () => {
            const existing = (await indexedDB.databases?.()) ?? [];
            if (!existing.some((d) => d.name === "geolibre-geopdf-tiles")) return -1;
            return new Promise<number>((resolve) => {
              const r = indexedDB.open("geolibre-geopdf-tiles");
              r.onerror = () => resolve(-1);
              r.onsuccess = () => {
                const db = r.result;
                if (!db.objectStoreNames.contains("tiles")) {
                  db.close();
                  return resolve(0);
                }
                const k = db.transaction("tiles", "readonly").objectStore("tiles").getAllKeys();
                k.onsuccess = () => {
                  resolve(k.result.length);
                  db.close();
                };
                k.onerror = () => resolve(-1);
              };
            });
          },
        );
        expect(
          archiveBefore,
          "arsip IndexedDB geolibre-geopdf-pdfs kosong: byte PDF tidak disimpan, " +
            `jadi restore setelah app ditutup tidak punya sumber apa pun.\n${notes.join("\n")}`,
        ).toBeGreaterThanOrEqual(1);
        await context.close(); // proses Chrome mati di sini
      }

      // --- Putaran 2: proses baru, profil sama, jaringan luar mati ---
      {
        const { context, page } = await openApp(userDataDir, true);
        record(page);
        // Shell app harus tetap hidup tanpa jaringan luar (aset dari localhost).
        const buttons = await page.getByRole("button").count();
        expect(
          buttons,
          `shell app tidak ter-mount saat jaringan luar mati.\n${notes.join("\n")}`,
        ).toBeGreaterThan(0);

        const archiveAfter = await countArchivedPdfs(page);
        expect(
          archiveAfter,
          "arsip byte PDF HILANG setelah proses browser mati: perbaikan G1 tidak bekerja",
        ).toBeGreaterThanOrEqual(archiveBefore);

        // Angka dicetak apa adanya supaya laporan bisa mengutipnya, bukan menebak.
        console.log(
          JSON.stringify({
            archiveBefore,
            archiveAfter,
            tilesBefore,
            externalNetwork: "blocked",
            shellButtons: buttons,
            processRestarted: true,
          }),
        );
        await context.close();
      }
    } finally {
      rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
