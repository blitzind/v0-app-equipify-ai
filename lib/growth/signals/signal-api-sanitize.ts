import {
  GROWTH_SIGNAL_INTERNAL_FIELD_NAMES,
} from "@/lib/growth/signals/signal-types"

export function stripInternalSignalFields<T extends Record<string, unknown>>(row: T): T {
  const copy = { ...row }
  for (const key of GROWTH_SIGNAL_INTERNAL_FIELD_NAMES) {
    delete copy[key]
  }
  return copy
}
