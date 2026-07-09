"use client"

import { useCallback, useEffect, useState } from "react"
import type { BusinessProfileRecord } from "@/lib/growth/business-profile"
import {
  GROWTH_BUSINESS_PROFILE_API_PATH,
  type GrowthBusinessProfileApiResponse,
} from "@/lib/growth/business-profile/business-profile-api-contract"

export function useGrowthTrainingProfileWorkspace() {
  const [loading, setLoading] = useState(true)
  const [activeApproved, setActiveApproved] = useState<BusinessProfileRecord | null>(null)
  const [latestDraft, setLatestDraft] = useState<BusinessProfileRecord | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadWorkspace = useCallback(async () => {
    setError(null)
    const res = await fetch(GROWTH_BUSINESS_PROFILE_API_PATH, { cache: "no-store" })
    const payload = (await res.json()) as GrowthBusinessProfileApiResponse
    if (!res.ok || !payload.ok) {
      throw new Error(payload.message ?? "Could not load Company Profile.")
    }
    setActiveApproved(payload.activeApproved ?? null)
    setLatestDraft(payload.latestDraft ?? null)
  }, [])

  useEffect(() => {
    void loadWorkspace()
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Could not load Company Profile.")
      })
      .finally(() => setLoading(false))
  }, [loadWorkspace])

  return {
    loading,
    activeApproved,
    latestDraft,
    error,
    reload: async () => {
      setLoading(true)
      try {
        await loadWorkspace()
      } finally {
        setLoading(false)
      }
    },
    setActiveApproved,
    setLatestDraft,
  }
}

function profileApiPath(profileId: string, action?: "approve" | "reject"): string {
  if (action === "approve") return `${GROWTH_BUSINESS_PROFILE_API_PATH}/${profileId}/approve`
  if (action === "reject") return `${GROWTH_BUSINESS_PROFILE_API_PATH}/${profileId}/reject`
  return `${GROWTH_BUSINESS_PROFILE_API_PATH}/${profileId}`
}

export async function ensureBusinessProfileDraftFromApproved(
  approved: BusinessProfileRecord,
): Promise<BusinessProfileRecord> {
  const res = await fetch(`${GROWTH_BUSINESS_PROFILE_API_PATH}/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyName: approved.companyName,
      website: approved.website,
      notes: approved.input.notes ?? null,
      whatTheySell: approved.input.whatTheySell ?? null,
      whoTheySellTo: approved.input.whoTheySellTo ?? null,
      geography: approved.input.geography ?? null,
      averageDealSize: approved.input.averageDealSize ?? null,
    }),
  })
  const payload = (await res.json()) as GrowthBusinessProfileApiResponse
  if (!res.ok || !payload.ok || !payload.profile) {
    throw new Error(payload.message ?? "Could not start a profile update.")
  }

  const mergedProfile = {
    ...approved.profile,
    businessStrategy: approved.profile.businessStrategy,
  }

  const saveRes = await fetch(profileApiPath(payload.profile.id), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile: mergedProfile }),
  })
  const savePayload = (await saveRes.json()) as GrowthBusinessProfileApiResponse
  if (!saveRes.ok || !savePayload.ok || !savePayload.profile) {
    throw new Error(savePayload.message ?? "Could not preserve your approved profile while updating strategy.")
  }

  return savePayload.profile
}

export { profileApiPath }
