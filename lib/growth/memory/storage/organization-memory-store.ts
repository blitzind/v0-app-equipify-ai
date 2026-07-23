/** GE-AIOS-12A / GE-AIOS-17B — Organizational memory persistence. Delegates to @fuzor/memory. */

export {
  mergePlatformOrganizationalMemoryStore as mergeOrganizationalMemoryStore,
  readPlatformOrganizationalMemoryStore as readOrganizationalMemoryStore,
  resolvePersistedPlatformOrganizationalMemoryStore as resolvePersistedOrganizationalMemoryStore,
  writePlatformOrganizationalMemoryStore as writeOrganizationalMemoryStore,
} from "@fuzor/memory"
