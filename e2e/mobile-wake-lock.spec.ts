import { expect, test, type Page } from "./test";
import { waitForMap } from "./helpers";

/**
 * Bukti otomatis celah P0 G2: layar harus tetap hidup selama track direkam.
 *
 * Kenapa ini perlu tes sendiri. `GpsTrackingDialog` memegang screen wake lock
 * hanya selama `recording === "recording"` (`GpsTrackingDialog.tsx:361`), dan
 * melepasnya saat jeda, berhenti, atau unmount. Kalau efek itu hilang, tidak
 * ada yang gagal: rekaman cuma berhenti diam-diam begitu layar mati, dan baru
 * ketahuan setelah pengguna kehilangan jejak di lapangan. Audit P0 mencatatnya
 * sebagai `factory/docs/bukti-apk/02-audit-p0.md` bagian 4.
 *
 * DUA KLAIM, DUA ALAT. Keduanya tidak boleh dicampur:
 *
 * 1. **Wiring** (tes "meminta kunci saat merekam"): `navigator.wakeLock`
 *    diganti stub yang mencatat `request`/`release`. Ini membuktikan app
 *    memanggil API di saat yang benar dan melepasnya, BUKAN bahwa layar
 *    menyala. Stub sengaja dipakai karena langkah 2 menjelaskan kenapa.
 * 2. **Ketahanan saat platform menolak** (tes "tetap merekam walau kunci
 *    ditolak"): API ASLI dipakai, hanya dibungkus untuk mencatat hasilnya. Di
 *    chromium headless `request("screen")` ditolak `NotAllowedError` (diukur
 *    2026-11-11: `{"supported":true,"result":"error:NotAllowedError"}`), jadi
 *    mesin ini justru menguji jalur gagal: `requestScreenWakeLock` tidak boleh
 *    melempar dan dialog harus tetap merekam.
 *
 * Yang TIDAK dibuktikan di sini, dan tidak boleh diklaim: layar HP benar-benar
 * tetap menyala. Itu butuh perangkat dengan layar. Yang diuji adalah kontrak
 * kode yang membuatnya mungkin.
 */

const GPS_MENU = /GPS Tracking/;

/**
 * Memasang stub `navigator.wakeLock` yang mencatat setiap permintaan/pelepasan.
 *
 * Harus dipasang lewat `addInitScript` supaya sudah ada sebelum modul app
 * berjalan: `requestScreenWakeLock` membaca `navigator.wakeLock` saat dipanggil,
 * bukan saat modul diimpor, tapi memasangnya lebih awal menghilangkan balapan.
 *
 * @param page - Halaman yang akan diinstrumentasi.
 */
async function stubWakeLock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log = { requests: [] as string[], releases: 0 };
    Object.defineProperty(window, "__wakeLog", { configurable: true, value: log });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: (type: string) => {
          log.requests.push(type);
          return Promise.resolve({
            release: async () => {
              log.releases += 1;
            },
          });
        },
      },
    });
  });
}

/**
 * Membungkus API wake lock ASLI tanpa mengubah perilakunya.
 *
 * Dipakai tes ketahanan: hasil aslinya (`granted` atau `error:<name>`) dicatat,
 * lalu promise aslinya diteruskan apa adanya, termasuk penolakannya.
 *
 * @param page - Halaman yang akan diinstrumentasi.
 */
async function spyRealWakeLock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: { calls: number; outcomes: string[]; supported: boolean } = {
      calls: 0,
      outcomes: [],
      supported: typeof navigator.wakeLock?.request === "function",
    };
    Object.defineProperty(window, "__realWakeLog", { configurable: true, value: log });
    if (!log.supported) return;
    const original = navigator.wakeLock!.request.bind(navigator.wakeLock);
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: (type: "screen") => {
          log.calls += 1;
          return original(type).then(
            (held) => {
              log.outcomes.push("granted");
              return held;
            },
            (error: unknown) => {
              const name = (error as { name?: string } | null)?.name ?? "unknown";
              log.outcomes.push(`error:${name}`);
              throw error;
            },
          );
        },
      },
    });
  });
}

/** Membaca catatan stub. */
async function readStubLog(page: Page): Promise<{ requests: string[]; releases: number }> {
  return page.evaluate(() => {
    const log = (window as unknown as { __wakeLog?: { requests: string[]; releases: number } })
      .__wakeLog;
    return { requests: log?.requests ?? [], releases: log?.releases ?? 0 };
  });
}

/** Membaca catatan pembungkus API asli. */
async function readRealLog(
  page: Page,
): Promise<{ calls: number; outcomes: string[]; supported: boolean }> {
  return page.evaluate(() => {
    const log = (
      window as unknown as {
        __realWakeLog?: { calls: number; outcomes: string[]; supported: boolean };
      }
    ).__realWakeLog;
    return {
      calls: log?.calls ?? 0,
      outcomes: log?.outcomes ?? [],
      supported: log?.supported ?? false,
    };
  });
}

/**
 * Membuka dialog GPS Tracking dari menu Controls.
 *
 * Izin lokasi diberikan supaya `watchPosition` tidak menyumbang error yang
 * mengaburkan penyebab kalau tes gagal; wake lock tidak bergantung padanya,
 * karena `handleStartRecording` menyetel `recording` sebelum fix pertama tiba.
 *
 * @param page - Halaman yang sudah memuat peta.
 * @returns Locator dialog.
 */
async function openGpsDialog(page: Page) {
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: -6.2, longitude: 106.8, accuracy: 5 });
  await page.getByRole("button", { name: "Controls", exact: true }).click();
  await page.getByRole("menuitem", { name: GPS_MENU }).click();
  const dialog = page.getByRole("dialog", { name: "GPS Tracking" });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  return dialog;
}

test.describe("Wake lock saat merekam jejak (G2)", () => {
  /**
   * Kontrol negatif: dialog dibuka tapi belum merekam, jadi TIDAK boleh ada
   * satu pun permintaan kunci.
   *
   * Tanpa ini, tes berikutnya hanya membuktikan "ada permintaan kunci setelah
   * klik Record". Kalau efeknya salah tempat (misal berjalan saat dialog
   * dibuka), tes itu tetap hijau dan baterai pengguna terkuras tanpa manfaat.
   */
  test("dialog terbuka tanpa merekam: kunci belum diminta", async ({ page }) => {
    test.setTimeout(180_000);
    await stubWakeLock(page);
    await waitForMap(page, "/?lang=en");
    const dialog = await openGpsDialog(page);

    await expect(dialog.getByRole("button", { name: "Record track", exact: true })).toBeVisible();
    // Beri waktu efek apa pun untuk berjalan; tidak merekam = tidak ada kunci.
    await page.waitForTimeout(2_000);
    const { requests, releases } = await readStubLog(page);
    expect(
      requests,
      "kunci layar diminta padahal belum ada perekaman: efek G2 salah tempat",
    ).toEqual([]);
    expect(releases).toBe(0);
    console.log(JSON.stringify({ phase: "idle", requests, releases }));
  });

  /**
   * Wiring utama: kunci diminta saat merekam, dilepas saat jeda, diminta lagi
   * saat dilanjutkan.
   *
   * Angka dicetak supaya laporan bisa mengutipnya apa adanya.
   */
  test("meminta kunci saat merekam, melepas saat jeda, meminta lagi saat lanjut", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await stubWakeLock(page);
    await waitForMap(page, "/?lang=en");
    const dialog = await openGpsDialog(page);

    await dialog.getByRole("button", { name: "Record track", exact: true }).click();
    await expect
      .poll(async () => (await readStubLog(page)).requests.length, { timeout: 20_000 })
      .toBeGreaterThanOrEqual(1);
    let log = await readStubLog(page);
    expect(log.requests[0], "tipe kunci yang diminta harus 'screen'").toBe("screen");
    expect(log.releases, "kunci dilepas padahal perekaman baru mulai").toBe(0);

    // Jeda: rekaman berhenti, jadi layar tidak perlu ditahan lagi.
    await dialog.getByRole("button", { name: "Pause", exact: true }).click();
    await expect
      .poll(async () => (await readStubLog(page)).releases, { timeout: 20_000 })
      .toBeGreaterThanOrEqual(1);

    // Lanjut: segmen baru, kunci harus diambil ulang.
    await dialog.getByRole("button", { name: "Resume", exact: true }).click();
    const beforeResume = log.requests.length;
    await expect
      .poll(async () => (await readStubLog(page)).requests.length, { timeout: 20_000 })
      .toBeGreaterThan(beforeResume);

    // Jeda lagi: kunci kedua juga harus dilepas, bukan ditumpuk.
    await dialog.getByRole("button", { name: "Pause", exact: true }).click();
    await expect
      .poll(async () => (await readStubLog(page)).releases, { timeout: 20_000 })
      .toBeGreaterThanOrEqual(2);

    log = await readStubLog(page);
    console.log(
      JSON.stringify({
        phase: "wiring",
        requests: log.requests,
        releases: log.releases,
        note: "stub: membuktikan pemanggilan API, bukan layar menyala",
      }),
    );
  });

  /**
   * Ketahanan: API asli dipakai. Di headless hasilnya `NotAllowedError`, dan
   * itu justru yang diuji, karena `requestScreenWakeLock` berjanji tidak pernah
   * melempar. Dialog harus tetap merekam, tanpa pageerror.
   */
  test("tetap merekam walau platform menolak kunci (API asli)", async ({ page }) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await spyRealWakeLock(page);
    await waitForMap(page, "/?lang=en");
    const dialog = await openGpsDialog(page);

    const supported = (await readRealLog(page)).supported;
    test.skip(!supported, "navigator.wakeLock tidak ada di browser ini");

    await dialog.getByRole("button", { name: "Record track", exact: true }).click();
    // Rekaman harus tetap aktif apa pun hasil permintaan kunci.
    await expect(dialog.getByRole("button", { name: "Pause", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect
      .poll(async () => (await readRealLog(page)).calls, { timeout: 20_000 })
      .toBeGreaterThanOrEqual(1);

    const log = await readRealLog(page);
    expect(
      errors,
      `permintaan kunci yang ditolak platform membocorkan error ke halaman:\n${errors.join("\n")}`,
    ).toEqual([]);
    console.log(
      JSON.stringify({
        phase: "real-api",
        calls: log.calls,
        outcomes: log.outcomes,
        headlessMeansRejection: log.outcomes.some((o) => o.startsWith("error:")),
      }),
    );
  });
});
