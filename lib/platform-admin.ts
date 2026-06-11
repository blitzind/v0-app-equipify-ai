import "server-only"

/**
 * Node/server routes may import from here (enforces server-only boundary).
 * Middleware must import `@/lib/platform-admin-policy` directly (Edge-safe).
 */
export {
  getPlatformAdminAllowlistMeta,
  getPlatformAdminEmails,
  isPlatformAdminEmail,
  logPlatformAdminDevDiagnostics,
} from "./platform-admin-policy"
