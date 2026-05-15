"use client"

import {
  EQUIPMENT_SCAN_MAX_BYTES_IMAGE,
  EQUIPMENT_SCAN_MAX_BYTES_PDF,
  EQUIPMENT_SCAN_SAFE_UPLOAD_BYTES,
} from "@/lib/equipment/equipment-scan-upload-validate"

export type PrepareEquipmentScanFileMeta = {
  kind: "pdf" | "image"
  originalBytes: number
  finalBytes: number
  convertedToJpeg: boolean
  compressionSkipped: boolean
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
}

function isLikelyHeic(file: File): boolean {
  const n = file.name.toLowerCase()
  if (n.endsWith(".heic") || n.endsWith(".heif")) return true
  const t = (file.type || "").toLowerCase()
  return t.includes("heic") || t.includes("heif")
}

function loadImageFromObjectUrl(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.decoding = "async"
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("IMAGE_DECODE_FAILED"))
    }
    img.src = url
  })
}

async function decodeToCanvasSource(file: File): Promise<{ source: CanvasImageSource; close?: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file)
      return { source: bitmap, close: () => bitmap.close() }
    } catch {
      /* fall through */
    }
  }
  const img = await loadImageFromObjectUrl(file)
  return { source: img }
}

function jpegBlobFromCanvas(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((res) => {
    canvas.toBlob((b) => res(b), "image/jpeg", quality)
  })
}

async function compressImageFileToJpegUnderLimit(file: File): Promise<File> {
  const { source, close } = await decodeToCanvasSource(file)
  try {
    const w =
      "width" in source && typeof (source as ImageBitmap).width === "number"
        ? (source as ImageBitmap).width
        : (source as HTMLImageElement).naturalWidth
    const h =
      "height" in source && typeof (source as ImageBitmap).height === "number"
        ? (source as ImageBitmap).height
        : (source as HTMLImageElement).naturalHeight
    if (!w || !h) {
      throw new Error("IMAGE_DECODE_FAILED")
    }

    let maxSide = 2400
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("CANVAS_UNSUPPORTED")

    for (let pass = 0; pass < 10; pass++) {
      const scale = Math.min(1, maxSide / Math.max(w, h))
      const tw = Math.max(1, Math.round(w * scale))
      const th = Math.max(1, Math.round(h * scale))
      canvas.width = tw
      canvas.height = th
      ctx.clearRect(0, 0, tw, th)
      ctx.drawImage(source, 0, 0, tw, th)

      for (let q = 0.9; q >= 0.48; q -= 0.06) {
        const blob = await jpegBlobFromCanvas(canvas, q)
        if (blob && blob.size <= EQUIPMENT_SCAN_SAFE_UPLOAD_BYTES) {
          const base = (file.name || "scan").replace(/\.[^/.]+$/, "") || "scan"
          return new File([blob], `${base}.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now(),
          })
        }
      }
      maxSide = Math.max(960, Math.floor(maxSide * 0.82))
    }
    throw new Error("COMPRESS_FAILED")
  } finally {
    close?.()
  }
}

/**
 * Ensures scan uploads stay under typical serverless body limits and reduces
 * memory pressure on mobile Safari (resize + JPEG before Server Action).
 */
export async function prepareFileForEquipmentScanUpload(
  file: File,
): Promise<{ file: File; meta: PrepareEquipmentScanFileMeta }> {
  const originalBytes = file.size

  if (isPdfFile(file)) {
    if (file.size > EQUIPMENT_SCAN_MAX_BYTES_PDF) {
      throw new Error("PDF_TOO_LARGE_APP")
    }
    if (file.size > EQUIPMENT_SCAN_SAFE_UPLOAD_BYTES) {
      throw new Error("PDF_TOO_LARGE_NETWORK")
    }
    return {
      file,
      meta: {
        kind: "pdf",
        originalBytes,
        finalBytes: file.size,
        convertedToJpeg: false,
        compressionSkipped: true,
      },
    }
  }

  if (file.size > EQUIPMENT_SCAN_MAX_BYTES_IMAGE) {
    throw new Error("IMAGE_TOO_LARGE_APP")
  }

  const heic = isLikelyHeic(file)
  const smallRaster =
    file.size <= EQUIPMENT_SCAN_SAFE_UPLOAD_BYTES &&
    !heic &&
    /\.(jpe?g|png|webp)$/i.test(file.name || "") &&
    file.size < 900_000

  if (smallRaster) {
    return {
      file,
      meta: {
        kind: "image",
        originalBytes,
        finalBytes: file.size,
        convertedToJpeg: false,
        compressionSkipped: true,
      },
    }
  }

  if (file.size <= EQUIPMENT_SCAN_SAFE_UPLOAD_BYTES && !heic && /\.gif$/i.test(file.name || "")) {
    return {
      file,
      meta: {
        kind: "image",
        originalBytes,
        finalBytes: file.size,
        convertedToJpeg: false,
        compressionSkipped: true,
      },
    }
  }

  const out = await compressImageFileToJpegUnderLimit(file)
  return {
    file: out,
    meta: {
      kind: "image",
      originalBytes,
      finalBytes: out.size,
      convertedToJpeg: true,
      compressionSkipped: false,
    },
  }
}

export function messageForPrepareError(code: string): string {
  switch (code) {
    case "IMAGE_DECODE_FAILED":
      return "Could not read this image on your device. If it is HEIC, open Photos → export/share as “Most Compatible” (JPEG), or take a new photo as JPEG from the camera app, then try again."
    case "COMPRESS_FAILED":
    case "CANVAS_UNSUPPORTED":
      return "Could not prepare this image for upload (browser limits). Try a smaller photo or a screenshot, then try again."
    case "PDF_TOO_LARGE_APP":
      return "This PDF is too large. Maximum size is 12 MB. Try a smaller export or take photos of the pages instead."
    case "PDF_TOO_LARGE_NETWORK":
      return "This PDF is too large to upload from mobile networks (about 4 MB limit). Compress the PDF on desktop, export fewer pages, or upload clear photos of the nameplate or certificate instead."
    case "IMAGE_TOO_LARGE_APP":
      return "This image is too large. Maximum size is 12 MB. Try a smaller photo."
    default:
      return "Could not prepare this file for upload. Try a different image or PDF."
  }
}
