/** Dialer integrations open externally — Growth coaching uses manual/provider transcript only. */
export const GROWTH_CALL_DIALER_SAFETY_COPY =
  "Google Voice is used for dialing only. Realtime Coaching uses manual/provider transcript input and does not record audio."

export const GROWTH_CALL_DIALER_NEXT_STEP_COPY =
  "Call opened in {dialer}. Start Realtime Coaching when the call begins."

/** Product invariant: no browser microphone capture in Growth call flows. */
export const GROWTH_CALL_AUDIO_CAPTURE_ENABLED = false

/** Product invariant: dispositions require explicit operator action. */
export const GROWTH_CALL_AUTO_DISPOSITION_ENABLED = false
