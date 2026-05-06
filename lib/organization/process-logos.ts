import "server-only"

import sharp from "sharp"

/** Output size for app sidebar / portal square branding (contain within square, transparent pad). */
const APP_BRAND_PX = 256

/** Max raster size for document logos; aspect ratio preserved, no upscale. */
const DOC_MAX_WIDTH = 1600
const DOC_MAX_HEIGHT = 480

/**
 * Raster/SVG → square PNG with transparent letterboxing, logo centered (contain).
 */
export async function processAppBrandingSquare(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOnError: false })
    .rotate()
    .resize(APP_BRAND_PX, APP_BRAND_PX, {
      fit: "contain",
      position: "center",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/**
 * Downscale wide raster logos for documents; preserves transparency; does not enlarge small assets.
 */
export async function processDocumentLogoRaster(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOnError: false })
    .rotate()
    .resize(DOC_MAX_WIDTH, DOC_MAX_HEIGHT, {
      fit: "inside",
      withoutEnlargement: true,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer()
}
