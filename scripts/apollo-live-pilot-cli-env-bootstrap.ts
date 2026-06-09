/**
 * Shared production env bootstrap for Apollo live pilot CLI scripts.
 * Do not load .env.local — use vercel env run -e production.
 */
import {
  APOLLO_LIVE_PILOT_PRODUCTION_ENV_FILE_SOURCES,
  bootstrapApolloLivePilotProductionEnv,
} from "../lib/growth/apollo/apollo-live-pilot-production-env-bootstrap"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export function bootstrapApolloLivePilotCliEnv(): void {
  bootstrapApolloLivePilotProductionEnv()
  bootstrapVerifiedChannelsCertEnv({
    sources: APOLLO_LIVE_PILOT_PRODUCTION_ENV_FILE_SOURCES,
    inheritProcessEnvProviderKeys: true,
  })
}
