/**
 * Brief in-memory cache for Growth Engine lookup/context requests.
 */
;(function initEquipifyGrowthExtensionLookupCache() {
  const TTL_MS = 45_000
  const cache = new Map()

  function buildKey(prefix, params) {
    const serialized = params instanceof URLSearchParams ? params.toString() : String(params ?? "")
    return `${prefix}:${serialized}`
  }

  function read(key, now = Date.now()) {
    const entry = cache.get(key)
    if (!entry) return null
    if (entry.expires_at <= now) {
      cache.delete(key)
      return null
    }
    return entry.value
  }

  function write(key, value, ttlMs = TTL_MS, now = Date.now()) {
    cache.set(key, { key, value, expires_at: now + ttlMs })
  }

  function invalidate(prefix) {
    if (!prefix) {
      cache.clear()
      return
    }
    for (const key of cache.keys()) {
      if (key.startsWith(`${prefix}:`)) cache.delete(key)
    }
  }

  window.EquipifyGrowthExtensionLookupCache = {
    TTL_MS,
    PREFIX: {
      crmContext: "crm_context",
      lookup: "lookup",
    },
    buildKey,
    read,
    write,
    invalidate,
  }
})()
