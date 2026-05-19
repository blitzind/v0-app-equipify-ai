import type { EquipifyOAuthProvider } from "@/lib/auth/supabase-oauth"

const oauthButtonClassName =
  "w-full h-10 inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"

function GoogleMark() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#4285F4] font-semibold text-xs border border-gray-200">
      G
    </span>
  )
}

function AppleMark() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center text-gray-900" aria-hidden>
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.793 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.41-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
      </svg>
    </span>
  )
}

type OAuthSignInButtonProps = {
  provider: EquipifyOAuthProvider
  disabled?: boolean
  loading?: boolean
  onClick: () => void
}

export function OAuthSignInButton({ provider, disabled, loading, onClick }: OAuthSignInButtonProps) {
  const label = provider === "google" ? "Continue with Google" : "Continue with Apple"
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={oauthButtonClassName}
    >
      {provider === "google" ? <GoogleMark /> : <AppleMark />}
      {loading ? `Redirecting to ${provider === "google" ? "Google" : "Apple"}…` : label}
    </button>
  )
}

export function OAuthSignInButtonStack({
  disabled,
  loadingProvider,
  onGoogleClick,
  onAppleClick,
}: {
  disabled?: boolean
  loadingProvider: EquipifyOAuthProvider | null
  onGoogleClick: () => void
  onAppleClick: () => void
}) {
  return (
    <div className="space-y-3">
      <OAuthSignInButton
        provider="google"
        disabled={disabled}
        loading={loadingProvider === "google"}
        onClick={onGoogleClick}
      />
      <OAuthSignInButton
        provider="apple"
        disabled={disabled}
        loading={loadingProvider === "apple"}
        onClick={onAppleClick}
      />
    </div>
  )
}
