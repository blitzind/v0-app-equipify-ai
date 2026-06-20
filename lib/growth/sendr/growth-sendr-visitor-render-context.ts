export type SendrVisitorRenderContext = {
  leadId?: string | null
  token?: string | null
}

function asTrimmed(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function parseSendrVisitorRenderContext(
  searchParams: Record<string, string | string[] | undefined>,
): SendrVisitorRenderContext {
  function pick(key: string): string | null {
    const value = searchParams[key]
    if (typeof value === "string") return asTrimmed(value)
    if (Array.isArray(value)) return asTrimmed(value[0])
    return null
  }

  return {
    leadId: pick("leadId"),
    token: pick("token"),
  }
}

export function hasSendrVisitorRenderContext(context?: SendrVisitorRenderContext | null): boolean {
  if (!context) return false
  return Boolean(context.leadId || context.token)
}
