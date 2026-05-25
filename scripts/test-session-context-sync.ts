/**
 * Regression checks for auth/profile/org session context isolation.
 * Run: pnpm test:session-context-sync
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const adminStore = fs.readFileSync(path.join(process.cwd(), "lib/admin-store.tsx"), "utf8")
assert.match(adminStore, /subscribeToAuthSessionChanges/)
assert.match(adminStore, /refreshSessionIdentity/)
assert.match(adminStore, /clearSessionIdentity/)
assert.match(adminStore, /clearAuthSessionClientStorage/)
assert.match(adminStore, /clearUserScopedClientStorageIfAuthUserChanged/)
assert.doesNotMatch(adminStore, /sessionSeededRef/)

const activeOrg = fs.readFileSync(
  path.join(process.cwd(), "lib/active-organization-context.tsx"),
  "utf8",
)
assert.match(activeOrg, /subscribeToAuthSessionChanges/)
assert.match(activeOrg, /clearUserScopedClientStorage/)
assert.match(activeOrg, /logSessionContextDiagnostics/)

const topbar = fs.readFileSync(path.join(process.cwd(), "components/app-topbar.tsx"), "utf8")
assert.match(topbar, /clearAuthSessionClientStorage/)
assert.match(topbar, /clearSessionIdentity/)
assert.match(topbar, /window\.location\.assign\("\/login"\)/)
assert.match(topbar, /getOrgPermissionsForRole\(null\)/)
assert.match(topbar, /if \(link\.href === "\/admin"\) return isPlatformAdmin/)

const sidebar = fs.readFileSync(path.join(process.cwd(), "components/app-sidebar.tsx"), "utf8")
assert.match(sidebar, /platformAdmin: isPlatformAdmin/)
assert.match(sidebar, /getOrgPermissionsForRole\(null\)/)

const loginPage = fs.readFileSync(path.join(process.cwd(), "app/(auth)/login/page.tsx"), "utf8")
assert.match(loginPage, /clearAuthSessionClientStorage/)
assert.match(loginPage, /window\.location\.assign\("\/"\)/)

const storage = fs.readFileSync(path.join(process.cwd(), "lib/auth/session-context-storage.ts"), "utf8")
assert.match(storage, /equipify_active_organization_id/)
assert.match(storage, /EQUIPIFY_SUPPORT_SESSION_ORG_CACHE_KEY/)
assert.match(storage, /equipify_session_auth_user_id/)
assert.match(storage, /clearAuthSessionClientStorage/)

const accountSummary = fs.readFileSync(
  path.join(process.cwd(), "app/api/session/account-summary/route.ts"),
  "utf8",
)
assert.match(accountSummary, /authUserId: user\.id/)
assert.match(accountSummary, /\.eq\("id", user\.id\)/)

const sessionIdentity = fs.readFileSync(path.join(process.cwd(), "lib/session-identity.ts"), "utf8")
assert.match(sessionIdentity, /authUserId: string/)

const authSync = fs.readFileSync(path.join(process.cwd(), "lib/auth/auth-session-sync.ts"), "utf8")
assert.match(authSync, /onAuthStateChange/)
assert.match(authSync, /signed_out/)
assert.match(authSync, /signed_in/)

console.log("session-context-sync checks passed")
