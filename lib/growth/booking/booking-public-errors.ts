/** Client-safe public booking error copy (slice 6.27B). */

export function publicBookingErrorMessage(code: string): string {
  switch (code) {
    case "slot_unavailable":
      return "That time is no longer available. Please choose another slot."
    case "page_disabled":
      return "This booking page is not available."
    case "invalid_form":
      return "Please check your booking details and try again."
    case "invalid_month":
      return "That calendar month is outside the booking window."
    case "calendar_unavailable":
      return "Booking is temporarily unavailable. Please try again later."
    default:
      return "We could not complete your booking. Please try again."
  }
}
