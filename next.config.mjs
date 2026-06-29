import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Browser bundles cannot read VERCEL_ENV / GROWTH_RUNTIME_PROFILE directly (Phase 8N-C).
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "",
    NEXT_PUBLIC_GROWTH_RUNTIME_PROFILE: process.env.GROWTH_RUNTIME_PROFILE ?? "",
    NEXT_PUBLIC_GROWTH_ENGINE_ENABLED: process.env.GROWTH_ENGINE_ENABLED ?? "",
    NEXT_PUBLIC_GROWTH_VIDEO_WORKSPACE_ENABLED: process.env.GROWTH_VIDEO_WORKSPACE_ENABLED ?? "",
    NEXT_PUBLIC_GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL:
      process.env.GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL ?? "",
    NEXT_PUBLIC_GROWTH_CONTACT_ACQUISITION: process.env.GROWTH_CONTACT_ACQUISITION ?? "",
    NEXT_PUBLIC_GROWTH_PROSPECT_QUALIFICATION: process.env.GROWTH_PROSPECT_QUALIFICATION ?? "",
    NEXT_PUBLIC_GROWTH_SEQUENCE_RECOMMENDATION: process.env.GROWTH_SEQUENCE_RECOMMENDATION ?? "",
    NEXT_PUBLIC_GROWTH_NEXT_BEST_ACTION: process.env.GROWTH_NEXT_BEST_ACTION ?? "",
    NEXT_PUBLIC_GROWTH_NATIVE_DECISION_ENGINE: process.env.GROWTH_NATIVE_DECISION_ENGINE ?? "",
    NEXT_PUBLIC_GROWTH_REVENUE_EXECUTION_PLAN: process.env.GROWTH_REVENUE_EXECUTION_PLAN ?? "",
    NEXT_PUBLIC_GROWTH_COMMUNICATION_STRATEGY: process.env.GROWTH_COMMUNICATION_STRATEGY ?? "",
    NEXT_PUBLIC_GROWTH_DAILY_REVENUE_WORK_QUEUE: process.env.GROWTH_DAILY_REVENUE_WORK_QUEUE ?? "",
    NEXT_PUBLIC_GROWTH_AUTONOMOUS_EXECUTION_GUARDRAILS:
      process.env.GROWTH_AUTONOMOUS_EXECUTION_GUARDRAILS ?? "",
  },
  // Default Server Actions body limit is 1MB; equipment AI scan sends multipart
  // images/PDFs up to 12MB — without this, mobile camera uploads fail before the action runs.
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Pin workspace root to this app dir so dev/build resolve modules from
  // ./node_modules instead of the parent monorepo lockfile (avoids
  // "Can't resolve 'tailwindcss'" in dev).
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: __dirname,
  async redirects() {
    return [
      {
        source: "/growth/ai-os",
        destination: "/growth/os",
        permanent: true,
      },
      {
        source: "/growth/ai-os/:path*",
        destination: "/growth/os/:path*",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
