// Plain REST call to Resend (no SDK dependency, matching lib/metaapi.ts's
// style) — this is what actually reaches a user when a price alert fires
// while they don't have the app open. Free tier covers ~100/day, 3,000/mo.
//
// IMPORTANT: until you verify your own sending domain in Resend
// (resend.com/domains), Resend only allows sending FROM their sandbox
// address (onboarding@resend.dev) TO the email you signed up to Resend
// with — it will silently fail (or 403) for any other recipient. This is
// fine for testing with your own account, but real users won't receive
// alerts until a domain is verified. Set RESEND_FROM_EMAIL once you have
// a verified domain (e.g. "alerts@yourdomain.com").
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"

export async function sendAlertEmail(to: string, subject: string, body: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set — skipping alert email:", subject)
    return
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to,
      subject,
      text: body,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    console.error("Resend email failed:", response.status, errorText)
  }
}
