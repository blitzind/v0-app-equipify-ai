/**
 * Shared production env bootstrap for Apollo live pilot CLI scripts.
 * Never reads .env.local — use scripts/vercel-production-env-run.ts for production.
 */
import {
  APOLLO_LIVE_PILOT_PROTECTED_ENV_KEYS,
  APOLLO_LIVE_PILOT_PRODUCTION_ENV_FILE_SOURCES,
  bootstrapApolloLivePilotProductionEnv,
  snapshotApolloLivePilotProtectedEnv,
} from "../lib/growth/apollo/apollo-live-pilot-production-env-bootstrap"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export function bootstrapApolloLivePilotCliEnv(): {
  url: string
  jwt: string
} | null {
  const protectedSnapshot = snapshotApolloLivePilotProtectedEnv()

  bootstrapApolloLivePilotProductionEnv({ protectedSnapshot })

  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: APOLLO_LIVE_PILOT_PRODUCTION_ENV_FILE_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot,
  })

  return boot ? { url: boot.url, jwt: boot.jwt } : null
}

export { APOLLO_LIVE_PILOT_PROTECTED_ENV_KEYS }
