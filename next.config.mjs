import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
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
