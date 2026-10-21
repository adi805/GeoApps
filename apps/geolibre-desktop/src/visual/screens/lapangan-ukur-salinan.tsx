/**
 * Bagian salin koordinat: format, teks tiap format, dan riwayatnya.
 *
 * Keempat format sengaja tampil sekaligus. Satu baris saja menyisakan pita
 * kosong seperempat layar di atas bilah aksi, dan justru inilah alasan format
 * dipilih: teks tiap format berbeda.
 */

import { History } from "lucide-react";
import { BarisDaftar, Chip, LabelSeksi, LencanaStatus, gayaTeks, usePalet } from "../primitives";
import { radius, ruangAman, sentuh, spasi } from "../tokens";

/** Format yang bisa dipilih, urutannya mengikuti baris chip. */
const format = ["Desimal", "DMS", "UTM", "GeoJSON"];

/**
 * Teks tiap format untuk titik yang sama. Zona UTM-nya 48M, karena 107,6 BT
 * masuk zona 48 (102-108 BT).
 */
export const TEKS_SALINAN = [
    { format: "Desimal", teks: "-6.914352, 107.609118", aktif: true },
    { format: "DMS", teks: "6° 54′ 51,7″ S, 107° 36′ 32,8″ E", aktif: false },
    { format: "UTM", teks: "48M 285412 9235418", aktif: false },
    { format: "GeoJSON", teks: "[-6.914352, 107.609118]", aktif: false },
  ];

/** Format, teks, dan riwayat salinan; dipakai keadaan utama dan offline. */
export function IsiSalinan() {
  const p = usePalet();
  return (
    <>
      <LabelSeksi>Format salinan</LabelSeksi>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: spasi.sm,
          paddingInline: ruangAman.sisi,
          paddingBlock: spasi.md,
        }}
      >
        {format.map((f) => (
          <Chip key={f} terpilih={f === "Desimal"}>
            {f}
          </Chip>
        ))}
      </div>
      <LabelSeksi>Teks yang disalin</LabelSeksi>
      {/* Keempat format ditampilkan sekaligus, yang terpilih ditebalkan. Satu
          baris saja menyisakan pita kosong seperempat layar di atas bilah aksi,
          dan justru inilah alasan format dipilih: teks tiap format berbeda. */}
      <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.md }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: p.permukaanTinggi,
            borderRadius: radius.md,
            overflow: "hidden",
          }}
        >
          {TEKS_SALINAN.map((t, i) => (
            <div
              key={t.format}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: spasi.sm,
                paddingInline: spasi.md,
                paddingBlock: spasi.sm,
                background: t.aktif ? p.permukaan : undefined,
                borderBlockStart: i === 0 ? undefined : `1px solid ${p.garis}`,
              }}
            >
              <span style={{ ...gayaTeks("mikro", { bobot: "tebal", warna: p.teksLembut }), minWidth: 64 }}>
                {t.format}
              </span>
              <code
                style={{
                  ...gayaTeks("kecil", { mono: true, warna: t.aktif ? p.teks : p.teksLembut }),
                  overflowWrap: "anywhere",
                }}
              >
                {t.teks}
              </code>
            </div>
          ))}
        </div>
      </div>
      <LabelSeksi>Riwayat salinan</LabelSeksi>
      <BarisDaftar
        ikon={<History size={sentuh.ikon} />}
        judul="Desimal"
        keterangan="Hari ini 08:14 · ke Google Maps"
        ujung={<LencanaStatus jenis="info">2×</LencanaStatus>}
      />
      <BarisDaftar
        ikon={<History size={sentuh.ikon} />}
        judul="DMS"
        keterangan="18 Okt 15:02 · ke pesan WhatsApp"
        ujung={<LencanaStatus jenis="netral">1×</LencanaStatus>}
      />
      <BarisDaftar
        ikon={<History size={sentuh.ikon} />}
        judul="UTM"
        keterangan="18 Okt 09:20 · ke lembar koordinat tim"
        ujung={<LencanaStatus jenis="netral">1×</LencanaStatus>}
      />
      <BarisDaftar
        ikon={<History size={sentuh.ikon} />}
        judul="GeoJSON"
        keterangan="17 Okt 09:41 · ke QGIS"
        ujung={<LencanaStatus jenis="netral">1×</LencanaStatus>}
      />
    </>
  );
}
