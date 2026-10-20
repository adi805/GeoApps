/**
 * Lima keadaan layar: kosong, memuat, galat, offline, izin-ditolak.
 *
 * Kelimanya primitif, bukan komposisi, supaya bentuknya seragam di seluruh
 * aplikasi. Tiap keadaan menyebut apa yang terjadi, kenapa, dan satu tindakan
 * yang bisa diambil; keadaan tanpa jalan keluar adalah jalan buntu.
 */

import type { ReactNode } from "react";
import { CircleAlert, LoaderCircle, MapPinOff, ShieldAlert, WifiOff } from "lucide-react";
import { gayaTeks, Tombol, usePalet } from "./primitives";
import { radius, sentuh, spasi, tipografi } from "./tokens";

function Bingkai({ children }: { children: ReactNode }) {
  const p = usePalet();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: spasi.md,
        minHeight: 320,
        paddingInline: spasi.xxl,
        paddingBlock: spasi.xxxl,
        textAlign: "center",
        background: p.permukaan,
      }}
    >
      {children}
    </div>
  );
}

function IkonBulat({ children, warna }: { children: ReactNode; warna: string }) {
  const p = usePalet();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 56,
        height: 56,
        borderRadius: radius.penuh,
        background: p.permukaanTinggi,
        color: warna,
      }}
    >
      {children}
    </span>
  );
}

/** Kosong: belum ada isi, tapi bukan kegagalan. Selalu tawarkan langkah pertama. */
export function Kosong({
  judul,
  keterangan,
  aksi,
  ikon,
}: {
  judul: string;
  keterangan: string;
  aksi?: ReactNode;
  ikon?: ReactNode;
}) {
  const p = usePalet();
  return (
    <Bingkai>
      <IkonBulat warna={p.teksLembut}>{ikon ?? <MapPinOff size={28} aria-hidden="true" />}</IkonBulat>
      <h2 style={{ ...gayaTeks("judulKecil", { bobot: "tebal", warna: p.teks }), margin: 0 }}>{judul}</h2>
      <p style={{ ...gayaTeks("badan", { warna: p.teksLembut }), margin: 0, maxWidth: 280 }}>{keterangan}</p>
      {aksi}
    </Bingkai>
  );
}

/** Memuat: sebut apa yang sedang dimuat, jangan hanya berputar. */
export function Memuat({ judul, keterangan }: { judul: string; keterangan: string }) {
  const p = usePalet();
  return (
    <Bingkai>
      <IkonBulat warna={p.utama}>
        <LoaderCircle size={28} aria-hidden="true" style={{ animation: "putar 1200ms linear infinite" }} />
      </IkonBulat>
      <h2 style={{ ...gayaTeks("judulKecil", { bobot: "tebal", warna: p.teks }), margin: 0 }}>{judul}</h2>
      <p style={{ ...gayaTeks("badan", { warna: p.teksLembut }), margin: 0, maxWidth: 280 }}>{keterangan}</p>
      <span style={gayaTeks("kecil", { warna: p.teksLembut, mono: true })} role="status">
        memuat…
      </span>
    </Bingkai>
  );
}

/** Galat: sebab yang bisa dibaca manusia, lalu satu tindakan pemulihan. */
export function Galat({
  judul,
  keterangan,
  rincian,
  aksi,
}: {
  judul: string;
  keterangan: string;
  rincian?: string;
  aksi?: ReactNode;
}) {
  const p = usePalet();
  return (
    <Bingkai>
      <IkonBulat warna={p.bahaya}>
        <CircleAlert size={28} aria-hidden="true" />
      </IkonBulat>
      <h2 style={{ ...gayaTeks("judulKecil", { bobot: "tebal", warna: p.teks }), margin: 0 }}>{judul}</h2>
      <p style={{ ...gayaTeks("badan", { warna: p.teksLembut }), margin: 0, maxWidth: 280 }}>{keterangan}</p>
      {rincian ? (
        <code
          style={{
            display: "block",
            maxWidth: "100%",
            padding: spasi.sm,
            borderRadius: radius.sm,
            background: p.permukaanTinggi,
            color: p.teks,
            fontFamily: tipografi.keluarga.mono,
            fontSize: tipografi.ukuran.kecil,
            textAlign: "start",
            overflowWrap: "anywhere",
          }}
        >
          {rincian}
        </code>
      ) : null}
      {aksi}
    </Bingkai>
  );
}

/** Offline: keadaan normal di lapangan, jadi nadanya tenang, bukan peringatan. */
export function Offline({
  judul = "Tidak ada jaringan",
  keterangan,
  aksi,
}: {
  judul?: string;
  keterangan: string;
  aksi?: ReactNode;
}) {
  const p = usePalet();
  return (
    <Bingkai>
      <IkonBulat warna={p.peringatan}>
        <WifiOff size={28} aria-hidden="true" />
      </IkonBulat>
      <h2 style={{ ...gayaTeks("judulKecil", { bobot: "tebal", warna: p.teks }), margin: 0 }}>{judul}</h2>
      <p style={{ ...gayaTeks("badan", { warna: p.teksLembut }), margin: 0, maxWidth: 280 }}>{keterangan}</p>
      {aksi}
    </Bingkai>
  );
}

/** Izin ditolak: bedakan dari galat, karena pengguna bisa memperbaikinya. */
export function IzinDitolak({
  judul,
  keterangan,
  aksi,
}: {
  judul: string;
  keterangan: string;
  aksi?: ReactNode;
}) {
  const p = usePalet();
  return (
    <Bingkai>
      <IkonBulat warna={p.peringatan}>
        <ShieldAlert size={28} aria-hidden="true" />
      </IkonBulat>
      <h2 style={{ ...gayaTeks("judulKecil", { bobot: "tebal", warna: p.teks }), margin: 0 }}>{judul}</h2>
      <p style={{ ...gayaTeks("badan", { warna: p.teksLembut }), margin: 0, maxWidth: 280 }}>{keterangan}</p>
      {aksi ?? <Tombol varian="sekunder">Buka pengaturan izin</Tombol>}
    </Bingkai>
  );
}

/**
 * Spanduk keadaan: versi ringkas untuk keadaan yang hidup di dalam layar yang
 * masih berfungsi (mis. indikator offline di atas daftar peta).
 */
export function SpandukKeadaan({
  jenis,
  children,
  aksi,
}: {
  jenis: "offline" | "info" | "peringatan" | "bahaya";
  children: ReactNode;
  aksi?: ReactNode;
}) {
  const p = usePalet();
  const warna =
    jenis === "offline" || jenis === "peringatan"
      ? p.peringatan
      : jenis === "bahaya"
        ? p.bahaya
        : p.info;
  const Ikon = jenis === "offline" ? WifiOff : jenis === "bahaya" ? CircleAlert : ShieldAlert;
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: spasi.sm,
        minHeight: sentuh.minimum,
        paddingInline: spasi.md,
        paddingBlock: spasi.sm,
        borderRadius: radius.md,
        border: `1px solid ${warna}`,
        color: warna,
        background: p.permukaan,
      }}
    >
      <Ikon size={sentuh.ikon} aria-hidden="true" />
      <span style={{ ...gayaTeks("kecil", { bobot: "sedang", warna }), flex: 1 }}>{children}</span>
      {aksi}
    </div>
  );
}
