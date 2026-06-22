/** Client-safe OAuth mailbox ownership guard (GS-GROWTH-MAIL-7F). */

export function isMailboxOwnedBySender(
  mailbox: { sender_account_id: string } | null | undefined,
  senderAccountId: string | null | undefined,
): boolean {
  if (!mailbox || !senderAccountId) return false
  return mailbox.sender_account_id === senderAccountId
}
