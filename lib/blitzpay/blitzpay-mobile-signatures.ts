import { createHash } from "node:crypto"

const PEPPER = process.env.BLITZPAY_MOBILE_SIGNATURE_PEPPER ?? "blitzpay_mobile_signature_pepper_dev_only"

/** Deterministic hash for signature authorization rows — never store raw signature payloads. */
export function hashMobileSignatureAuthorization(parts: {
  organizationId: string
  authorizationType: string
  signedAtIso: string
  signerEmailNorm: string
  signerNameNorm: string
  opaqueClientReference: string
}): string {
  const body = [
    `organization_id:${parts.organizationId}`,
    `authorization_type:${parts.authorizationType}`,
    `signed_at:${parts.signedAtIso}`,
    `signer_email:${parts.signerEmailNorm}`,
    `signer_name:${parts.signerNameNorm}`,
    `opaque_ref:${parts.opaqueClientReference}`,
  ].join("|")
  return createHash("sha256").update(PEPPER).update("|").update(body).digest("hex")
}
