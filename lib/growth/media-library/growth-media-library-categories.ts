import type { GrowthMediaLibraryKind } from "@/lib/growth/media-library/growth-media-library-types"

export const GROWTH_MEDIA_LIBRARY_CATEGORY_OPTIONS: Array<{
  value: GrowthMediaLibraryKind | "all"
  label: string
}> = [
  { value: "all", label: "All categories" },
  { value: "logo", label: "Logos" },
  { value: "team", label: "Team Photos" },
  { value: "hero", label: "Hero Images" },
  { value: "image", label: "General Images" },
]

export const GROWTH_MEDIA_LIBRARY_KIND_LABELS: Record<GrowthMediaLibraryKind, string> = {
  logo: "Logos",
  team: "Team Photos",
  hero: "Hero Images",
  image: "General Images",
}

export function growthMediaLibraryKindLabel(kind: GrowthMediaLibraryKind): string {
  return GROWTH_MEDIA_LIBRARY_KIND_LABELS[kind]
}

/** Map picker context to the default upload category. */
export function defaultGrowthMediaLibraryKind(
  acceptedTypes?: GrowthMediaLibraryKind[],
): GrowthMediaLibraryKind {
  if (acceptedTypes?.includes("logo")) return "logo"
  if (acceptedTypes?.includes("hero")) return "hero"
  if (acceptedTypes?.includes("team")) return "team"
  if (acceptedTypes?.includes("image")) return "image"
  return "image"
}
