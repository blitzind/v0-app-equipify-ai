/**
 * Phase 56.6 — AIden occupies the bottom-right on dashboard (`z-[95]`, see `aiden-chat-launcher.tsx`).
 * Fixed toasts and secondary banners use `.br-stack-clear-aiden` (see `app/globals.css`) so they sit above
 * the launcher. CSS variables `--aiden-launcher-*` must stay aligned with the launcher’s Tailwind offsets.
 */
export const BR_STACK_CLEAR_AIDEN = "br-stack-clear-aiden"
