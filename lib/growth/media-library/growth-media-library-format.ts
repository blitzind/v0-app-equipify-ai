import type { GrowthMediaLibraryAsset } from "@/lib/growth/media-library/growth-media-library-types"

export function formatGrowthMediaLibraryDimensions(asset: GrowthMediaLibraryAsset): string {
  if (asset.width && asset.height) return `${asset.width} × ${asset.height}`
  return "—"
}

export function formatGrowthMediaLibraryDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

export async function readImageFileDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return null
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}
