/** Growth Engine SR-2B-1 — Share page organization scope validation (client-safe). */

export function validateSharePageOrganizationScope(input: {
  organizationId: string | null | undefined
  expectedOrganizationId: string | null | undefined
}): { ok: boolean; error: string | null } {
  const organizationId = input.organizationId?.trim() ?? ""
  const expectedOrganizationId = input.expectedOrganizationId?.trim() ?? ""
  if (!organizationId) return { ok: false, error: "organization_id_required" }
  if (!expectedOrganizationId) return { ok: true, error: null }
  if (organizationId !== expectedOrganizationId) {
    return { ok: false, error: "organization_scope_mismatch" }
  }
  return { ok: true, error: null }
}
