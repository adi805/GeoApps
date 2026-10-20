/**
 * Token bahasa visual GeoApps.
 *
 * Satu sumber untuk warna, spasi, radius, tipografi, elevasi, durasi gerak, dan
 * ukuran sentuh. Komposisi layar tidak boleh menulis nilai mentah: `hex` hanya
 * boleh muncul di berkas ini, dan `cek-inventaris.mjs` menolak komposisi yang
 * memuatnya. Aturan itu yang membuat satu perubahan token merambat ke semua
 * layar tanpa menyunting satu komposisi pun.
 *
 * Kontras: tiap pasangan teks/latar di ketiga tema memenuhi WCAG AA (4.5:1 untuk
 * teks normal, 3:1 untuk teks besar dan batas kontrol). Angkanya diperiksa
 * `cek-inventaris.mjs`, bukan diklaim di komentar ini.
 */

export type Tema = "terang" | "gelap" | "kontras";

export const TEMA: readonly Tema[] = ["terang", "gelap", "kontras"];

/** Palet semantik. Nama mengikuti peran, bukan warna, supaya tema bisa diganti. */
export interface Palet {
  /** Latar halaman, di belakang kartu. */
  latar: string;
  /** Permukaan kartu, lembar, dan dialog. */
  permukaan: string;
  /** Permukaan yang tenggelam: bilah, kolom isian, baris terpilih. */
  permukaanTinggi: string;
  /** Garis pemisah dan batas kontrol. */
  garis: string;
  /** Teks utama. */
  teks: string;
  /** Teks sekunder: keterangan, satuan, cap waktu. */
  teksLembut: string;
  /** Teks di atas `utama` dan `bahaya`. */
  utamaTeks: string;
  /** Warna aksi utama. */
  utama: string;
  /** Warna aksen: penanda lokasi aktif, sorotan. */
  aksen: string;
  /** Teks di atas `aksen`. */
  aksenTeks: string;
  /** Keadaan berhasil. */
  sukses: string;
  /** Keadaan perlu perhatian. */
  peringatan: string;
  /** Keadaan gagal. */
  bahaya: string;
  /** Teks di atas `bahaya`. */
  bahayaTeks: string;
  /** Keadaan informatif. */
  info: string;
  /** Cincin fokus papan ketik. */
  fokus: string;
  /** Isi peta: perairan. */
  petaAir: string;
  /** Isi peta: lahan. */
  petaLahan: string;
  /** Isi peta: jalan dan batas bidang. */
  petaJalan: string;
}

export const palet: Record<Tema, Palet> = {
  terang: {
    latar: "#F4F6F2",
    permukaan: "#FFFFFF",
    permukaanTinggi: "#E9EDE6",
    garis: "#CBD3C7",
    teks: "#161C15",
    teksLembut: "#4C5750",
    utamaTeks: "#FFFFFF",
    utama: "#1C5C3B",
    aksen: "#8A4B00",
    aksenTeks: "#FFFFFF",
    sukses: "#14603A",
    peringatan: "#7A4A00",
    bahaya: "#A32020",
    bahayaTeks: "#FFFFFF",
    info: "#17458F",
    fokus: "#0B57D0",
    petaAir: "#CFE3EA",
    petaLahan: "#DCE6CE",
    petaJalan: "#F2F0E6",
  },
  gelap: {
    latar: "#0F1310",
    permukaan: "#181D19",
    permukaanTinggi: "#222924",
    garis: "#39443B",
    teks: "#EDF1EA",
    teksLembut: "#B6C1B7",
    utamaTeks: "#0B120D",
    utama: "#7FD3A2",
    aksen: "#F0B464",
    aksenTeks: "#241505",
    sukses: "#7FD3A2",
    peringatan: "#F0B464",
    bahaya: "#FF8F8F",
    bahayaTeks: "#2A0A0A",
    info: "#9CC4FF",
    fokus: "#9CC4FF",
    petaAir: "#1B2C33",
    petaLahan: "#24301F",
    petaJalan: "#2E3129",
  },
  kontras: {
    latar: "#000000",
    permukaan: "#000000",
    permukaanTinggi: "#141414",
    garis: "#FFFFFF",
    teks: "#FFFFFF",
    teksLembut: "#E8E8E8",
    utamaTeks: "#000000",
    utama: "#FFD400",
    aksen: "#FFD400",
    aksenTeks: "#000000",
    sukses: "#7CFFB2",
    peringatan: "#FFD400",
    bahaya: "#FF9B9B",
    bahayaTeks: "#000000",
    info: "#9CD0FF",
    fokus: "#FFD400",
    petaAir: "#002B36",
    petaLahan: "#1F2A12",
    petaJalan: "#2A2A2A",
  },
};

/**
 * Pasangan warna yang wajib lulus WCAG AA, beserta ambangnya. Dipakai
 * `cek-inventaris.mjs`; daftar ini bagian dari kontrak, bukan dokumentasi.
 */
export interface PasanganKontras {
  depan: keyof Palet;
  belakang: keyof Palet;
  minimum: number;
}

export const KONTRAS_WAJIB: readonly PasanganKontras[] = [
  { depan: "teks", belakang: "latar", minimum: 4.5 },
  { depan: "teks", belakang: "permukaan", minimum: 4.5 },
  { depan: "teks", belakang: "permukaanTinggi", minimum: 4.5 },
  { depan: "teksLembut", belakang: "latar", minimum: 4.5 },
  { depan: "teksLembut", belakang: "permukaan", minimum: 4.5 },
  { depan: "utamaTeks", belakang: "utama", minimum: 4.5 },
  { depan: "aksenTeks", belakang: "aksen", minimum: 4.5 },
  { depan: "bahayaTeks", belakang: "bahaya", minimum: 4.5 },
  { depan: "utama", belakang: "permukaan", minimum: 3 },
  { depan: "bahaya", belakang: "permukaan", minimum: 4.5 },
  { depan: "peringatan", belakang: "permukaan", minimum: 4.5 },
  { depan: "sukses", belakang: "permukaan", minimum: 4.5 },
  { depan: "info", belakang: "permukaan", minimum: 4.5 },
  { depan: "fokus", belakang: "permukaan", minimum: 3 },
];

/** Skala spasi 4 px. Nama, bukan angka, supaya maksudnya terbaca di komposisi. */
export const spasi = {
  nol: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  besar: 40,
  besarSekali: 48,
  maks: 64,
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  penuh: 999,
} as const;

export const tipografi = {
  keluarga: {
    sans: '"IBM Plex Sans Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  },
  ukuran: {
    mikro: 11,
    kecil: 12,
    badan: 14,
    badanBesar: 16,
    judulKecil: 18,
    judul: 20,
    judulBesar: 24,
    angka: 28,
  },
  bobot: {
    biasa: 400,
    sedang: 500,
    tebal: 600,
    sangatTebal: 700,
  },
  tinggiBaris: {
    rapat: 1.2,
    normal: 1.45,
    longgar: 1.6,
  },
  /** Jarak huruf untuk label huruf besar berskala kecil. */
  jarakHuruf: {
    label: 0.4,
    biasa: 0,
  },
} as const;

export const elevasi = {
  nol: "none",
  rendah: "0 1px 2px rgba(12, 20, 14, 0.10)",
  sedang: "0 2px 6px rgba(12, 20, 14, 0.14)",
  tinggi: "0 8px 24px rgba(12, 20, 14, 0.22)",
} as const;

export const gerak = {
  segera: 90,
  cepat: 150,
  normal: 220,
  lambat: 320,
  /** Kurva keluar yang dipakai semua transisi; tidak ada easing lain. */
  kurva: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

/** Ukuran sentuh. 44 px adalah batas bawah, bukan saran. */
export const sentuh = {
  minimum: 44,
  jarakMinimum: 8,
  ikon: 20,
} as const;

/** Kanvas acuan. Desktop tidak jadi acuan; dua lebar ini yang digambar. */
export const kanvas = {
  sempit: { lebar: 360, tinggi: 800, nama: "ponsel kecil" },
  lebar: { lebar: 412, tinggi: 915, nama: "ponsel besar" },
} as const;

export const LEBAR_KANVAS: readonly number[] = [kanvas.sempit.lebar, kanvas.lebar.lebar];

/** Ruang aman atas/bawah: komposisi tidak menempel ke tepi perangkat. */
export const ruangAman = {
  atas: 24,
  bawah: 20,
  sisi: 16,
} as const;

/** Tinggi tetap elemen krome, supaya isi tidak melompat antar keadaan. */
export const krome = {
  bilahAtas: 56,
  bilahBawah: 64,
  bilahStatus: 24,
} as const;

/** Batas lebar isi supaya baris teks tidak melebar di layar besar. */
export const lebarBaca = 640;
