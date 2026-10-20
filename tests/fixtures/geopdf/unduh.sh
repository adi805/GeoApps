#!/bin/sh
# Unduh ulang fixture GeoPDF dari commit yang dipin, lalu verifikasi sha256-nya.
#
# Kenapa commit dipin, bukan cabang: fixture yang berubah di upstream tanpa
# catatan akan membuat uji ini merah atau, lebih buruk, hijau dengan nilai acuan
# yang sudah basi. Commit pin + SHA256SUMS membuat perubahan upstream terlihat
# sebagai kegagalan verifikasi, bukan sebagai kejutan.
#
#   cd tests/fixtures/geopdf && ./unduh.sh
#
# Butuh curl. Tidak butuh git, gdal, atau Python.
set -eu

GDAL_COMMIT=acae266360bc32f08cacab028b83bde308bf6dac
QGIS_COMMIT=0379e5917f7508cbf72ba55f977e90bd1d81f329

cd "$(dirname "$0")"

unduh() {
	url=$1
	keluaran=$2
	printf 'mengunduh %s\n' "$keluaran"
	curl -sSfL -o "$keluaran" "$url"
}

unduh "https://raw.githubusercontent.com/OSGeo/gdal/$GDAL_COMMIT/autotest/gdrivers/data/pdf/adobe_style_geospatial.pdf" esri-arcmap-utm20n.pdf
unduh "https://raw.githubusercontent.com/OSGeo/gdal/$GDAL_COMMIT/autotest/gdrivers/data/pdf/test_ogc_bp.pdf" ogc-lgidict.pdf
unduh "https://raw.githubusercontent.com/OSGeo/gdal/$GDAL_COMMIT/autotest/gdrivers/data/pdf/test_pdf_composition_outline.pdf" tanpa-georeferensi.pdf
unduh "https://raw.githubusercontent.com/qgis/QGIS/$QGIS_COMMIT/tests/testdata/control_images/qgis_server/WMS_GetPrint_Basic_Pdf/WMS_GetPrint_Basic_Pdf.pdf" qgis-3.35-getprint.pdf

if sha256sum -c SHA256SUMS; then
	printf '\nsemua berkas cocok dengan SHA256SUMS\n'
else
	printf '\nverifikasi GAGAL: berkas di upstream berubah atau unduhannya rusak\n' >&2
	exit 1
fi
