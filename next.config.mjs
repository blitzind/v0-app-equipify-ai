import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
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
}

export default nextConfig
