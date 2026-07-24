/**
 * AVA-MAILBOX-CREDENTIAL-RESOLUTION-HOTFIX-1A — Production credential pepper bootstrap for certs.
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { isUsingDevFallbackCredentialPepper } from "@/lib/growth/outbound/credentials-crypto"
import { parseGrowthProductionEnvFile } from "@/lib/growth/qa/reply-flow-env-bootstrap"

export const GROWTH_PRODUCTION_CREDENTIAL_PEPPER_BOOTSTRAP_QA_MARKER =
  "growth-production-credential-pepper-bootstrap-1a-v1" as const

const PEPPER_ENV_FILES = [
  ".env.production.local",
  ".vercel/.env.production.local",
  ".env.build",
  ".env.local.equipify-vercel-run-hidden",
] as const

function readPepperFromEnvRecord(env: Record<string, string | undefined>): string | null {
  const pepper =
    env.GROWTH_PROVIDER_CREDENTIALS_PEPPER?.trim() || env.GROWTH_PROVIDER_SECRET_PEPPER?.trim() || ""
  return pepper || null
}

export function bootstrapGrowthProviderCredentialsPepperForCert(input?: {
  cwd?: string
}): {
  configured: boolean
  source: string | null
  usingDevFallback: boolean
} {
  const cwd = input?.cwd ?? process.cwd()
  let pepper = readPepperFromEnvRecord(process.env)
  let source: string | null = pepper ? "process_env" : null

  if (!pepper) {
    for (const relativePath of PEPPER_ENV_FILES) {
      const absolutePath = resolve(cwd, relativePath)
      if (!existsSync(absolutePath)) continue
      try {
        const parsed = parseGrowthProductionEnvFile(absolutePath, readFileSync(absolutePath, "utf8"))
        pepper = readPepperFromEnvRecord(parsed)
        if (pepper) {
          source = relativePath
          break
        }
      } catch {
        /* optional */
      }
    }
  }

  if (pepper) {
    process.env.GROWTH_PROVIDER_CREDENTIALS_PEPPER = pepper
    process.env.GROWTH_PROVIDER_SECRET_PEPPER = pepper
  }

  return {
    configured: Boolean(pepper),
    source,
    usingDevFallback: isUsingDevFallbackCredentialPepper(),
  }
}
