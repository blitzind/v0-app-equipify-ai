/** Growth Browser Extension version helpers — client-safe. */

export type GrowthBrowserExtensionVersionSnapshot = {
  installed_version: string
  packaged_version: string | null
  latest_available_version: string | null
  git_sha: string | null
  build_timestamp: string | null
  is_outdated: boolean
}

export function parseSemver(version: string): [number, number, number] | null {
  const match = version.trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function compareSemver(left: string, right: string): number {
  const a = parseSemver(left)
  const b = parseSemver(right)
  if (!a && !b) return 0
  if (!a) return -1
  if (!b) return 1
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return 0
}

export function isGrowthBrowserExtensionOutdated(
  installedVersion: string,
  latestVersion: string | null | undefined,
): boolean {
  if (!latestVersion?.trim()) return false
  return compareSemver(installedVersion, latestVersion) < 0
}

export function formatGrowthBrowserExtensionVersionSnapshot(
  snapshot: GrowthBrowserExtensionVersionSnapshot,
): string {
  const parts = [`Installed v${snapshot.installed_version}`]
  if (snapshot.packaged_version && snapshot.packaged_version !== snapshot.installed_version) {
    parts.push(`ZIP v${snapshot.packaged_version}`)
  }
  if (snapshot.latest_available_version) {
    parts.push(`Latest v${snapshot.latest_available_version}`)
  }
  if (snapshot.build_timestamp) {
    const when = new Date(snapshot.build_timestamp)
    if (!Number.isNaN(when.getTime())) {
      parts.push(
        `built ${when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`,
      )
    }
  }
  if (snapshot.git_sha) parts.push(snapshot.git_sha)
  return parts.join(" · ")
}
