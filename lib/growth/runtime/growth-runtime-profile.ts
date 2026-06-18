/**
 * Growth Engine runtime profile selectors (Phase 8G).
 *
 * Profiles describe how registry tiers should behave once enforcement is wired (Phase 8H+).
 * **Phase 8G default:** profile resolution only — no gating side effects.
 */

import type { GrowthFeatureKey, GrowthFeatureMode, GrowthFeatureTier } from "@/lib/growth/runtime/growth-feature-registry"
import { GROWTH_FEATURE_REGISTRY, GROWTH_FEATURE_KEYS } from "@/lib/growth/runtime/growth-feature-registry"

export const GROWTH_RUNTIME_PROFILE_VERSION = "8nc.1" as const

export type GrowthRuntimeProfileId =
  | "operator_minimal"
  | "full_admin"
  | "development_all"

export type GrowthRuntimeProfileTierPolicy = {
  /** Whether features at this tier participate in the default operator surface. */
  visible: boolean
  /** Whether background work (polling, cron, prefetch) should run for this tier. */
  backgroundActive: boolean
  /** How lazy_on_demand features behave under this profile. */
  lazyLoad: "never" | "on_demand" | "eager"
}

export type GrowthRuntimeProfile = {
  readonly id: GrowthRuntimeProfileId
  readonly label: string
  readonly description: string
  readonly tierPolicy: Readonly<Record<GrowthFeatureTier, GrowthRuntimeProfileTierPolicy>>
  /** Explicit feature overrides for profiles that diverge from tier defaults. */
  readonly featureOverrides?: Partial<Record<GrowthFeatureKey, { enabled?: boolean; mode?: GrowthFeatureMode }>>
}

export const GROWTH_RUNTIME_PROFILES: Readonly<Record<GrowthRuntimeProfileId, GrowthRuntimeProfile>> = {
  operator_minimal: {
    id: "operator_minimal",
    label: "Operator minimal",
    description:
      "Production default — core outbound workflow only; cold features hidden; analytics and playbooks load on demand.",
    tierPolicy: {
      1: { visible: true, backgroundActive: true, lazyLoad: "eager" },
      2: { visible: false, backgroundActive: false, lazyLoad: "never" },
      3: { visible: true, backgroundActive: false, lazyLoad: "on_demand" },
    },
  },
  full_admin: {
    id: "full_admin",
    label: "Full admin",
    description:
      "Platform admin surface — Tier 2 diagnostics visible to admins but remain disabled until explicitly re-enabled.",
    tierPolicy: {
      1: { visible: true, backgroundActive: true, lazyLoad: "eager" },
      2: { visible: true, backgroundActive: false, lazyLoad: "never" },
      3: { visible: true, backgroundActive: false, lazyLoad: "on_demand" },
    },
  },
  development_all: {
    id: "development_all",
    label: "Development all",
    description: "Non-production — all capabilities reachable for builder QA; mirrors permissive rollout posture.",
    tierPolicy: {
      1: { visible: true, backgroundActive: true, lazyLoad: "eager" },
      2: { visible: true, backgroundActive: true, lazyLoad: "eager" },
      3: { visible: true, backgroundActive: true, lazyLoad: "eager" },
    },
    featureOverrides: Object.fromEntries(
      GROWTH_FEATURE_KEYS.filter((key) => GROWTH_FEATURE_REGISTRY[key].tier === 2).map((key) => [
        key,
        { enabled: true, mode: "active" as const },
      ]),
    ),
  },
} as const

export const GROWTH_RUNTIME_PROFILE_IDS = Object.keys(GROWTH_RUNTIME_PROFILES) as GrowthRuntimeProfileId[]

const PROFILE_ENV = "GROWTH_RUNTIME_PROFILE"

/** Server-only / Node env (not available in browser bundles). */
function readEnv(name: string): string | undefined {
  if (typeof process === "undefined") return undefined
  const value = process.env[name]?.trim()
  return value || undefined
}

/**
 * Client-safe env — Next.js inlines `process.env.NEXT_PUBLIC_*` at build time even when
 * `process` is absent in the browser runtime (Phase 8N-C).
 */
function readNextPublicVercelEnv(): string | undefined {
  const value = process.env.NEXT_PUBLIC_VERCEL_ENV?.trim()
  return value || undefined
}

function readNextPublicGrowthRuntimeProfile(): string | undefined {
  const value = process.env.NEXT_PUBLIC_GROWTH_RUNTIME_PROFILE?.trim()
  return value || undefined
}

function readNodeEnv(): string | undefined {
  const value = process.env.NODE_ENV?.trim()
  return value || undefined
}

function isGrowthProductionEnvironment(): boolean {
  const publicVercel = readNextPublicVercelEnv()
  if (publicVercel === "production" || publicVercel === "preview") return true
  if (publicVercel === "development") return false

  const vercel = readEnv("VERCEL_ENV")
  if (vercel === "production" || vercel === "preview") return true
  if (vercel === "development") return false

  return readNodeEnv() === "production"
}

function parseGrowthRuntimeProfileId(raw: string | undefined): GrowthRuntimeProfileId | null {
  if (!raw) return null
  return (GROWTH_RUNTIME_PROFILE_IDS as readonly string[]).includes(raw) ? (raw as GrowthRuntimeProfileId) : null
}

/**
 * Resolves the active runtime profile.
 * Production (Vercel) defaults to `operator_minimal` unless `GROWTH_RUNTIME_PROFILE` overrides.
 */
export function resolveGrowthRuntimeProfileId(): GrowthRuntimeProfileId {
  const explicit =
    parseGrowthRuntimeProfileId(readEnv(PROFILE_ENV)) ??
    parseGrowthRuntimeProfileId(readNextPublicGrowthRuntimeProfile())
  if (explicit) return explicit
  return isGrowthProductionEnvironment() ? "operator_minimal" : "development_all"
}

export function getGrowthRuntimeProfile(id?: GrowthRuntimeProfileId): GrowthRuntimeProfile {
  return GROWTH_RUNTIME_PROFILES[id ?? resolveGrowthRuntimeProfileId()]
}

export function listGrowthRuntimeProfileIds(): GrowthRuntimeProfileId[] {
  return [...GROWTH_RUNTIME_PROFILE_IDS]
}
