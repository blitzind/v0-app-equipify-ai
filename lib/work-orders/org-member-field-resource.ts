/**
 * Read `organization_members.is_field_resource` from a PostgREST row.
 * Handles snake_case / camelCase and loose boolean coercion from JSON/CSV tooling.
 */
export function readIsFieldResourceFromOrgMemberRow(row: Record<string, unknown>): boolean | undefined {
  const v = row.is_field_resource ?? row.isFieldResource
  if (typeof v === "boolean") return v
  if (v === null || v === undefined) return undefined
  if (typeof v === "string") {
    const s = v.trim().toLowerCase()
    if (s === "true" || s === "t" || s === "1" || s === "yes") return true
    if (s === "false" || s === "f" || s === "0" || s === "no") return false
  }
  if (typeof v === "number") {
    if (v === 1) return true
    if (v === 0) return false
  }
  return undefined
}
