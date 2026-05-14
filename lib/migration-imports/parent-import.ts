import { resolveMapped } from "./map-columns"

export type ParentImportSources = {
  parentExt: string
  parentCompany: string
  parentAccount: string
}

function normName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

export function readParentImportSources(
  row: Record<string, string>,
  mapping: Record<string, string>,
): ParentImportSources {
  return {
    parentExt: resolveMapped(row, mapping, "parent_external_code").trim(),
    parentCompany: resolveMapped(row, mapping, "parent_company_name").trim(),
    parentAccount: resolveMapped(row, mapping, "parent_account").trim(),
  }
}

type ParentMatch = { id: string; label: string }

/**
 * Resolve a parent customer for hierarchy import.
 * Priority: explicit parent external code → unified parent account (code, then name) → parent company name.
 * Never returns a parent whose normalized company name equals the child row (avoids treating the child as its own parent).
 */
export function findParentImportMatch(
  sources: ParentImportSources,
  childCompanyName: string,
  deps: {
    resolveCode: (codeLower: string) => ParentMatch | null
    resolveName: (rawCompany: string) => ParentMatch | null
  },
): ParentMatch | null {
  const childNorm = normName(childCompanyName)

  const notSelf = (m: ParentMatch | null): ParentMatch | null => {
    if (!m) return null
    if (normName(m.label) === childNorm) return null
    return m
  }

  if (sources.parentExt) {
    const hit = notSelf(deps.resolveCode(sources.parentExt.toLowerCase()))
    if (hit) return hit
  }

  if (sources.parentAccount) {
    let hit = notSelf(deps.resolveCode(sources.parentAccount.toLowerCase()))
    if (!hit) hit = notSelf(deps.resolveName(sources.parentAccount))
    if (hit) return hit
  }

  if (sources.parentCompany) {
    return notSelf(deps.resolveName(sources.parentCompany))
  }

  return null
}
