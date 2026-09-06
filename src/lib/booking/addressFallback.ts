/**
 * Degraded-mode rules for the booking wizard's address fields.
 *
 * Normally a customer must pick an address from Google Places autocomplete so
 * we capture a Place ID, which the server turns into coordinates for the
 * distance-based fare. When Places is unavailable — daily quota exhausted
 * (HTTP 429 from `AutocompletePlaces`), an API outage, or a missing/misscoped
 * browser key — no Place ID can ever be produced. Without a fallback the
 * wizard dead-ends at step 2 and the entire booking funnel goes dark with no
 * message to the customer.
 *
 * These helpers define the two rules that keep the funnel open:
 *   1. accept a typed address when (and only when) the lookup is degraded
 *   2. never charge a card for a fare derived from an unvalidated address
 */

/** Shortest typed address we'll accept — enough to rule out stray keystrokes. */
export const MIN_MANUAL_ADDRESS_LENGTH = 5;

/** Services whose fare depends on resolving the address to coordinates. */
const DISTANCE_PRICED_SERVICES = ["point-to-point", "airport-transfer"];

interface AddressFieldState {
  /** The text shown in the field. */
  address: string;
  /** Google Place ID, empty when the customer never picked a suggestion. */
  placeId: string;
  /** True once Places autocomplete has reported itself unavailable. */
  lookupDegraded: boolean;
}

/**
 * Whether an address field is filled in well enough to advance the wizard.
 *
 * A Place ID always satisfies the field. Free text only satisfies it while
 * the lookup is degraded — otherwise we keep insisting the customer picks a
 * suggestion, which is what makes the automatic fare possible.
 */
export function isAddressProvided({
  address,
  placeId,
  lookupDegraded,
}: AddressFieldState): boolean {
  if (placeId) return true;
  if (!lookupDegraded) return false;
  return address.trim().length >= MIN_MANUAL_ADDRESS_LENGTH;
}

/**
 * Whether a booking must go down the manual-quote path (email us the details,
 * no card taken) instead of straight to Stripe.
 *
 * With no Place ID the wizard's price preview falls back to the
 * `INCLUDED_MILES` sentinel, which prices every trip as if it were within the
 * included mileage. That's fine as a "starts at" teaser, but charging it would
 * badly underprice a long trip and bill a customer for a fare nobody computed.
 * So for distance-priced services a degraded lookup forces the manual quote.
 *
 * Hourly charter is priced on hours × vehicle rate, so an unvalidated pickup
 * address doesn't affect the fare — it stays instantly bookable.
 */
export function requiresManualQuote(
  service: string | null | undefined,
  lookupDegraded: boolean,
): boolean {
  return lookupDegraded && !!service && DISTANCE_PRICED_SERVICES.includes(service);
}
