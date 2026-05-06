import "server-only"

import { createHash } from "crypto"

/** Hex-encoded SHA-256 for opaque portal tokens (stored in DB). */
export function sha256Hex(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex")
}
