"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { ensureOrganizationEquipmentTypesIfEmptyAction } from "@/app/actions/organization-equipment-types"
import {
  type EquipmentType,
  mapEquipmentTypeRows,
  type OrganizationEquipmentTypeRow,
  equipmentCategorySelectOptions,
} from "@/lib/organization-equipment-types"

export type { EquipmentType }
export { equipmentCategorySelectOptions }

type Action =
  | { type: "ADD"; payload: Omit<EquipmentType, "id" | "usageCount" | "isDefault"> }
  | { type: "UPDATE"; payload: { id: string } & Partial<Omit<EquipmentType, "id">> }
  | { type: "DELETE"; payload: { id: string } }

interface EquipmentTypeContextValue {
  types: EquipmentType[]
  loading: boolean
  error: string | null
  dispatch: (action: Action) => Promise<void>
  refresh: () => Promise<void>
}

const EquipmentTypeContext = createContext<EquipmentTypeContextValue | null>(null)

function debugEquipmentTypes(details: Record<string, unknown>) {
  if (process.env.NEXT_PUBLIC_DEBUG_NAV !== "true") return
  const prod = process.env.NODE_ENV === "production"
  const payload = prod
    ? {
        ...details,
        organizationId: undefined,
        organizationHint:
          typeof details.organizationId === "string" && (details.organizationId as string).length > 8
            ? `…${(details.organizationId as string).slice(-6)}`
            : undefined,
      }
    : details
  console.info("[equipify:equipment-types]", payload)
}

export function EquipmentTypeProvider({ children }: { children: ReactNode }) {
  const { organizationId, status, supportAccessActive } = useActiveOrganization()
  const orgReady = status === "ready"
  const [types, setTypes] = useState<EquipmentType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ensureAttemptedForOrgRef = useRef<string | null>(null)
  const typesSnapshotRef = useRef<EquipmentType[]>([])

  useEffect(() => {
    ensureAttemptedForOrgRef.current = null
  }, [organizationId])

  const load = useCallback(async () => {
    if (!organizationId) {
      setTypes([])
      setError(null)
      setLoading(false)
      typesSnapshotRef.current = []
      ensureAttemptedForOrgRef.current = null
      return
    }

    if (!orgReady) {
      debugEquipmentTypes({
        event: "skip_load_org_not_ready",
        organizationId,
        supportAccessActive,
        orgStatus: status,
      })
      return
    }

    setLoading(true)
    setError(null)
    const supabase = createBrowserSupabaseClient()
    try {
      const { data: rows, error: qErr } = await supabase
        .from("organization_equipment_types")
        .select("*")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })

      if (qErr) throw new Error(qErr.message)

      let list = (rows ?? []) as OrganizationEquipmentTypeRow[]

      if (list.length === 0 && ensureAttemptedForOrgRef.current !== organizationId) {
        ensureAttemptedForOrgRef.current = organizationId
        const res = await ensureOrganizationEquipmentTypesIfEmptyAction(organizationId)
        if (!res.ok && res.message) {
          setError(res.message)
          debugEquipmentTypes({
            event: "ensure_if_empty_failed",
            organizationId,
            supportAccessActive,
            reason: res.message,
          })
        }
        if (res.seeded) {
          const { data: again, error: aErr } = await supabase
            .from("organization_equipment_types")
            .select("*")
            .eq("organization_id", organizationId)
            .is("archived_at", null)
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true })
          if (aErr) throw new Error(aErr.message)
          list = (again ?? []) as OrganizationEquipmentTypeRow[]
        }
      }

      const { data: eq, error: eErr } = await supabase
        .from("equipment")
        .select("category")
        .eq("organization_id", organizationId)
        .is("archived_at", null)

      const usage = new Map<string, number>()
      if (eErr) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[equipment-type-store] usage counts skipped:", eErr.message)
        }
      } else {
        for (const row of eq ?? []) {
          const c = (row as { category?: string | null }).category?.trim()
          if (!c) continue
          usage.set(c, (usage.get(c) ?? 0) + 1)
        }
      }

      const mapped = mapEquipmentTypeRows(list, usage)
      setError(null)
      setTypes(mapped)
      typesSnapshotRef.current = mapped
      debugEquipmentTypes({
        event: "load_ok",
        organizationId,
        supportAccessActive,
        typeCount: mapped.length,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load equipment types"
      let friendly = msg
      if (
        msg.includes("You do not have access to this organization.") ||
        /permission denied|rls|not authorized/i.test(msg)
      ) {
        try {
          const r = await fetch("/api/platform/support-session", { cache: "no-store" })
          const d = (await r.json()) as { active?: boolean }
          if (!d.active && supportAccessActive) {
            friendly =
              "Support session expired or ended. Return to Platform Admin and use Login as again to open this workspace."
          }
        } catch {
          /* ignore */
        }
      }
      setError(friendly)
      debugEquipmentTypes({
        event: "load_error",
        organizationId,
        supportAccessActive,
        reason: msg,
      })
      if (typesSnapshotRef.current.length > 0) {
        setTypes(typesSnapshotRef.current)
      } else {
        setTypes([])
      }
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady, status, supportAccessActive])

  useEffect(() => {
    void load()
  }, [load])

  const refresh = useCallback(async () => {
    await load()
  }, [load])

  const dispatch = useCallback(
    async (action: Action) => {
      if (!organizationId || !orgReady) return
      const supabase = createBrowserSupabaseClient()
      setError(null)
      try {
        switch (action.type) {
          case "ADD": {
            const { error: insErr } = await supabase.from("organization_equipment_types").insert({
              organization_id: organizationId,
              name: action.payload.name,
              description: action.payload.description,
              color: action.payload.color,
              icon: action.payload.icon,
              sort_order: 9000,
              is_seed: false,
              seed_key: null,
            })
            if (insErr) throw new Error(insErr.message)
            break
          }
          case "UPDATE": {
            const { id, ...rest } = action.payload
            const updatePayload: Record<string, unknown> = {}
            if (rest.name !== undefined) updatePayload.name = rest.name
            if (rest.description !== undefined) updatePayload.description = rest.description
            if (rest.color !== undefined) updatePayload.color = rest.color
            if (rest.icon !== undefined) updatePayload.icon = rest.icon
            const { error: uErr } = await supabase
              .from("organization_equipment_types")
              .update(updatePayload)
              .eq("id", id)
              .eq("organization_id", organizationId)
            if (uErr) throw new Error(uErr.message)
            break
          }
          case "DELETE": {
            const { error: dErr } = await supabase
              .from("organization_equipment_types")
              .update({ archived_at: new Date().toISOString() })
              .eq("id", action.payload.id)
              .eq("organization_id", organizationId)
              .eq("is_seed", false)
            if (dErr) throw new Error(dErr.message)
            break
          }
          default:
            break
        }
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed")
      }
    },
    [organizationId, orgReady, load],
  )

  const value = useMemo(
    () => ({ types, loading, error, dispatch, refresh }),
    [types, loading, error, dispatch, refresh],
  )

  return <EquipmentTypeContext.Provider value={value}>{children}</EquipmentTypeContext.Provider>
}

export function useEquipmentTypes() {
  const ctx = useContext(EquipmentTypeContext)
  if (!ctx) throw new Error("useEquipmentTypes must be used inside EquipmentTypeProvider")
  return ctx
}

export const ICON_OPTIONS = [
  "Thermometer",
  "Snowflake",
  "Zap",
  "Droplets",
  "UtensilsCrossed",
  "Flame",
  "CircuitBoard",
  "ArrowUpDown",
  "Wrench",
  "Settings",
  "Wind",
  "Gauge",
  "Lightbulb",
  "Radio",
  "Cpu",
  "Server",
  "ShieldCheck",
  "AlertTriangle",
  "Power",
  "PcCase",
] as const

export type IconName = (typeof ICON_OPTIONS)[number]

export const COLOR_PRESETS = [
  "#2563eb",
  "#0891b2",
  "#0f766e",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#ea580c",
  "#7c3aed",
  "#db2777",
  "#475569",
]
