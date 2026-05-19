# Sign in with Apple (Supabase Auth)

## iPhone (native — implemented)

The Equipify iOS app uses **native** Sign in with Apple (`expo-apple-authentication`) and Supabase:

```typescript
supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken, nonce })
```

Configure Supabase:

| Setting | Value |
|---------|--------|
| Apple provider | Enabled |
| Client IDs | `ai.equipify.mobile` (bundle ID) |

No redirect URL is required for native-only token exchange.

Details: `equipify-mobile-apple/docs/APPLE-OAUTH.md`.

---

## Web (optional — not on login UI yet)

Web Sign in with Apple uses the same **`/auth/callback`** route as Google (`app/auth/callback/route.ts`). To enable later:

### Apple Developer Program

1. **Identifiers → App ID** `ai.equipify.mobile` — enable **Sign in with Apple**.
2. **Identifiers → Services ID** (e.g. `ai.equipify.mobile.web`) — enable Sign in with Apple.
3. Configure **Return URLs** for the Services ID:
   - `https://<project-ref>.supabase.co/auth/v1/callback`
4. **Keys** — create a Sign in with Apple key (`.p8`), note Key ID and Team ID.
5. Link Services ID to the primary App ID.

### Supabase Dashboard

1. **Authentication → Providers → Apple** — enable.
2. **Client IDs** — comma-separated, e.g. `ai.equipify.mobile,ai.equipify.mobile.web` (bundle + Services ID).
3. **Secret Key** — paste the `.p8` contents (or use Supabase’s guided setup).
4. **Redirect URLs** (URL configuration):

| Environment | Redirect URL |
|-------------|----------------|
| Web production | `https://app.equipify.ai/auth/callback` |
| Web local | `http://localhost:3000/auth/callback` |

### Web app code (when enabling)

```typescript
await supabase.auth.signInWithOAuth({
  provider: 'apple',
  options: { redirectTo: `${window.location.origin}/auth/callback` },
})
```

Post-login behavior matches Google: cookies + existing org membership gating; no auto org creation.

---

## Security

- Never commit `.p8` keys or Apple client secrets to git.
- Store secrets only in Supabase provider settings (server-side).
- Mobile app holds no Apple secrets.

---

## Related

- [GOOGLE-OAUTH.md](./GOOGLE-OAUTH.md) — Google provider and redirect URLs
