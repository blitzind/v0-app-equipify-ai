# Google sign-in (Supabase Auth)

Equipify web (`equipify-app`) and iPhone (`equipify-mobile-apple`) use **Supabase Auth** with the **Google** provider. Email/password login is unchanged.

## 1. Supabase Dashboard

1. Open **Authentication → Providers → Google**.
2. Enable Google.
3. Paste **Client ID** and **Client secret** from Google Cloud (see below).
4. Under **Authentication → URL configuration**:
   - **Site URL (production):** `https://app.equipify.ai`
   - **Redirect URLs** (add every URL that receives users after Supabase finishes OAuth):

| Environment | Redirect URL |
|-------------|----------------|
| Web production | `https://app.equipify.ai/auth/callback` |
| Web local | `http://localhost:3000/auth/callback` |
| iPhone (custom scheme) | `equipifymobileapple://auth/callback` |
| Expo dev client (if used) | `exp+equipify-mobile-apple://auth/callback` |

The **Google Cloud** authorized redirect URI is always Supabase’s hosted callback, not your app URL:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

Supabase then redirects to the app URLs above.

## 2. Google Cloud Console

1. APIs & Services → **Credentials** → **Create credentials** → **OAuth client ID**.
2. Application type: **Web application** (used by Supabase Auth bridge).
3. **Authorized redirect URIs:**  
   `https://<project-ref>.supabase.co/auth/v1/callback`
4. Copy Client ID and Client secret into Supabase Google provider settings.

For iOS-only Google clients: not required when using Supabase’s web OAuth flow; the mobile app opens the Supabase authorize URL in a browser session.

## 3. Environment variables

### Web (`equipify-app`)

| Variable | Required |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `NEXT_PUBLIC_SITE_URL` | Recommended (`http://localhost:3000` local, `https://app.equipify.ai` prod) |

No Google client secret in the web app — only in Supabase.

### iPhone (`equipify-mobile-apple`)

| Variable | Required |
|----------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes |

No Google credentials in the mobile app.

## 4. Application behavior

### Web

- Login: **Continue with Google** → `signInWithOAuth({ provider: 'google' })` → browser redirect.
- Callback: `app/auth/callback/route.ts` exchanges code for session cookies.
- Post-login: same middleware and `ActiveOrganizationProvider` as email login.
- No automatic organization creation on Google login; users without membership use onboarding or see empty workspace UX.

### iPhone

- Login: **Continue with Google** → in-app browser → deep link `equipifymobileapple://auth/callback`.
- Session stored in **expo-secure-store** (existing Supabase adapter).
- Post-login: same `loadMembership()` as email login → **blocked access** if no active `organization_members` row.
- No organization provisioning from mobile Google login.

## 5. Manual QA

See [CLIENT-PILOT-CHECKLIST.md](./CLIENT-PILOT-CHECKLIST.md) and mobile `docs/GOOGLE-OAUTH.md`.

## 6. Sign in with Apple

See **[APPLE-OAUTH.md](./APPLE-OAUTH.md)** — native on iPhone; web optional via the same `/auth/callback` route.

## 7. Known limitations

- Google sign-in is disabled in **training/demo** mode (placeholder Supabase env).
- Users must already have (or receive) an **organization membership**; Google does not replace invite/onboarding on web.
- Mobile does not create workspaces; web onboarding still required for new companies.
- Account linking (Google + existing email password) follows Supabase project settings.
