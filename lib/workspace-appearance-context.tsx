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

const STORAGE_KEY = "equipify_workspace_appearance"

export type WorkspaceAppearancePreference = "light" | "dark" | "system"

type ResolvedWorkspaceTheme = "light" | "dark"

type WorkspaceAppearanceContextValue = {
  preference: WorkspaceAppearancePreference
  setPreference: (p: WorkspaceAppearancePreference) => void
  resolved: ResolvedWorkspaceTheme
  /** Radix portals render here when set so overlays inherit workspace `dark` tokens. */
  portalContainer: HTMLElement | null
  setPortalContainer: (el: HTMLElement | null) => void
}

const WorkspaceAppearanceContext = createContext<WorkspaceAppearanceContextValue | null>(null)

function readStoredPreference(): WorkspaceAppearancePreference {
  if (typeof window === "undefined") return "light"
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)?.trim()
    if (raw === "light" || raw === "dark" || raw === "system") return raw
  } catch {
    /* ignore */
  }
  return "light"
}

function resolveTheme(
  preference: WorkspaceAppearancePreference,
  systemIsDark: boolean,
): ResolvedWorkspaceTheme {
  if (preference === "dark") return "dark"
  if (preference === "light") return "light"
  return systemIsDark ? "dark" : "light"
}

export function WorkspaceAppearanceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<WorkspaceAppearancePreference>("light")
  const [systemDark, setSystemDark] = useState(false)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPreferenceState(readStoredPreference())
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const syncMq = () => setSystemDark(mq.matches)
    syncMq()
    mq.addEventListener("change", syncMq)

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "light" || e.newValue === "dark" || e.newValue === "system")) {
        setPreferenceState(e.newValue)
      }
    }
    const onCustom = () => setPreferenceState(readStoredPreference())
    window.addEventListener("storage", onStorage)
    window.addEventListener("workspace-appearance-change", onCustom as EventListener)

    return () => {
      mq.removeEventListener("change", syncMq)
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("workspace-appearance-change", onCustom as EventListener)
    }
  }, [])

  const setPreference = useCallback((p: WorkspaceAppearancePreference) => {
    setPreferenceState(p)
    try {
      window.localStorage.setItem(STORAGE_KEY, p)
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("workspace-appearance-change"))
  }, [])

  const resolved = useMemo(
    () => resolveTheme(preference, systemDark),
    [preference, systemDark],
  )

  const value = useMemo(
    (): WorkspaceAppearanceContextValue => ({
      preference,
      setPreference,
      resolved,
      portalContainer,
      setPortalContainer,
    }),
    [preference, resolved, setPreference, portalContainer],
  )

  /**
   * Slide-out drawers (`DrawerViewport` → `createPortal(..., document.body)`) must inherit dark tokens.
   * Tailwind `dark:` maps to `@custom-variant dark (&:is(.dark *))` — portaled UI is only themed if `.dark`
   * exists on an ancestor of `document.body`, i.e. `<html>`. Do not scope `.dark` only on an inner shell.
   */
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark")
  }, [resolved])

  return (
    <WorkspaceAppearanceContext.Provider value={value}>{children}</WorkspaceAppearanceContext.Provider>
  )
}

export function useWorkspaceAppearance(): WorkspaceAppearanceContextValue {
  const ctx = useContext(WorkspaceAppearanceContext)
  if (!ctx) {
    throw new Error("useWorkspaceAppearance must be used within WorkspaceAppearanceProvider")
  }
  return ctx
}

/** Optional: UI primitives outside the provider fall back to document.body portaling. */
export function useWorkspaceAppearanceOptional(): WorkspaceAppearanceContextValue | null {
  return useContext(WorkspaceAppearanceContext)
}
