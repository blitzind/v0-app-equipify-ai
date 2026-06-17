"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type GrowthWorkspaceSettingsResourceState<T> = {
  value: T
  loading: boolean
  saving: boolean
  error: string | null
  persisted: boolean
  refresh: () => Promise<void>
  patch: (patch: Partial<T>) => Promise<boolean>
}

type ApiEnvelope<T> = {
  ok?: boolean
  message?: string
  preferences?: T
  profile?: T
  persisted?: boolean
}

export function useGrowthWorkspaceSettingsResource<T>({
  endpoint,
  initialValue,
  selectValue,
}: {
  endpoint: string
  initialValue: T
  selectValue: (data: ApiEnvelope<T>) => T | null
}): GrowthWorkspaceSettingsResourceState<T> {
  const [value, setValue] = useState<T>(initialValue)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [persisted, setPersisted] = useState(false)
  const valueRef = useRef(value)
  valueRef.current = value

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(endpoint, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as ApiEnvelope<T> & { error?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? "Could not load settings.")
      }
      const next = selectValue(data)
      if (!next) throw new Error("Settings response was empty.")
      setValue(next)
      setPersisted(Boolean(data.persisted))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load settings.")
    } finally {
      setLoading(false)
    }
  }, [endpoint, selectValue])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const patch = useCallback(
    async (patchValue: Partial<T>) => {
      const previous = valueRef.current
      const optimistic = { ...previous, ...patchValue }
      setValue(optimistic)
      setSaving(true)
      setError(null)

      try {
        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchValue),
        })
        const data = (await res.json().catch(() => ({}))) as ApiEnvelope<T> & { message?: string }
        if (!res.ok || !data.ok) {
          throw new Error(data.message ?? "Could not save settings.")
        }
        const next = selectValue(data)
        if (next) setValue(next)
        setPersisted(true)
        return true
      } catch (saveError) {
        setValue(previous)
        setError(saveError instanceof Error ? saveError.message : "Could not save settings.")
        return false
      } finally {
        setSaving(false)
      }
    },
    [endpoint, selectValue],
  )

  return {
    value,
    loading,
    saving,
    error,
    persisted,
    refresh,
    patch,
  }
}
