import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Expose Vercel metadata to client when debugging deployment mismatch (NEXT_PUBLIC_AIDEN_LAUNCHER_DEBUG).
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "",
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
}

export default nextConfig
