"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useCustomerOutboundEmails } from "@/hooks/use-customer-outbound-emails"
import { isValidEmail } from "@/lib/email/format"

export function CustomerContactEmailDialog({
  open,
  onOpenChange,
  organizationId,
  customerId,
  customerLabel,
  defaultTo,
  contactId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  organizationId: string
  customerId: string
  customerLabel: string
  defaultTo?: string
  contactId?: string | null
}) {
  const { toast } = useToast()
  const { emails, loading: emailsLoading, error: emailsError } = useCustomerOutboundEmails(
    open ? organizationId : null,
    open ? customerId : null,
  )

  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const submitLock = useRef(false)

  useEffect(() => {
    if (!open) return
    setSubject("")
    setMessage("")
    submitLock.current = false
  }, [open, customerId])

  useEffect(() => {
    if (!open || emailsLoading) return
    if (emails.length === 0) {
      setTo("")
      return
    }
    const d = defaultTo?.trim().toLowerCase()
    if (d && emails.includes(d)) {
      setTo(d)
      return
    }
    setTo(emails[0]!)
  }, [open, emails, emailsLoading, defaultTo])

  const canSend = useMemo(() => {
    return (
      isValidEmail(to) &&
      subject.trim().length >= 2 &&
      message.trim().length >= 1 &&
      !sending &&
      emails.includes(to.trim().toLowerCase())
    )
  }, [to, subject, message, sending, emails])

  async function send() {
    if (!canSend || submitLock.current) return
    submitLock.current = true
    setSending(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/customers/${encodeURIComponent(customerId)}/contact-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to,
            subject: subject.trim(),
            message: message.trim(),
            contactId: contactId ?? null,
          }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        message?: string
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Send failed")
      }
      toast({
        title: "Email sent",
        description: `Message sent to ${to}.`,
      })
      onOpenChange(false)
    } catch (e) {
      toast({
        title: "Could not send email",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSending(false)
      submitLock.current = false
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !sending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" aria-hidden />
            Email customer
          </DialogTitle>
          <DialogDescription className="text-xs">
            Sends through Equipify email ({customerLabel}). Only addresses on file for this customer can receive
            messages.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {emailsError ? (
            <p className="text-xs text-destructive">{emailsError}</p>
          ) : null}
          {emailsLoading ? (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading recipient addresses…
            </p>
          ) : emails.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No billing or contact email on file. Add a contact or billing email for this customer, then try again.
            </p>
          ) : emails.length === 1 ? (
            <div className="space-y-1">
              <Label className="text-xs font-medium">To</Label>
              <Input value={to || emails[0]!} readOnly className="text-xs bg-muted/40" />
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs font-medium">To</Label>
              <Select
                value={to || undefined}
                onValueChange={(v) => setTo(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select recipient" />
                </SelectTrigger>
                <SelectContent>
                  {emails.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs font-medium">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short subject line"
              maxLength={300}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Message</Label>
            <Textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your message to the customer…"
              maxLength={12000}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void send()} disabled={!canSend || emails.length === 0}>
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Sending…
              </>
            ) : (
              "Send email"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
