"""Regenerates tests/fixtures/mini-vector.pmtiles: arsip PMTiles VEKTOR mini.

Kenapa fixture ini terpisah dari `mini.pmtiles`: arsip repo yang lama adalah RASTER
(ubin PNG), sedangkan gaya basemap offline GeoLibre adalah gaya VEKTOR Protomaps.
Kalau probe render memakai arsip raster, peta tetap kosong walau byte-nya benar
sampai ke MapLibre, karena vector source tidak bisa melukis PNG. Arsip di sini
berisi satu poligon `water` yang menutupi seluruh dunia di z0-z4: cukup untuk
membuktikan MVT dari arsip offline benar-benar dilukis.

Butuh python (bukan bagian toolchain Node repo), sekali pasang:

    python3 -m pip install --user pmtiles mapbox-vector-tile shapely

Lalu dari root repo:

    python3 scripts/gen-vector-pmtiles-fixture.py

Catatan: byte hasilnya TIDAK identik antar-run karena `gzip.compress` menyimpan
mtime, jadi yang dijamin sama adalah ISI arsipnya (tile, zoom, metadata), bukan
sha256-nya.
"""

import gzip
import os
import pathlib

import mapbox_vector_tile
from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import Writer
from shapely.geometry import Polygon, mapping

OUT = pathlib.Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "mini-vector.pmtiles"


def tile_mvt(tag):
    poly = Polygon([(0, 0), (4096, 0), (4096, 4096), (0, 4096)])
    # Properti unik per ubin supaya byte tiap ubin berbeda: writer memakai
    # run-length untuk ubin identik, dan ubin yang digabung jadi satu entri
    # membuat header melaporkan zoom 0-0 sehingga pembacaan ubin lain gagal.
    return [{
        "name": "water",
        "features": [{"geometry": poly, "properties": {"tag": tag}}],
    }]


def main() -> None:
    tiles = {}
    for z in range(0, 5):
        n = 2**z
        for x in range(n):
            for y in range(n):
                mvt = mapbox_vector_tile.encode(
                    tile_mvt(f"{z}/{x}/{y}"),
                    default_options={"y_coord_down": True, "extents": 4096},
                )
                tiles[zxy_to_tileid(z, x, y)] = gzip.compress(mvt)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "wb") as f:
        wr = Writer(f)
        for tid in sorted(tiles):
            wr.write_tile(tid, tiles[tid])
        wr.finalize(
            header={
                "tile_type": TileType.MVT,
                "tile_compression": Compression.GZIP,
                "min_zoom": 0,
                "max_zoom": 4,
                "min_lon_e7": int(-180 * 1e7),
                "min_lat_e7": int(-85 * 1e7),
                "max_lon_e7": int(180 * 1e7),
                "max_lat_e7": int(85 * 1e7),
                "center_zoom": 2,
                "center_lon_e7": int(-45.84 * 1e7),
                "center_lat_e7": int(-23.16 * 1e7),
            },
            metadata={
                "name": "mini-vektor",
                "format": "pbf",
                "vector_layers": [{"id": "water", "fields": {}, "minzoom": 0, "maxzoom": 4}],
            },
        )
    print(f"Wrote {OUT} ({os.path.getsize(OUT)} bytes, {len(tiles)} tiles)")


if __name__ == "__main__":
    main()
