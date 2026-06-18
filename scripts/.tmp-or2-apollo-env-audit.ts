import {
  getApolloApiKey,
  isApolloContactDiscoveryEnabled,
  isApolloDiscoveryDisabled,
  isApolloMockEnabled,
} from "../lib/growth/providers/apollo/apollo-config"

function envStatus(key: string): "present" | "missing" | "empty" {
  const v = process.env[key]
  if (v === undefined || v === null) return "missing"
  if (!String(v).trim()) return "empty"
  return "present"
}

const key = getApolloApiKey(process.env)
const mock = isApolloMockEnabled(process.env)
const ready =
  Boolean(key) &&
  !mock &&
  isApolloContactDiscoveryEnabled(process.env) &&
  !isApolloDiscoveryDisabled(process.env)

console.log(
  JSON.stringify(
    {
      APOLLO_API_KEY: envStatus("APOLLO_API_KEY"),
      GROWTH_APOLLO_API_KEY: envStatus("GROWTH_APOLLO_API_KEY"),
      resolved_api_key: key ? "present" : envStatus("APOLLO_API_KEY") === "present" || envStatus("GROWTH_APOLLO_API_KEY") === "present" ? "invalid" : "missing",
      mock_mode: mock,
      apollo_discovery_enabled: isApolloContactDiscoveryEnabled(process.env),
      apollo_kill_switch: isApolloDiscoveryDisabled(process.env),
      ready_for_live_search: ready,
      GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: process.env.GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED ?? "missing",
      GROWTH_APOLLO_USE_MOCK: process.env.GROWTH_APOLLO_USE_MOCK ?? "missing",
    },
    null,
    2,
  ),
)
