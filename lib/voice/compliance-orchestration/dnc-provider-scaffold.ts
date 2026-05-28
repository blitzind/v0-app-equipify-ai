/** External DNC provider scaffold — Phase 4C. No paid provider integration yet. */

export type VoiceDncProviderLookupResult = {
  listed: boolean | null
  source: string
  evidenceText: string
}

export type VoiceDncProvider = {
  id: string
  label: string
  lookup: (phoneNumber: string) => Promise<VoiceDncProviderLookupResult>
}

export const stubDncProvider: VoiceDncProvider = {
  id: "internal_registry_only",
  label: "Internal registry only",
  async lookup() {
    return {
      listed: null,
      source: "internal_registry_only",
      evidenceText: "External DNC providers not integrated — use organization DNC registry.",
    }
  },
}

export function resolveDncProvider(): VoiceDncProvider {
  return stubDncProvider
}
