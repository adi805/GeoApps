/**
 * Primitif bahasa visual GeoApps.
 *
 * Semua gaya di sini memakai token dari `tokens.ts` dan properti logis
 * (`start`/`end`), bukan `left`/`right`, karena antarmuka ini punya mode
 * kanan-ke-kiri. Tidak ada `className`: primitif ini dipakai juga oleh galeri
 * `visual.html` yang dibuka tanpa proses Tailwind.
 */

import {
  createContext,
  useContext,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ChevronLeft, LoaderCircle } from "lucide-react";
import {
  elevasi,
  gerak,
  krome,
  palet,
  radius,
  ruangAman,
  sentuh,
  spasi,
  tipografi,
  type Palet,
  type Tema,
} from "./tokens";

const KonteksTema = createContext<Tema>("terang");

export function PenyediaTema({ tema, children }: { tema: Tema; children: ReactNode }) {
  return <KonteksTema.Provider value={tema}>{children}</KonteksTema.Provider>;
}

/** Palet aktif. Primitif memakai ini, komposisi tidak perlu tahu temanya. */
export function usePalet(): Palet {
  return palet[useContext(KonteksTema)];
}

export function useTemaAktif(): Tema {
  return useContext(KonteksTema);
}

/** Gaya teks dari skala tipografi; satu tempat untuk ukuran, bobot, dan tinggi baris. */
export function gayaTeks(
  ukuran: keyof typeof tipografi.ukuran = "badan",
  opsi: {
    bobot?: keyof typeof tipografi.bobot;
    warna?: string;
    mono?: boolean;
    rata?: CSSProperties["textAlign"];
  } = {},
): CSSProperties {
  return {
    fontFamily: opsi.mono ? tipografi.keluarga.mono : tipografi.keluarga.sans,
    fontSize: tipografi.ukuran[ukuran],
    fontWeight: tipografi.bobot[opsi.bobot ?? "biasa"],
    lineHeight: tipografi.tinggiBaris.normal,
    color: opsi.warna,
    textAlign: opsi.rata ?? "start",
  };
}

/** Label huruf besar berskala kecil: judul bagian, satuan, penanda keadaan. */
export function gayaLabel(warna: string): CSSProperties {
  return {
    ...gayaTeks("mikro", { bobot: "tebal", warna }),
    letterSpacing: tipografi.jarakHuruf.label,
    textTransform: "uppercase",
  };
}

export type VarianTombol = "utama" | "sekunder" | "halus" | "bahaya";

/**
 * Tombol. Tinggi minimum 44 px dari `sentuh.minimum`, bukan angka pilihan
 * komposisi: target sentuh di bawah itu tidak boleh ada di layar mana pun.
 */
export function Tombol({
  children,
  varian = "utama",
  ikon,
  lebarPenuh = false,
  nonaktif = false,
  onClick,
}: {
  children: ReactNode;
  varian?: VarianTombol;
  ikon?: ReactNode;
  lebarPenuh?: boolean;
  nonaktif?: boolean;
  onClick?: () => void;
}) {
  const p = usePalet();
  const latar =
    varian === "utama" ? p.utama : varian === "bahaya" ? p.bahaya : varian === "sekunder" ? p.permukaan : "transparent";
  const warna =
    varian === "utama"
      ? p.utamaTeks
      : varian === "bahaya"
        ? p.bahayaTeks
        : varian === "sekunder"
          ? p.teks
          : p.teksLembut;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={nonaktif}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: spasi.sm,
        minHeight: sentuh.minimum,
        minWidth: sentuh.minimum,
        paddingInline: spasi.lg,
        paddingBlock: spasi.sm,
        borderRadius: radius.md,
        border: `1px solid ${varian === "sekunder" ? p.garis : latar}`,
        background: latar,
        color: warna,
        fontFamily: tipografi.keluarga.sans,
        fontSize: tipografi.ukuran.badan,
        fontWeight: tipografi.bobot.tebal,
        lineHeight: tipografi.tinggiBaris.rapat,
        opacity: nonaktif ? 0.5 : 1,
        cursor: nonaktif ? "not-allowed" : "pointer",
        transition: `background ${gerak.cepat}ms ${gerak.kurva}, border-color ${gerak.cepat}ms ${gerak.kurva}`,
        width: lebarPenuh ? "100%" : undefined,
      }}
    >
      {ikon}
      <span>{children}</span>
    </button>
  );
}

/** Tombol ikon tanpa teks. `label` wajib: itu nama aksesibelnya, bukan hiasan. */
export function TombolIkon({
  label,
  ikon,
  terpilih = false,
  nonaktif = false,
  onClick,
}: {
  label: string;
  ikon: ReactNode;
  terpilih?: boolean;
  nonaktif?: boolean;
  onClick?: () => void;
}) {
  const p = usePalet();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={terpilih}
      onClick={onClick}
      disabled={nonaktif}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: sentuh.minimum,
        height: sentuh.minimum,
        borderRadius: radius.md,
        border: `1px solid ${terpilih ? p.utama : "transparent"}`,
        background: terpilih ? p.permukaanTinggi : "transparent",
        color: terpilih ? p.utama : p.teks,
        opacity: nonaktif ? 0.45 : 1,
        cursor: nonaktif ? "not-allowed" : "pointer",
      }}
    >
      {ikon}
    </button>
  );
}

/** Bilah atas layar: kembali, judul, dan paling banyak dua aksi. */
export function BilahAtas({
  judul,
  keterangan,
  kembali = true,
  aksi,
  penanda,
}: {
  judul: string;
  keterangan?: string;
  kembali?: boolean;
  aksi?: ReactNode;
  penanda?: ReactNode;
}) {
  const p = usePalet();
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: spasi.sm,
        minHeight: krome.bilahAtas,
        paddingInline: spasi.md,
        paddingBlock: spasi.sm,
        background: p.permukaan,
        borderBlockEnd: `1px solid ${p.garis}`,
      }}
    >
      {kembali ? <TombolIkon label="Kembali" ikon={<ChevronLeft size={sentuh.ikon} />} /> : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ ...gayaTeks("judulKecil", { bobot: "tebal", warna: p.teks }), margin: 0 }}>{judul}</h1>
        {keterangan ? (
          <p style={{ ...gayaTeks("kecil", { warna: p.teksLembut }), margin: 0, marginBlockStart: spasi.xs }}>
            {keterangan}
          </p>
        ) : null}
      </div>
      {penanda}
      {aksi}
    </header>
  );
}

/** Kartu: satu gagasan per kartu, dengan kaki opsional untuk aksi. */
export function Kartu({
  judul,
  keterangan,
  children,
  kaki,
  aksen,
}: {
  judul?: string;
  keterangan?: string;
  children?: ReactNode;
  kaki?: ReactNode;
  aksen?: string;
}) {
  const p = usePalet();
  return (
    <section
      style={{
        background: p.permukaan,
        border: `1px solid ${p.garis}`,
        borderInlineStartWidth: aksen ? 4 : 1,
        borderInlineStartColor: aksen ?? p.garis,
        borderRadius: radius.lg,
        boxShadow: elevasi.rendah,
        padding: spasi.lg,
        display: "flex",
        flexDirection: "column",
        gap: spasi.sm,
      }}
    >
      {judul ? (
        <h2 style={{ ...gayaTeks("badanBesar", { bobot: "tebal", warna: p.teks }), margin: 0 }}>{judul}</h2>
      ) : null}
      {keterangan ? (
        <p style={{ ...gayaTeks("kecil", { warna: p.teksLembut }), margin: 0 }}>{keterangan}</p>
      ) : null}
      {children}
      {kaki ? (
        <div style={{ display: "flex", gap: spasi.sm, marginBlockStart: spasi.sm, flexWrap: "wrap" }}>{kaki}</div>
      ) : null}
    </section>
  );
}

/**
 * Daftar: permukaan yang mengisi sisa layar, bukan kartu yang berhenti di
 * tengah.
 *
 * Daftar pendek di dalam kartu berhenti di baris terakhirnya, dan sisa layar
 * jadi latar kosong yang membuat tangkapan layar terlihat belum jadi. Daftar
 * yang mengisi sampai tepi bawah adalah pola yang benar untuk layar ponsel:
 * permukaannya berlanjut, barisnya yang berhenti.
 */
export function Daftar({ children, kepala }: { children: ReactNode; kepala?: ReactNode }) {
  const p = usePalet();
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        background: p.permukaan,
        borderBlockStart: `1px solid ${p.garis}`,
        paddingBlockEnd: ruangAman.bawah,
      }}
    >
      {kepala}
      {children}
    </div>
  );
}

/**
 * Bilah bawah: tempat aksi utama layar.
 *
 * Aksi utama yang mengapung di tengah isi menghilang begitu isi digulir, dan
 * aksi yang menempel di dasar layar adalah satu-satunya posisi yang bisa
 * dijangkau ibu jari tanpa memindahkan pegangan. Ia juga yang mengunci bagian
 * bawah layar sehingga tidak ada ruang mati.
 */
export function BilahBawah({ children }: { children: ReactNode }) {
  const p = usePalet();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spasi.sm,
        paddingInline: ruangAman.sisi,
        paddingBlock: spasi.md,
        background: p.permukaan,
        borderBlockStart: `1px solid ${p.garis}`,
        boxShadow: elevasi.rendah,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Bilah tab bawah: dua sampai empat tujuan utama, bukan menu.
 *
 * Tab adalah tempat berpindah, bukan tempat beraksi. Aksi utama tetap di
 * `BilahBawah` di atasnya, karena tab yang berubah-ubah isinya membuat jempol
 * menekan tombol yang salah. Tingginya dari `krome.bilahBawah`, dan tiap tab
 * memakai target sentuh penuh selebar kolomnya.
 */
export function BilahTab<T extends string>({
  tab,
  aktif,
  label,
}: {
  tab: readonly { id: T; label: string; ikon: ReactNode }[];
  aktif: T;
  /** Nama aksesibel kumpulan tab, mis. "Navigasi utama". */
  label: string;
}) {
  const p = usePalet();
  return (
    <div
      role="tablist"
      aria-label={label}
      style={{
        display: "flex",
        background: p.permukaan,
        borderBlockStart: `1px solid ${p.garis}`,
      }}
    >
      {tab.map((t) => {
        const terpilih = t.id === aktif;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={terpilih}
            style={{
              flex: 1,
              minHeight: krome.bilahBawah,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: spasi.xs,
              paddingBlock: spasi.sm,
              border: "none",
              borderBlockStart: `2px solid ${terpilih ? p.utama : "transparent"}`,
              background: terpilih ? p.permukaanTinggi : p.permukaan,
              color: terpilih ? p.utama : p.teksLembut,
              fontFamily: tipografi.keluarga.sans,
              fontSize: tipografi.ukuran.mikro,
              fontWeight: tipografi.bobot.tebal,
              letterSpacing: tipografi.jarakHuruf.label,
              cursor: "pointer",
            }}
          >
            {t.ikon}
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Chip: pilihan tunggal/berganda yang ringkas, tetap setinggi target sentuh. */
export function Chip({
  children,
  terpilih = false,
  onClick,
}: {
  children: ReactNode;
  terpilih?: boolean;
  onClick?: () => void;
}) {
  const p = usePalet();
  return (
    <button
      type="button"
      aria-pressed={terpilih}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spasi.xs,
        minHeight: sentuh.minimum,
        paddingInline: spasi.md,
        borderRadius: radius.penuh,
        border: `1px solid ${terpilih ? p.utama : p.garis}`,
        background: terpilih ? p.permukaanTinggi : p.permukaan,
        color: terpilih ? p.utama : p.teks,
        fontFamily: tipografi.keluarga.sans,
        fontSize: tipografi.ukuran.kecil,
        fontWeight: tipografi.bobot.sedang,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/** Baris daftar dengan ikon, dua baris teks, dan nilai di ujung `end`. */
export function BarisDaftar({
  ikon,
  judul,
  keterangan,
  ujung,
  onClick,
  terpilih = false,
}: {
  ikon?: ReactNode;
  judul: string;
  keterangan?: string;
  ujung?: ReactNode;
  onClick?: () => void;
  terpilih?: boolean;
}) {
  const p = usePalet();
  const isi = (
    <>
      {ikon ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            flexShrink: 0,
            borderRadius: radius.sm,
            background: p.permukaanTinggi,
            color: p.utama,
          }}
        >
          {ikon}
        </span>
      ) : null}
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ ...gayaTeks("badan", { bobot: "sedang", warna: p.teks }) }}>{judul}</span>
        {keterangan ? (
          <span style={{ ...gayaTeks("kecil", { warna: p.teksLembut }) }}>{keterangan}</span>
        ) : null}
      </span>
      {ujung}
    </>
  );
  const gaya: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: spasi.md,
    width: "100%",
    minHeight: sentuh.minimum,
    paddingBlock: spasi.md,
    paddingInline: spasi.lg,
    textAlign: "start",
    background: terpilih ? p.permukaanTinggi : p.permukaan,
    border: "none",
    borderBlockEnd: `1px solid ${p.garis}`,
    color: p.teks,
    cursor: onClick ? "pointer" : "default",
    font: "inherit",
  };
  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={gaya}>
        {isi}
      </button>
    );
  }
  return <div style={gaya}>{isi}</div>;
}

/** Lencana status: satu kata keadaan, bukan kalimat. */
export function LencanaStatus({
  children,
  jenis = "netral",
}: {
  children: ReactNode;
  jenis?: "netral" | "sukses" | "peringatan" | "bahaya" | "info";
}) {
  const p = usePalet();
  const warna =
    jenis === "sukses"
      ? p.sukses
      : jenis === "peringatan"
        ? p.peringatan
        : jenis === "bahaya"
          ? p.bahaya
          : jenis === "info"
            ? p.info
            : p.teksLembut;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spasi.xs,
        paddingInline: spasi.sm,
        paddingBlock: 2,
        borderRadius: radius.penuh,
        border: `1px solid ${warna}`,
        color: warna,
        background: "transparent",
        ...gayaLabel(warna),
      }}
    >
      {children}
    </span>
  );
}

/** Kolom isian. `mono` untuk angka, koordinat, dan nama berkas. */
export function Bidang({
  label,
  nilai,
  satuan,
  mono = false,
  children,
}: {
  label: string;
  nilai?: string;
  satuan?: string;
  mono?: boolean;
  children?: ReactNode;
}) {
  const p = usePalet();
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: spasi.xs, width: "100%" }}>
      <span style={gayaLabel(p.teksLembut)}>{label}</span>
      {children ?? (
        <span
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: spasi.xs,
            minHeight: sentuh.minimum,
            paddingInline: spasi.md,
            paddingBlock: spasi.sm,
            borderRadius: radius.md,
            border: `1px solid ${p.garis}`,
            background: p.permukaan,
            ...gayaTeks("badanBesar", { warna: p.teks, mono }),
          }}
        >
          <span style={{ flex: 1 }}>{nilai ?? "—"}</span>
          {satuan ? (
            <span style={{ ...gayaTeks("kecil", { warna: p.teksLembut }) }}>{satuan}</span>
          ) : null}
        </span>
      )}
    </label>
  );
}

/** Pemisah tipis antar kelompok di dalam kartu. */
export function Pemisah() {
  const p = usePalet();
  return <hr style={{ border: "none", borderBlockStart: `1px solid ${p.garis}`, margin: `${spasi.sm}px 0` }} />;
}

/**
 * Bilah kemajuan yang tidak bergantung pada animasi untuk terbaca.
 *
 * `label` wajib: bilah yang sama dipakai untuk unduhan, penyimpanan, dan mutu
 * georeferensi, jadi pembaca layar harus tahu apa yang sedang diukur.
 */
export function BilahKemajuan({ nilai, label }: { nilai: number; label: string }) {
  const p = usePalet();
  const persen = Math.max(0, Math.min(100, Math.round(nilai)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={persen}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ height: 8, borderRadius: radius.penuh, background: p.permukaanTinggi, overflow: "hidden" }}
    >
      <div style={{ width: `${persen}%`, height: "100%", background: p.utama }} />
    </div>
  );
}

/** Kerangka memuat. Barisnya meniru bentuk isi, bukan kotak acak. */
export function Kerangka({ baris = 3, lebar = ["100%", "86%", "64%"] }: { baris?: number; lebar?: string[] }) {
  const p = usePalet();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spasi.sm }} aria-hidden="true">
      {Array.from({ length: baris }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 12,
            width: lebar[i % lebar.length],
            borderRadius: radius.penuh,
            background: p.permukaanTinggi,
          }}
        />
      ))}
    </div>
  );
}

/** Spinner dengan teks; putaran dimatikan bila pengguna meminta gerak minimum. */
export function Berputar({ label }: { label?: string }) {
  const p = usePalet();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: spasi.sm, color: p.teksLembut }}>
      <LoaderCircle
        size={sentuh.ikon}
        aria-hidden="true"
        style={{ animation: `putar ${gerak.lambat * 3}ms linear infinite` }}
      />
      {label ? <span style={gayaTeks("kecil", { warna: p.teksLembut })}>{label}</span> : null}
    </span>
  );
}

/**
 * Bingkai layar: satu-satunya tempat lebar, tinggi, dan latar layar ditentukan.
 * Galeri memakainya untuk menggambar komposisi di 360 dan 412 tanpa komposisi
 * perlu tahu ukurannya sendiri.
 */
export function Layar({
  lebar,
  tinggi,
  children,
  arah = "ltr",
  nama,
}: {
  lebar: number;
  tinggi: number;
  children: ReactNode;
  /** Arah tulis. `rtl` dipakai untuk membuktikan properti logis benar. */
  arah?: "ltr" | "rtl";
  nama?: string;
}) {
  const p = usePalet();
  return (
    <div
      dir={arah}
      aria-label={nama}
      style={{
        width: lebar,
        height: tinggi,
        display: "flex",
        flexDirection: "column",
        background: p.latar,
        color: p.teks,
        fontFamily: tipografi.keluarga.sans,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {children}
      {/* Penanda rumah: krome perangkat yang mengunci dasar layar. Tanpa ini,
          layar yang isinya pendek terlihat seperti gambar yang terpotong. */}
      <div aria-hidden="true" style={{ display: "flex", justifyContent: "center", paddingBlock: spasi.xs }}>
        <span
          style={{
            width: 108,
            height: 4,
            borderRadius: 999,
            background: p.garis,
            opacity: 0.9,
          }}
        />
      </div>
    </div>
  );
}

/** Isi layar yang bisa digulir. Padding sisi dari `ruangAman`, bukan angka bebas. */
export function Isi({ children, gap = spasi.md }: { children: ReactNode; gap?: number }) {
  const p = usePalet();
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap,
        paddingInline: ruangAman.sisi,
        paddingBlock: spasi.md,
        background: p.latar,
      }}
    >
      {children}
    </div>
  );
}

/** Wilayah peta: kanvas datar berwarna token, tempat lapisan dan penanda digambar. */
export function Peta({ children, tinggi }: { children?: ReactNode; tinggi?: number }) {
  const p = usePalet();
  return (
    <div
      style={{
        position: "relative",
        flex: tinggi ? undefined : 1,
        height: tinggi,
        minHeight: 160,
        background: p.petaLahan,
        overflow: "hidden",
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 360 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="360" height="260" fill={p.petaLahan} />
        <path d="M0 176 Q90 150 176 186 T360 170 L360 260 L0 260 Z" fill={p.petaAir} opacity="0.9" />
        <path d="M-10 92 L120 84 L210 118 L372 104" stroke={p.petaJalan} strokeWidth="10" fill="none" />
        <path d="M64 -10 L86 92 L70 200 L96 272" stroke={p.petaJalan} strokeWidth="6" fill="none" />
      </svg>
      {children}
    </div>
  );
}
