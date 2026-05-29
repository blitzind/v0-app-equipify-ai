/**
 * Installed vs packaged vs latest extension version resolution.
 */
;(function initEquipifyGrowthExtensionVersion() {
  const config = window.EquipifyGrowthExtensionConfig

  function parseSemver(version) {
    const match = String(version ?? "")
      .trim()
      .replace(/^v/i, "")
      .match(/^(\d+)\.(\d+)\.(\d+)/)
    if (!match) return null
    return [Number(match[1]), Number(match[2]), Number(match[3])]
  }

  function compareSemver(left, right) {
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

  function isOutdated(installedVersion, latestVersion) {
    if (!latestVersion?.trim()) return false
    return compareSemver(installedVersion, latestVersion) < 0
  }

  function readInstalledVersion() {
    try {
      return chrome.runtime.getManifest()?.version?.trim() || "0.0.0"
    } catch {
      return "0.0.0"
    }
  }

  async function readPackagedMetadata() {
    try {
      const response = await fetch(chrome.runtime.getURL("package-metadata.json"))
      if (!response.ok) return null
      const metadata = await response.json()
      if (!metadata?.extension_version) return null
      return metadata
    } catch {
      return null
    }
  }

  async function fetchLatestAvailableMetadata(apiBaseUrl) {
    const base = (apiBaseUrl ?? config?.EXTENSION_API_PRESETS?.production ?? "").replace(/\/$/, "")
    if (!base) return null

    const path = config?.PACKAGE_METADATA_DOWNLOAD_PATH ?? "/downloads/equipify-sales-package-metadata.json"
    try {
      const response = await fetch(`${base}${path}`, { method: "GET", cache: "no-store" })
      if (!response.ok) return null
      const metadata = await response.json()
      if (!metadata?.extension_version) return null
      return metadata
    } catch {
      return null
    }
  }

  async function resolveVersionSnapshot(apiBaseUrl) {
    const installedVersion = readInstalledVersion()
    const packagedMetadata = await readPackagedMetadata()
    const latestMetadata = await fetchLatestAvailableMetadata(apiBaseUrl)
    const packagedVersion = packagedMetadata?.extension_version?.trim() || null
    const latestAvailableVersion = latestMetadata?.extension_version?.trim() || packagedVersion
    const gitSha = packagedMetadata?.git_sha ?? latestMetadata?.git_sha ?? null
    const buildTimestamp = packagedMetadata?.generated_at ?? latestMetadata?.generated_at ?? null

    return {
      installed_version: installedVersion,
      packaged_version: packagedVersion,
      latest_available_version: latestAvailableVersion,
      git_sha: gitSha,
      build_timestamp: buildTimestamp,
      is_outdated: isOutdated(installedVersion, latestAvailableVersion),
    }
  }

  function formatSnapshot(snapshot) {
    const parts = [`Installed v${snapshot.installed_version}`]
    if (snapshot.packaged_version) parts.push(`ZIP v${snapshot.packaged_version}`)
    if (snapshot.latest_available_version) parts.push(`Latest v${snapshot.latest_available_version}`)
    if (snapshot.build_timestamp) {
      const when = new Date(snapshot.build_timestamp)
      if (!Number.isNaN(when.getTime())) parts.push(`built ${when.toLocaleString()}`)
    }
    if (snapshot.git_sha) parts.push(snapshot.git_sha)
    return parts.join(" · ")
  }

  window.EquipifyGrowthExtensionVersion = {
    compareSemver,
    isOutdated,
    readInstalledVersion,
    readPackagedMetadata,
    fetchLatestAvailableMetadata,
    resolveVersionSnapshot,
    formatSnapshot,
  }
})()
