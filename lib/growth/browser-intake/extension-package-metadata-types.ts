/** Growth Browser Extension package metadata — client-safe. */

export const GROWTH_BROWSER_EXTENSION_PACKAGE_METADATA_FILENAME = "package-metadata.json" as const

export const GROWTH_BROWSER_EXTENSION_PACKAGE_METADATA_PUBLIC_FILENAME =
  "equipify-sales-package-metadata.json" as const

export const GROWTH_BROWSER_EXTENSION_PACKAGE_METADATA_DOWNLOAD_PATH =
  `/downloads/${GROWTH_BROWSER_EXTENSION_PACKAGE_METADATA_PUBLIC_FILENAME}` as const

export type GrowthBrowserExtensionPackageMetadata = {
  extension_version: string
  generated_at: string
  git_sha: string | null
}

export function formatGrowthBrowserExtensionPackageMetadata(
  metadata: GrowthBrowserExtensionPackageMetadata,
): string {
  const parts = [`v${metadata.extension_version}`]
  if (metadata.generated_at) {
    const when = new Date(metadata.generated_at)
    if (!Number.isNaN(when.getTime())) {
      parts.push(`packaged ${when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`)
    }
  }
  if (metadata.git_sha) parts.push(metadata.git_sha)
  return parts.join(" · ")
}
