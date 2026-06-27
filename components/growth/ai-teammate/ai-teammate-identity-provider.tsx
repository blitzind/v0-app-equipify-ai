"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  fetchAiTeammateIdentity,
  patchAiTeammateIdentity,
} from "@/lib/growth/settings/growth-ai-teammate-identity-client"
import { GE_AI_UX_3B_QA_MARKER } from "@/lib/growth/settings/growth-ai-teammate-identity-types"
import {
  AI_TEAMMATE_DEFAULT_NAME,
  GE_AI_UX_3A_QA_MARKER,
  isValidAiTeammateName,
  normalizeAiTeammateName,
  readAiTeammateStoredIdentity,
  resolveAiTeammatePresentation,
  writeAiTeammateStoredIdentity,
  type AiTeammatePresentation,
} from "@/lib/workspace/ai-teammate-identity"

type AiTeammateIdentityContextValue = {
  teammate: AiTeammatePresentation
  onboardingCompleted: boolean
  onboardingOpen: boolean
  loading: boolean
  saving: boolean
  error: string | null
  serverPersisted: boolean
  setTeammateName: (name: string) => Promise<boolean>
  completeOnboarding: (name?: string) => Promise<void>
  openOnboarding: () => void
  closeOnboarding: () => void
}

const AiTeammateIdentityContext = createContext<AiTeammateIdentityContextValue | null>(null)

function applyLocalCache(name: string, onboardingCompleted: boolean) {
  writeAiTeammateStoredIdentity({ name, onboardingCompleted })
}

export function AiTeammateIdentityProvider({ children }: { children: ReactNode }) {
  const [storedName, setStoredName] = useState(AI_TEAMMATE_DEFAULT_NAME)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverPersisted, setServerPersisted] = useState(false)

  useEffect(() => {
    const local = readAiTeammateStoredIdentity()
    setStoredName(local.name)
    setOnboardingCompleted(local.onboardingCompleted)
    setOnboardingOpen(!local.onboardingCompleted)

    void (async () => {
      const server = await fetchAiTeammateIdentity()
      if (server) {
        setStoredName(server.name)
        setOnboardingCompleted(server.onboardingCompleted)
        setOnboardingOpen(!server.onboardingCompleted)
        setServerPersisted(server.source === "organization" || server.onboardingCompleted)
        applyLocalCache(server.name, server.onboardingCompleted)
      }
      setHydrated(true)
      setLoading(false)
    })()
  }, [])

  const teammate = useMemo(() => resolveAiTeammatePresentation(storedName), [storedName])

  const persistLocal = useCallback((name: string, completed: boolean) => {
    applyLocalCache(name, completed)
    setStoredName(name)
    setOnboardingCompleted(completed)
  }, [])

  const setTeammateName = useCallback(
    async (raw: string) => {
      const normalized = normalizeAiTeammateName(raw)
      if (!isValidAiTeammateName(normalized)) return false

      const previousName = storedName
      persistLocal(normalized, onboardingCompleted)
      setSaving(true)
      setError(null)

      const { identity, error: saveError } = await patchAiTeammateIdentity({ name: normalized })
      setSaving(false)

      if (identity) {
        persistLocal(identity.name, identity.onboardingCompleted)
        setServerPersisted(identity.source === "organization" || identity.onboardingCompleted)
        return true
      }

      persistLocal(previousName, onboardingCompleted)
      setError(saveError ?? "Could not save AI teammate name.")
      return false
    },
    [onboardingCompleted, persistLocal, storedName],
  )

  const completeOnboarding = useCallback(
    async (name?: string) => {
      const normalized = name ? normalizeAiTeammateName(name) : storedName
      const resolved = isValidAiTeammateName(normalized) ? normalized : AI_TEAMMATE_DEFAULT_NAME

      persistLocal(resolved, true)
      setOnboardingOpen(false)
      setSaving(true)
      setError(null)

      const { identity, error: saveError } = await patchAiTeammateIdentity({
        name: resolved,
        onboardingCompleted: true,
      })
      setSaving(false)

      if (identity) {
        persistLocal(identity.name, identity.onboardingCompleted)
        setServerPersisted(true)
        return
      }

      setError(saveError ?? "Could not save onboarding progress.")
    },
    [persistLocal, storedName],
  )

  const value = useMemo(
    (): AiTeammateIdentityContextValue => ({
      teammate,
      onboardingCompleted,
      onboardingOpen: hydrated && onboardingOpen,
      loading,
      saving,
      error,
      serverPersisted,
      setTeammateName,
      completeOnboarding,
      openOnboarding: () => setOnboardingOpen(true),
      closeOnboarding: () => setOnboardingOpen(false),
    }),
    [
      teammate,
      onboardingCompleted,
      hydrated,
      onboardingOpen,
      loading,
      saving,
      error,
      serverPersisted,
      setTeammateName,
      completeOnboarding,
    ],
  )

  return (
    <AiTeammateIdentityContext.Provider value={value}>
      <div data-qa-marker={GE_AI_UX_3A_QA_MARKER} data-ai-teammate-server-marker={GE_AI_UX_3B_QA_MARKER}>
        {children}
      </div>
    </AiTeammateIdentityContext.Provider>
  )
}

export function useAiTeammateIdentity(): AiTeammateIdentityContextValue {
  const ctx = useContext(AiTeammateIdentityContext)
  if (!ctx) {
    return {
      teammate: resolveAiTeammatePresentation(AI_TEAMMATE_DEFAULT_NAME),
      onboardingCompleted: true,
      onboardingOpen: false,
      loading: false,
      saving: false,
      error: null,
      serverPersisted: false,
      setTeammateName: async () => false,
      completeOnboarding: async () => {},
      openOnboarding: () => {},
      closeOnboarding: () => {},
    }
  }
  return ctx
}
