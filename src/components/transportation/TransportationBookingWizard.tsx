"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import {
  AIRPORT_OPTIONS,
  BOOKABLE_TRANSPORTATION_SERVICES,
  CHILD_SEAT_OPTIONS,
  GRATUITY_OPTIONS,
  HOURLY_RATES,
  HOURLY_VEHICLE_RATES,
  PASSENGER_GROUPS,
  SERVICE_LABELS,
  calculateAirportTransferPrice,
  calculateHourlyCharterPrice,
  calculatePointToPointPrice,
  formatCurrency,
  shouldShowGroupQuoteMessage,
  type BookableServiceCode,
} from "@/lib/transportationData";
import { minHoursFor } from "@/lib/booking/pricing/hourlyCharter";
import { AIRPORTS } from "@/lib/transportationLocations";
import { SITE_CONTACT } from "@/lib/siteContact";
import { FORM_SUBJECT_PREFIX } from "@/lib/siteEnv";
import {
  AIRPORT_SERVICE_FEE,
  INCLUDED_MILES,
  SERVICE_RADIUS_MILES,
  VEHICLES,
  getVehicle,
  vehiclesForPassengerCount,
} from "@/lib/pricing/engine";
import { AIRPORT_PRICING } from "@/lib/booking/pricing/data";
import { isAddressProvided, requiresManualQuote } from "@/lib/booking/addressFallback";
import ChildSeatSelector from "./ChildSeatSelector";
import GoogleAddressAutocomplete from "./GoogleAddressAutocomplete";
import VehicleSelector from "./VehicleSelector";

const WEB3_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY ?? "";

/** sessionStorage key for the in-progress booking draft. sessionStorage (not
 *  localStorage) so the draft naturally clears when the user closes the tab —
 *  short-lived persistence to survive accidental refreshes, no long-lived PII. */
const DRAFT_STORAGE_KEY = "tnt-booking-draft-v1";

/** Shape stored in sessionStorage. Versioned via the key so we can break the
 *  schema later by bumping `-v1` → `-v2` and naturally ignoring stale drafts. */
interface BookingDraft {
  step: number;
  state: WizardState;
  highestStep: number;
}

function readDraft(): BookingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed != null &&
      typeof parsed.step === "number" &&
      parsed.state &&
      typeof parsed.state === "object"
    ) {
      return parsed as BookingDraft;
    }
  } catch {
    // Corrupt JSON / disabled storage — fall through to fresh state.
  }
  return null;
}

function writeDraft(draft: BookingDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Quota exceeded / Safari private mode / etc. — silently no-op.
  }
}

function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

const TOTAL_STEPS = 5;
// Trip + Passengers are merged into one step — the passenger group drives
// the vehicle default, so making them separate steps doubled navigation
// without adding clarity.
const STEP_LABELS_SHORT = [
  "Service",
  "Trip",
  "Contact",
  "Review",
  "Confirm",
];

const inputBase =
  "w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-ink placeholder:text-muted/70 outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 disabled:opacity-60";

const labelClass =
  "block font-sans text-xs font-semibold text-muted uppercase tracking-wide mb-1.5";

const fieldGroup = "grid gap-4 sm:grid-cols-2";

const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-3 text-sm font-semibold text-white transition hover:bg-charcoal disabled:opacity-60 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-cream";

const buttonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white px-7 py-3 text-sm font-semibold text-ink transition hover:border-ink cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-cream";

type ServiceCode = BookableServiceCode;

/**
 * One row in the Booking Summary breakdown. Either:
 *  - A section header (no `amount`) — used to label round-trip legs.
 *  - A regular item (has `amount`) — optionally `indent: true` to nest under
 *    the section header above it.
 */
type BreakdownLine = {
  label: string;
  amount?: number;
  indent?: boolean;
};

/**
 * Compute the pre-gratuity breakdown for an airport leg given the vehicle and
 * known distance. Mirrors the server-side engine math so the summary's lines
 * sum (within rounding) to `quote.data.base`. Returns `undefined` when the
 * vehicle isn't found or the distance is unknown.
 *
 *  For one-way:
 *    Base (Vehicle, includes N mi) + Mileage (extra mi × rate) + Airport fee
 *
 *  For round-trip we collapse to a single line so the user doesn't have to
 *  reason about the 1.9× multiplier per component.
 */
function buildAirportBreakdown(
  vehicleId: string,
  distanceMiles: number | null,
  roundTrip: boolean,
): BreakdownLine[] | undefined {
  const vehicle = getVehicle(vehicleId);
  if (!vehicle || distanceMiles == null) return undefined;

  const extraMiles = Math.max(0, distanceMiles - INCLUDED_MILES);
  const baseFare = vehicle.airportBaseFare;
  const mileageFare = vehicle.airportPerMile * extraMiles;

  // Per-leg component lines (Base, optional Mileage, Airport fee). Reused
  // for both legs of a round-trip and for the single one-way breakdown.
  const legLines = (indent: boolean): BreakdownLine[] => {
    const lines: BreakdownLine[] = [
      {
        label: `Base (${vehicle.name}, includes ${INCLUDED_MILES} mi)`,
        amount: baseFare,
        indent,
      },
    ];
    if (extraMiles > 0) {
      lines.push({
        label: `Mileage (${extraMiles.toFixed(1)} mi × $${vehicle.airportPerMile.toFixed(2)})`,
        amount: Math.round(mileageFare),
        indent,
      });
    }
    lines.push({ label: "Airport service fee", amount: AIRPORT_SERVICE_FEE, indent });
    return lines;
  };

  if (roundTrip) {
    return [
      { label: "Leg 1 · Arrival" },
      ...legLines(true),
      { label: "Leg 2 · Return" },
      ...legLines(true),
    ];
  }

  return legLines(false);
}

/**
 * Point-to-point breakdown — same shape as the airport version but with the
 * P2P base/per-mile and no airport fee. Returns `undefined` when we don't
 * have enough info to compute (no live distance, etc.).
 */
function buildPointToPointBreakdown(
  vehicleId: string,
  distanceMiles: number | null,
  roundTrip: boolean,
): BreakdownLine[] | undefined {
  const vehicle = getVehicle(vehicleId);
  if (!vehicle || distanceMiles == null) return undefined;

  const extraMiles = Math.max(0, distanceMiles - INCLUDED_MILES);
  const baseFare = vehicle.baseFare;
  const mileageFare = vehicle.perMile * extraMiles;

  const legLines = (indent: boolean): BreakdownLine[] => {
    const lines: BreakdownLine[] = [
      {
        label: `Base (${vehicle.name}, includes ${INCLUDED_MILES} mi)`,
        amount: baseFare,
        indent,
      },
    ];
    if (extraMiles > 0) {
      lines.push({
        label: `Mileage (${extraMiles.toFixed(1)} mi × $${vehicle.perMile.toFixed(2)})`,
        amount: Math.round(mileageFare),
        indent,
      });
    }
    return lines;
  };

  if (roundTrip) {
    return [
      { label: "Leg 1 · Outbound" },
      ...legLines(true),
      { label: "Leg 2 · Return" },
      ...legLines(true),
    ];
  }

  return legLines(false);
}

/** Which side of the airport trip the airport sits on. */
type AirportDirection = "from-airport" | "to-airport";

type WizardState = {
  service: ServiceCode | null;
  airportDirection: AirportDirection;
  airport: string;
  otherAddress: string;
  roundTrip: boolean;
  pickupAddress: string;
  dropoffAddress: string;
  airline: string;
  flightNumber: string;
  flightTime: string;
  /** Round-trip only: time of the return-leg flight (departure from local airport). */
  returnFlightTime: string;
  meetAndGreet: boolean;
  /** Point-to-point: Google Place IDs (separate from formatted display string). */
  pickupPlaceId: string;
  dropoffPlaceId: string;
  /** Airport transfer: Place ID for the hotel/address (the non-airport side). */
  otherAddressPlaceId: string;
  /** Point-to-point: vehicle catalog selection. Defaults to towncar. */
  vehicleId: string;
  extraStop: boolean;
  extraStopDetails: string;
  pickupDateTime: string;
  hours: number;
  plannedStops: string;
  passengerGroup: string;
  luggageCount: number;
  childSeats: string[];
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
  gratuity: string;
};

const INITIAL_STATE: WizardState = {
  service: null,
  airportDirection: "from-airport",
  airport: "LAX",
  otherAddress: "",
  roundTrip: false,
  pickupAddress: "",
  dropoffAddress: "",
  airline: "",
  flightNumber: "",
  flightTime: "",
  returnFlightTime: "",
  meetAndGreet: false,
  pickupPlaceId: "",
  dropoffPlaceId: "",
  otherAddressPlaceId: "",
  vehicleId: VEHICLES[0]?.id ?? "",
  extraStop: false,
  extraStopDetails: "",
  pickupDateTime: "",
  hours: 4,
  plannedStops: "",
  passengerGroup: "1-4",
  luggageCount: 1,
  childSeats: [],
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  notes: "",
  gratuity: "20",
};

function airportDisplayName(code: string) {
  return AIRPORTS.find((a) => a.name.includes(`(${code})`))?.name ?? code;
}

const SERVICE_ICONS: Record<ServiceCode, React.ReactNode> = {
  "airport-transfer": (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 19.5l19-7.5-7.5-2.5-3.5 2.5-2.5-2.5L2.5 19.5z" />
      <path d="M10.5 6.5l3 2-1 2" />
    </svg>
  ),
  "point-to-point": (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-7.5 7-12a7 7 0 10-14 0c0 4.5 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  "hourly-charter": (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
};

const CheckBadge = () => (
  <motion.span
    aria-hidden="true"
    initial={{ scale: 0.6, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", stiffness: 480, damping: 22 }}
    className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-gold text-ink shadow-sm"
  >
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  </motion.span>
);

function todayLocal() {
  // For datetime-local min — today's date at 00:00 local.
  const d = new Date();
  d.setSeconds(0, 0);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function formatHumanDateTime(iso: string) {
  if (!iso) return "Not provided";
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidDateTime(value: string) {
  if (!value || !value.trim()) return false;
  // Native datetime-local emits "YYYY-MM-DDTHH:MM" when complete; a partially
  // typed date (just "YYYY-MM-DD") will parse to midnight and slip through a
  // naive NaN check, so require the full "T HH:MM" portion here.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return false;
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return false;
  // Reject past pickup times (with a small grace so "now" is still acceptable
  // for last-minute manual entries).
  return time.getTime() > Date.now() - 60_000;
}

/** Upper-bound seat count for a PASSENGER_GROUPS value like "1-4" or "11-14". */
function passengersFromGroup(group: string): number {
  if (group === "15+") return 15;
  const match = group.match(/^(\d+)-(\d+)$/);
  return match ? Number(match[2]) : 1;
}

function isValidPhone(value: string) {
  // 7+ digits anywhere — keeps validation forgiving for international.
  return value.replace(/\D/g, "").length >= 7;
}

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.startsWith("1") ? digits.slice(1) : digits;
  if (normalized.length <= 3) return `(${normalized}`;
  if (normalized.length <= 6) return `(${normalized.slice(0, 3)}) ${normalized.slice(3)}`;
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6, 10)}`;
}

const BOOKABLE_CODES: ReadonlySet<BookableServiceCode> = new Set([
  "airport-transfer",
  "point-to-point",
  "hourly-charter",
]);

function isBookableCode(value: string | null): value is BookableServiceCode {
  return value !== null && BOOKABLE_CODES.has(value as BookableServiceCode);
}

export default function TransportationBookingWizard() {
  const searchParams = useSearchParams();

  // Deep-link: a sub-page CTA can pass ?service=hourly-charter etc. to drop
  // the user straight into the trip-details step with the service preselected.
  // We honor "disneyland-transportation" as a marketing alias that maps to
  // point-to-point, the closest bookable type.
  const initialFromUrl = useMemo<{
    service: BookableServiceCode | null;
    step: number;
  }>(() => {
    const aliasMap: Record<string, BookableServiceCode> = {
      "disneyland-transportation": "point-to-point",
      "airport": "airport-transfer",
      "hourly": "hourly-charter",
    };

    const raw = searchParams.get("service")?.toLowerCase() ?? "";
    const alias = aliasMap[raw];
    if (alias) {
      return { service: alias, step: 2 };
    }
    if (isBookableCode(raw)) {
      return { service: raw, step: 2 };
    }
    return { service: null, step: 1 };
  }, [searchParams]);

  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(initialFromUrl.step);
  /** Direction of last step change (forward = 1, back = -1). Drives slide dir. */
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [highestStep, setHighestStep] = useState(initialFromUrl.step);
  const [state, setState] = useState<WizardState>(() => ({
    ...INITIAL_STATE,
    service: initialFromUrl.service,
  }));
  const [error, setError] = useState("");
  /**
   * Per-field validation errors (keyed by field id used in the form). The
   * banner error above is the legacy top-of-form summary; we render inline
   * errors next to each invalid field and scroll to the first one on submit.
   */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitStatus, setSubmitStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const minDateTime = useMemo(() => todayLocal(), []);
  const stepHeaderRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLElement | null>(null);

  /* ── Live quote (point-to-point only) ────────────────────────────────
   *
   * Fires whenever pickup/dropoff Place IDs, vehicle, or extra-stop change.
   * Debounced 400ms so rapid edits coalesce into one request.
   */
  type LiveQuote = {
    service: "point-to-point" | "airport-transfer";
    distanceMiles: number | null;
    vehicle: { id: string; name: string };
    matchedFixedRoute: string | null;
    base: number;
    gratuity: number;
    total: number;
    breakdown: Array<{ label: string; amount: number }>;
  };
  type QuoteState =
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; data: LiveQuote }
    | { kind: "error"; message: string; offending?: "pickup" | "dropoff" | "both" };
  const [quote, setQuote] = useState<QuoteState>({ kind: "idle" });

  /**
   * Set when Google Places autocomplete reports itself unusable — the daily
   * `AutocompletePlaces` quota is exhausted (HTTP 429), the API is down, or
   * the browser key is missing/misscoped. No Place ID can be produced in that
   * state, so without this flag every address field fails validation and the
   * whole booking funnel dead-ends silently. Sticky for the session: once
   * Google has failed we don't flip back mid-booking.
   */
  const [addressLookupDegraded, setAddressLookupDegraded] = useState(false);
  const markAddressLookupDegraded = useCallback(() => setAddressLookupDegraded(true), []);

  /** Step-5 gratuity picker is collapsed by default — the Review page reads
      as confirmation rather than another decision. Default 20% comes from
      `INITIAL_STATE.gratuity`; this state only controls visibility. */
  const [showGratuityPicker, setShowGratuityPicker] = useState(false);

  /** Mobile-only: when true the sticky pricing bar opens an expandable panel
      above it showing the full breakdown (Base / Mileage / Airport fee /
      Gratuity / Add-ons). Lets phone users answer "why this price?" without
      navigating away from the form. */
  const [showStickyBreakdown, setShowStickyBreakdown] = useState(false);

  /** Set to true once we've notified the user that we restored their draft —
      shown as a small one-shot pill that fades after a few seconds. */
  const [draftRestored, setDraftRestored] = useState(false);

  /* ── Draft persistence ────────────────────────────────────
   *
   * Restore the booking state from sessionStorage on mount so an accidental
   * refresh doesn't wipe everything. The URL `?service=…` deep-link still
   * takes precedence if the customer explicitly picked a *different* service
   * than the draft (intent to start a fresh flow). Saved on every state/step
   * change, cleared after a successful submission.
   */
  useEffect(() => {
    const draft = readDraft();
    if (!draft) return;
    if (
      initialFromUrl.service &&
      draft.state.service !== initialFromUrl.service
    ) {
      // URL is asking for a different service than what's in the draft —
      // honour the URL and discard the stale draft.
      clearDraft();
      return;
    }
    setState(draft.state);
    setStep(draft.step);
    setHighestStep(Math.max(draft.highestStep ?? draft.step, draft.step));
    setDraftRestored(true);
    // Auto-hide the "draft restored" pill after a few seconds.
    const t = window.setTimeout(() => setDraftRestored(false), 4500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Skip persisting the brand-new INITIAL_STATE (no useful info captured
    // yet). Once the customer has picked a service or moved past step 1,
    // start writing every change.
    if (step === 1 && state.service === null) return;
    writeDraft({ step, state, highestStep });
  }, [step, state, highestStep]);

  /** Cached actual driving distance from the last successful airport quote,
      scoped to the airport+hotel pair it was measured for. Reused by the
      local fallback while a new quote is being fetched — without this, a
      vehicle change briefly shows the price computed at the airport's
      baseline distance (e.g. LAX 34 mi) instead of the user's real distance,
      which flickers as $175 → $135 once the API responds. */
  const lastAirportQuoteRef = useRef<{
    airport: string;
    otherAddressPlaceId: string;
    distanceMiles: number;
  } | null>(null);

  /** Same trick for point-to-point. Caches the actual distance per
      pickup+dropoff pair so changing vehicle inputs reprice instantly using
      the current vehicle's rates instead of waiting for the API roundtrip
      (which otherwise flashes the legacy substring matcher's stale numbers). */
  const lastP2PQuoteRef = useRef<{
    pickupPlaceId: string;
    dropoffPlaceId: string;
    distanceMiles: number;
  } | null>(null);

  useEffect(() => {
    if (
      quote.kind === "ok" &&
      quote.data.service === "airport-transfer" &&
      typeof quote.data.distanceMiles === "number" &&
      Number.isFinite(quote.data.distanceMiles)
    ) {
      const cached = lastAirportQuoteRef.current;
      const samePair =
        cached?.airport === state.airport &&
        cached?.otherAddressPlaceId === state.otherAddressPlaceId;
      // Only write the cache the FIRST time we see this address pair. Google
      // Routes can return slightly different distances across calls for the
      // exact same pair (Bug 2) — locking on first read keeps the displayed
      // distance + the breakdown math both stable across vehicle switches.
      // We also round at the source (Bug 3) so distance.toFixed(1) for the
      // display and (distance × perMile) for the math agree to the cent.
      if (!samePair) {
        lastAirportQuoteRef.current = {
          airport: state.airport,
          otherAddressPlaceId: state.otherAddressPlaceId,
          distanceMiles: Math.round(quote.data.distanceMiles * 10) / 10,
        };
      }
    }
    if (
      quote.kind === "ok" &&
      quote.data.service === "point-to-point" &&
      typeof quote.data.distanceMiles === "number" &&
      Number.isFinite(quote.data.distanceMiles)
    ) {
      const cached = lastP2PQuoteRef.current;
      const samePair =
        cached?.pickupPlaceId === state.pickupPlaceId &&
        cached?.dropoffPlaceId === state.dropoffPlaceId;
      if (!samePair) {
        lastP2PQuoteRef.current = {
          pickupPlaceId: state.pickupPlaceId,
          dropoffPlaceId: state.dropoffPlaceId,
          distanceMiles: Math.round(quote.data.distanceMiles * 10) / 10,
        };
      }
    }
  }, [quote, state.airport, state.otherAddressPlaceId, state.pickupPlaceId, state.dropoffPlaceId]);

  useEffect(() => {
    if (state.service !== "point-to-point" && state.service !== "airport-transfer") {
      setQuote({ kind: "idle" });
      return;
    }

    if (state.service === "point-to-point") {
      if (!state.pickupPlaceId || !state.dropoffPlaceId || !state.vehicleId) {
        setQuote({ kind: "idle" });
        return;
      }
    }

    if (state.service === "airport-transfer") {
      if (!state.airport || !state.otherAddressPlaceId) {
        setQuote({ kind: "idle" });
        return;
      }
    }

    let cancelled = false;
    setQuote({ kind: "loading" });
    const handle = window.setTimeout(async () => {
      try {
        const payload: Record<string, unknown> = {
          service: state.service,
          tripType: state.roundTrip ? "roundtrip" : "oneway",
          addOns: {},
        };

        if (state.service === "point-to-point") {
          payload.pickupPlaceId = state.pickupPlaceId;
          payload.dropoffPlaceId = state.dropoffPlaceId;
          payload.vehicleId = state.vehicleId;
          payload.passengers = passengersFromGroup(state.passengerGroup);
          payload.addOns = { extraStop: state.extraStop };
        }

        if (state.service === "airport-transfer") {
          payload.airport = state.airport;
          payload.otherAddressPlaceId = state.otherAddressPlaceId;
          payload.vehicleId = state.vehicleId;
          payload.passengerGroup = state.passengerGroup;
          payload.addOns = { meetAndGreet: state.meetAndGreet };
        }

        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setQuote({
            kind: "error",
            message: data.message ?? "Couldn't compute a quote.",
            offending: data.offending,
          });
          return;
        }
        setQuote({ kind: "ok", data });
      } catch (err) {
        if (cancelled) return;
        setQuote({
          kind: "error",
          message: err instanceof Error ? err.message : "Network error fetching quote.",
        });
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [
    state.service,
    state.pickupPlaceId,
    state.dropoffPlaceId,
    state.vehicleId,
    state.extraStop,
    state.passengerGroup,
    state.airport,
    state.otherAddressPlaceId,
    state.roundTrip,
    state.meetAndGreet,
  ]);

  /** Tracks the previously-rendered passenger group so we can reset the
      vehicle to the cheapest eligible option when the group ACTUALLY
      changes (not just on the initial mount or when the user clicks a
      different vehicle within the same group). */
  const lastPassengerGroupRef = useRef(state.passengerGroup);

  useEffect(() => {
    const passengerCount = passengersFromGroup(state.passengerGroup);
    const eligibleVehicles = vehiclesForPassengerCount(passengerCount);
    // VEHICLES is sorted small → large in config/vehicles.json, so the first
    // vehicle that fits is the cheapest tier for this passenger count.
    const cheapestEligible = eligibleVehicles[0]?.id ?? "";

    const groupChanged = lastPassengerGroupRef.current !== state.passengerGroup;
    lastPassengerGroupRef.current = state.passengerGroup;

    if (groupChanged) {
      // Always snap back to the cheapest eligible tier when the group
      // changes — e.g. 5–6 → 1–4 should reset from SUV/Sprinter back to
      // Sedan rather than carrying the previous (more expensive) selection.
      if (state.vehicleId !== cheapestEligible) {
        setState((current) => ({ ...current, vehicleId: cheapestEligible }));
      }
    } else if (!eligibleVehicles.some((v) => v.id === state.vehicleId)) {
      // Safety net: current selection is no longer eligible for any other
      // reason (URL deep-link, manual state edit) — fall back to cheapest.
      setState((current) => ({ ...current, vehicleId: cheapestEligible }));
    }
  }, [state.passengerGroup, state.vehicleId]);

  /* Focus management & scroll on step change */
  useEffect(() => {
    if (stepHeaderRef.current) {
      stepHeaderRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // Defer focus so the new field exists in the DOM.
    const id = window.requestAnimationFrame(() => {
      if (firstFieldRef.current) firstFieldRef.current.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [step]);

  const priceSummary = useMemo(() => {
    if (!state.service) {
      return {
        basePrice: null as number | null,
        addOns: 0,
        gratuity: 0,
        total: null as number | null,
        pending: true,
        routeLabel: null as string | null,
        priceLabel: "Total",
        breakdown: undefined as BreakdownLine[] | undefined,
      };
    }

    // Address search is down, so the addresses below are unvalidated free
    // text with no coordinates. The branches further down would happily price
    // those at the INCLUDED_MILES sentinel — fine as a teaser, but charging it
    // would bill the customer for a fare nobody actually measured. Force the
    // manual-quote path instead: `total: null` routes `handleSubmit` to the
    // email flow, so we confirm the address and send a fare, no card taken.
    if (requiresManualQuote(state.service, addressLookupDegraded)) {
      return {
        basePrice: null as number | null,
        addOns: 0,
        gratuity: 0,
        total: null as number | null,
        pending: true,
        routeLabel: "We'll confirm your address and send your fare.",
        priceLabel: "Total",
        breakdown: undefined as BreakdownLine[] | undefined,
      };
    }

    if (state.service === "airport-transfer") {
      // Only trust the API quote if it was computed for the currently
      // selected vehicle. Otherwise (the user just switched vehicles) it's
      // a stale value that would flash for a render before the new quote
      // arrives.
      const apiQuoteMatchesSelection =
        quote.kind === "ok" &&
        quote.data.service === "airport-transfer" &&
        quote.data.vehicle.id === state.vehicleId;

      // While the user hasn't actually picked (or has just cleared) the
      // destination, pin the distance at INCLUDED_MILES so the breakdown
      // shows only Base + Airport fee — no speculative mileage based on a
      // baseline distance that doesn't reflect the user's real hotel.
      const noDestinationYet = !state.otherAddressPlaceId;

      // Resolve the distance we'll show the breakdown for. Priority:
      //   1. Cached actual distance for the current (airport, address) pair —
      //      first-write-wins (Bug 2 + Bug 3) so the displayed number and the
      //      breakdown math don't drift across vehicle switches.
      //   2. Fresh API distance if we have no cache yet (first quote).
      //   3. Airport baseline distance as a last-resort estimate.
      const cachedAirportDistance =
        lastAirportQuoteRef.current?.airport === state.airport &&
        lastAirportQuoteRef.current?.otherAddressPlaceId === state.otherAddressPlaceId
          ? lastAirportQuoteRef.current.distanceMiles
          : null;
      const distanceMiles = noDestinationYet
        ? INCLUDED_MILES
        : cachedAirportDistance != null
          ? cachedAirportDistance
          : apiQuoteMatchesSelection && quote.kind === "ok" && typeof quote.data.distanceMiles === "number"
            ? quote.data.distanceMiles
            : AIRPORT_PRICING[state.airport as keyof typeof AIRPORT_PRICING]?.distanceMiles ?? null;

      const breakdown = buildAirportBreakdown(state.vehicleId, distanceMiles, state.roundTrip);

      // Compute price LOCALLY from the resolved distance so the breakdown
      // lines, the displayed mileage, and the final total are guaranteed to
      // agree to the cent (Bug 2 + Bug 3). The API quote is still polled so
      // we get the first measured distance, but its `quote.data.base` is no
      // longer used directly — we recompute from the cached/displayed value
      // to keep things consistent across vehicle switches.
      const pricing = calculateAirportTransferPrice(
        state.airport,
        state.vehicleId,
        state.meetAndGreet,
        state.roundTrip,
        distanceMiles ?? undefined,
      );
      if (!pricing) {
        return {
          basePrice: null,
          addOns: 0,
          gratuity: 0,
          total: null,
          pending: true,
          routeLabel: null,
          priceLabel: "Starts at",
          breakdown: undefined,
        };
      }
      const subtotal = pricing.total + pricing.addOns;
      const gratuityAmount =
        state.gratuity === "cash" ? 0 : Math.round((subtotal * Number(state.gratuity)) / 100);
      const fromLabel = state.airportDirection === "from-airport" ? state.airport : state.otherAddress || "Hotel/address";
      const toLabel = state.airportDirection === "from-airport" ? state.otherAddress || "Hotel/address" : state.airport;
      // Confirmed once we've received any successful API quote for this pair
      // (even if it was for a different vehicle — the distance is locked).
      const confirmed = apiQuoteMatchesSelection || cachedAirportDistance != null;
      return {
        basePrice: pricing.total,
        addOns: pricing.addOns,
        gratuity: gratuityAmount,
        total: subtotal + gratuityAmount,
        pending: !confirmed && quote.kind === "loading",
        routeLabel: `Starts at ${fromLabel} ${state.roundTrip ? "↔" : "→"} ${toLabel}${state.roundTrip ? " (round trip)" : ""}`,
        priceLabel: confirmed ? "Total" : "Starts at",
        breakdown,
      };
    }

    if (state.service === "point-to-point") {
      // Reject API "ok" quotes that don't match the currently selected
      // vehicle — without this, switching from sedan → SUV flashes the
      // sedan's price for a render before the new quote returns.
      const apiQuoteMatchesSelection =
        quote.kind === "ok" &&
        quote.data.service === "point-to-point" &&
        quote.data.vehicle.id === state.vehicleId;

      const hasPlaceIds = !!state.pickupPlaceId && !!state.dropoffPlaceId;

      // Resolve the distance for the breakdown + local computation. Priority:
      //   1. Cached actual distance for the current (pickup, dropoff) pair —
      //      first-write-wins (Bug 2 + Bug 3) so subsequent quotes can't
      //      drift the displayed distance or per-line math.
      //   2. Fresh API distance if we have no cache yet (first quote).
      //   3. INCLUDED_MILES sentinel when no addresses are picked yet — that
      //      makes the breakdown collapse to just the Base row, mirroring the
      //      airport flow's "no destination yet" preview.
      const cachedP2PDistance =
        lastP2PQuoteRef.current?.pickupPlaceId === state.pickupPlaceId &&
        lastP2PQuoteRef.current?.dropoffPlaceId === state.dropoffPlaceId
          ? lastP2PQuoteRef.current.distanceMiles
          : null;
      const distanceMiles: number | null = !hasPlaceIds
        ? INCLUDED_MILES
        : cachedP2PDistance != null
          ? cachedP2PDistance
          : apiQuoteMatchesSelection && quote.kind === "ok" && typeof quote.data.distanceMiles === "number"
            ? quote.data.distanceMiles
            : null;

      // Defensive: P2P has no round-trip UI toggle, so we never apply the
      // round-trip multiplier here even if `state.roundTrip` happens to be
      // true from a prior airport-transfer selection. The service-switch
      // handler also resets `roundTrip` (Bug 1) — this is the second layer.
      const breakdown = buildPointToPointBreakdown(state.vehicleId, distanceMiles, false);

      // Compute price locally from the resolved distance. Since the
      // fixed-route overrides were removed, the engine math matches what the
      // API returns, so we use one code path that's guaranteed to agree with
      // the displayed mileage and breakdown (Bug 2 + Bug 3).
      if (distanceMiles !== null) {
        const vehicle = getVehicle(state.vehicleId);
        if (vehicle) {
          const extraMiles = Math.max(0, distanceMiles - INCLUDED_MILES);
          const oneWay = vehicle.baseFare + vehicle.perMile * extraMiles;
          // P2P is always one-way (Bug 1) — see breakdown comment above.
          const basePrice = Math.round(oneWay);
          const addOns = state.extraStop ? 20 : 0;
          const subtotal = basePrice + addOns;
          const gratuityAmount =
            state.gratuity === "cash" ? 0 : Math.round((subtotal * Number(state.gratuity)) / 100);
          // Confirmed once we have a measured distance for the pair — either
          // a fresh API hit for the current vehicle or a cached one.
          const confirmed = apiQuoteMatchesSelection || cachedP2PDistance != null;
          return {
            basePrice,
            addOns,
            gratuity: gratuityAmount,
            total: subtotal + gratuityAmount,
            pending: hasPlaceIds && quote.kind === "loading" && !confirmed,
            routeLabel: hasPlaceIds
              ? `Custom route · ${distanceMiles.toFixed(1)} mi (${vehicle.name})`
              : "Pick pickup and drop-off above for a quote.",
            priceLabel: confirmed ? "Total" : "Starts at",
            breakdown,
          };
        }
      }

      // Loading with no cached distance available (first quote ever) — show
      // the "calculating" state with a null base so we don't display a
      // misleading number for a route we genuinely don't know the size of.
      if (quote.kind === "loading") {
        return {
          basePrice: null as number | null,
          addOns: 0,
          gratuity: 0,
          total: null as number | null,
          pending: true,
          routeLabel: "Calculating fare…",
          priceLabel: "Starts at",
          breakdown: undefined,
        };
      }
      if (quote.kind === "error") {
        return {
          basePrice: null as number | null,
          addOns: 0,
          gratuity: 0,
          total: null as number | null,
          pending: true,
          routeLabel: null,
          priceLabel: "Starts at",
          breakdown: undefined,
        };
      }

      // FALLBACK — free-text typed addresses (no Place IDs). The legacy
      // substring matcher still previews the four famous routes (SNA,
      // Universal, Downtown LA) by name when the user hasn't picked from
      // the autocomplete yet.
      const pricing = calculatePointToPointPrice(
        state.pickupAddress,
        state.dropoffAddress,
        state.passengerGroup,
        state.extraStop,
      );
      const subtotal = pricing.total ?? 0;
      const gratuityAmount =
        state.gratuity === "cash" ? 0 : Math.round((subtotal * Number(state.gratuity)) / 100);
      return {
        basePrice: pricing.base,
        addOns: pricing.addOns,
        gratuity: gratuityAmount,
        total: pricing.total ? pricing.total + gratuityAmount : null,
        pending: pricing.base === null || state.passengerGroup === "15+",
        routeLabel: pricing.routeMatch ?? "Pick pickup and drop-off above for a quote.",
        priceLabel: pricing.routeMatch ? "Total" : "Starts at",
        // Legacy fallback is a flat fixed-route lookup — no engine breakdown.
        breakdown: undefined,
      };
    }

    const pricing = calculateHourlyCharterPrice(state.vehicleId || state.passengerGroup, state.hours);
    if (!pricing) {
      return {
        basePrice: null,
        addOns: 0,
        gratuity: 0,
        total: null,
        pending: true,
        routeLabel: "Hourly charter",
        priceLabel: "Total",
        breakdown: undefined,
      };
    }
    const gratuityAmount =
      state.gratuity === "cash" ? 0 : Math.round((pricing.total * Number(state.gratuity)) / 100);
    const hourlyVehicle = getVehicle(state.vehicleId);
    const hourlyBreakdown: BreakdownLine[] | undefined = hourlyVehicle
      ? [
          {
            label: `${hourlyVehicle.name} · ${pricing.billedHours} hr × $${hourlyVehicle.hourlyRate}/hr`,
            amount: pricing.total,
          },
        ]
      : undefined;
    return {
      basePrice: pricing.total,
      addOns: 0,
      gratuity: gratuityAmount,
      total: pricing.total + gratuityAmount,
      pending: false,
      routeLabel: `${state.hours}-hour charter`,
      priceLabel: "Total",
      breakdown: hourlyBreakdown,
    };
  }, [state, quote, addressLookupDegraded]);

  /** Map from `WizardState` keys to the `fieldErrors` keys we render under each field. */
  const STATE_TO_ERROR_KEY: Partial<Record<keyof WizardState, string[]>> = {
    airport: ["airport"],
    otherAddress: ["airport-other-address"],
    otherAddressPlaceId: ["airport-other-address"],
    flightTime: ["flight-time"],
    returnFlightTime: ["return-flight-time"],
    pickupAddress: ["pickup-address-p2p", "pickup-address-charter"],
    dropoffAddress: ["dropoff-address-p2p"],
    pickupPlaceId: ["pickup-address-p2p", "pickup-address-charter"],
    dropoffPlaceId: ["dropoff-address-p2p"],
    pickupDateTime: ["pickup-time-p2p", "pickup-time-charter"],
    hours: ["hours"],
    vehicleId: ["vehicle"],
    passengerGroup: ["passengerGroup"],
    firstName: ["firstName"],
    lastName: ["lastName"],
    email: ["email"],
    phone: ["phone"],
  };

  const handleField = <K extends keyof WizardState>(field: K, value: WizardState[K]) => {
    const nextValue = field === "phone" && typeof value === "string"
      ? (formatPhoneInput(value) as WizardState[K])
      : value;
    setState((current) => ({ ...current, [field]: nextValue }));
    // Clear inline errors tied to this field on edit.
    const keys = STATE_TO_ERROR_KEY[field];
    if (keys) keys.forEach(clearFieldError);
  };

  const goToStep = (target: number) => {
    setError("");
    if (target < 1 || target > TOTAL_STEPS) return;
    setStepDirection(target >= step ? 1 : -1);
    setStep(target);
    setHighestStep((current) => Math.max(current, target));
  };

  /**
   * Validate every required field on `currentStep` at once and return both a
   * per-field map (rendered inline) and an optional top-of-form summary.
   * Empty `fieldErrors` ⇒ step is valid.
   */
  function validateStep(currentStep: number): { fieldErrors: Record<string, string>; summary: string | null } {
    const errs: Record<string, string> = {};

    if (currentStep === 1) {
      if (!state.service) errs.service = "Please choose a transportation service to continue.";
    }

    if (currentStep === 2) {
      if (state.service === "airport-transfer") {
        if (!state.airport) errs.airport = "Pick an airport.";
        if (
          !isAddressProvided({
            address: state.otherAddress,
            placeId: state.otherAddressPlaceId,
            lookupDegraded: addressLookupDegraded,
          })
        ) {
          errs["airport-other-address"] = addressLookupDegraded
            ? "Enter your hotel name or full address."
            : "Pick your hotel or address from the suggestions.";
        }
        if (!isValidDateTime(state.flightTime)) {
          errs["flight-time"] =
            state.roundTrip || state.airportDirection === "from-airport"
              ? "Enter a valid future arrival date and time."
              : "Enter a valid future departure date and time.";
        }
        if (state.roundTrip && !isValidDateTime(state.returnFlightTime)) {
          errs["return-flight-time"] = "Enter a valid future return-flight date and time.";
        }
      }
      if (state.service === "point-to-point") {
        if (
          !isAddressProvided({
            address: state.pickupAddress,
            placeId: state.pickupPlaceId,
            lookupDegraded: addressLookupDegraded,
          })
        ) {
          errs["pickup-address-p2p"] = addressLookupDegraded
            ? "Enter the full pickup address."
            : "Pick a pickup address from the suggestions.";
        }
        if (
          !isAddressProvided({
            address: state.dropoffAddress,
            placeId: state.dropoffPlaceId,
            lookupDegraded: addressLookupDegraded,
          })
        ) {
          errs["dropoff-address-p2p"] = addressLookupDegraded
            ? "Enter the full drop-off address."
            : "Pick a drop-off address from the suggestions.";
        }
        if (!state.pickupDateTime || !isValidDateTime(state.pickupDateTime)) {
          errs["pickup-time-p2p"] = "Enter a valid pickup date and time.";
        }
        if (!state.vehicleId) errs.vehicle = "Pick a vehicle.";
        if (quote.kind === "error") {
          errs.quote = quote.message;
        } else if (quote.kind === "loading") {
          errs.quote = "Hang on — we're calculating your fare.";
        }
      }
      if (state.service === "hourly-charter") {
        if (
          !isAddressProvided({
            address: state.pickupAddress,
            placeId: state.pickupPlaceId,
            lookupDegraded: addressLookupDegraded,
          })
        ) {
          errs["pickup-address-charter"] = addressLookupDegraded
            ? "Enter the full pickup address."
            : "Pick a pickup address from the suggestions.";
        }
        if (!state.pickupDateTime || !isValidDateTime(state.pickupDateTime)) {
          errs["pickup-time-charter"] = "Enter a valid pickup date and time.";
        }
        const minH = minHoursFor(state.vehicleId || state.passengerGroup);
        if (state.hours < minH) {
          errs.hours = `${minH}-hour minimum for this vehicle.`;
        }
      }
    }

    // Passenger / vehicle / luggage validation merged into step 2 below.
    if (currentStep === 2) {
      if (!state.passengerGroup) errs.passengerGroup = "Choose a passenger group.";
      const passengerCount = passengersFromGroup(state.passengerGroup);
      const eligibleVehicles = vehiclesForPassengerCount(passengerCount);
      if (eligibleVehicles.length > 0 && !eligibleVehicles.some((v) => v.id === state.vehicleId)) {
        errs.vehicle = "Pick a vehicle.";
      }
      if (state.luggageCount < 0) errs.luggage = "Luggage count can't be negative.";
    }

    if (currentStep === 3) {
      if (!state.firstName.trim()) errs.firstName = "Enter your first name.";
      if (!state.lastName.trim()) errs.lastName = "Enter your last name.";
      if (!isValidEmail(state.email)) errs.email = "Enter a valid email address.";
      if (!isValidPhone(state.phone)) errs.phone = "Enter a valid phone number.";
    }

    const summary = Object.keys(errs).length === 0
      ? null
      : Object.keys(errs).length === 1
        ? Object.values(errs)[0]
        : "Please fix the highlighted fields below.";
    return { fieldErrors: errs, summary };
  }

  const scrollToTop = () => {
    if (stepHeaderRef.current) {
      stepHeaderRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  /**
   * Smooth-scroll to the first invalid field on the current step. We tag
   * every wrapper with `data-error="true"` when its key appears in
   * `fieldErrors`, so a single querySelector finds the topmost one.
   */
  const scrollToFirstError = () => {
    if (typeof document === "undefined") return;
    const first = document.querySelector<HTMLElement>("[data-error='true']");
    if (first) {
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      // Best-effort focus on the inner control to help screen readers.
      const focusable = first.querySelector<HTMLElement>("input, select, textarea, button");
      focusable?.focus({ preventScroll: true });
    } else {
      scrollToTop();
    }
  };

  const handleNext = () => {
    const result = validateStep(step);
    if (result.summary) {
      setFieldErrors(result.fieldErrors);
      setError(result.summary);
      // Wait one frame so the inline-error attributes paint before we scan.
      window.requestAnimationFrame(() => scrollToFirstError());
      return;
    }
    setFieldErrors({});
    setError("");
    goToStep(step + 1);
  };

  const handleBack = () => {
    setError("");
    setFieldErrors({});
    if (step > 1) goToStep(step - 1);
  };

  /** Clear a single field's error as soon as the user edits it. */
  const clearFieldError = (key: string) => {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const { [key]: _removed, ...rest } = current;
      void _removed;
      return rest;
    });
  };

  function buildSubmissionPayload() {
    const lines: string[] = [];
    lines.push(`Service: ${state.service ? SERVICE_LABELS[state.service] : ""}`);
    if (priceSummary.routeLabel) lines.push(`Route: ${priceSummary.routeLabel}`);

    if (state.service === "airport-transfer") {
      const serviceTypeLabel = state.roundTrip
        ? "Round trip (airport pickup + drop-off)"
        : state.airportDirection === "from-airport"
          ? "Airport pickup (arrival)"
          : "Airport drop-off (departure)";
      lines.push(`Service type: ${serviceTypeLabel}`);
      lines.push(`Airport: ${airportDisplayName(state.airport)}`);
      lines.push(
        state.roundTrip
          ? `Hotel / address: ${state.otherAddress}`
          : state.airportDirection === "from-airport"
            ? `Drop-off address: ${state.otherAddress}`
            : `Pickup address: ${state.otherAddress}`,
      );
      lines.push(`Airline: ${state.airline || "Not provided"}`);
      lines.push(`Flight #: ${state.flightNumber || "Not provided"}`);
      lines.push(
        state.roundTrip
          ? `Arrival flight time: ${formatHumanDateTime(state.flightTime)}`
          : state.airportDirection === "from-airport"
            ? `Arrival time: ${formatHumanDateTime(state.flightTime)}`
            : `Departure time: ${formatHumanDateTime(state.flightTime)}`,
      );
      if (state.roundTrip) {
        lines.push(`Return departure time: ${formatHumanDateTime(state.returnFlightTime)}`);
      }
      if (state.airportDirection === "from-airport" || state.roundTrip) {
        lines.push(`Meet & greet: ${state.meetAndGreet ? "Yes (+$30)" : "No"}`);
      }
    }
    if (state.service === "point-to-point") {
      lines.push(`Pickup: ${state.pickupAddress}`);
      lines.push(`Drop-off: ${state.dropoffAddress}`);
      lines.push(`Pickup date/time: ${formatHumanDateTime(state.pickupDateTime)}`);
      lines.push(`Extra stop: ${state.extraStop ? state.extraStopDetails || "Yes" : "No"}`);
    }
    if (state.service === "hourly-charter") {
      lines.push(`Pickup: ${state.pickupAddress}`);
      lines.push(`Pickup date/time: ${formatHumanDateTime(state.pickupDateTime)}`);
      lines.push(`Hours: ${state.hours}`);
      lines.push(`Planned stops/notes: ${state.plannedStops || "Not provided"}`);
    }

    const passengerLabel = PASSENGER_GROUPS.find((p) => p.value === state.passengerGroup)?.label;
    lines.push(`Passengers: ${passengerLabel}`);
    lines.push(`Luggage: ${state.luggageCount}`);
    lines.push(`Child seats: ${state.childSeats.length ? state.childSeats.join(", ") : "None"}`);
    lines.push(`Gratuity: ${state.gratuity === "cash" ? "Cash at pickup" : `${state.gratuity}%`}`);

    if (priceSummary.total !== null) {
      lines.push(`Estimated total: ${formatCurrency(priceSummary.total)}`);
    } else {
      lines.push(`Estimated total: Quote pending`);
    }

    if (state.notes.trim()) {
      lines.push("");
      lines.push(`Notes: ${state.notes.trim()}`);
    }

    return {
      subject: `${FORM_SUBJECT_PREFIX}TNT Tours — Transportation booking · ${state.firstName} ${state.lastName}`,
      from_name: `${state.firstName} ${state.lastName}`,
      email: state.email,
      phone: state.phone,
      message: lines.join("\n"),
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitStatus("sending");

    // If the total is null (group 15+ or unknown route), fall back to the email
    // quote flow — these aren't auto-bookable yet.
    if (priceSummary.total === null) {
      await submitEmailQuote();
      return;
    }

    // Standard flow: persist booking + redirect to Stripe Checkout.
    try {
      const pickupAtIso = computePickupIso();
      if (!pickupAtIso) {
        setError("Pickup date/time is missing.");
        scrollToTop();
        setSubmitStatus("error");
        return;
      }

      const subtotalCents = Math.round((priceSummary.basePrice ?? 0 + priceSummary.addOns) * 100);
      const gratuityCents = Math.round((priceSummary.gratuity ?? 0) * 100);
      const totalCents = Math.round((priceSummary.total ?? 0) * 100);

      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: state.service,
          pickupAtIso,
          customer: {
            firstName: state.firstName,
            lastName: state.lastName,
            email: state.email,
            phone: state.phone,
          },
          totals: {
            subtotalCents: subtotalCents > 0 ? subtotalCents : totalCents - gratuityCents,
            gratuityCents,
            totalCents,
          },
          payload: state,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          diagnosticId?: string;
          detail?: string;
        };
        const base = data.error ?? "Failed to create booking";
        const ref = data.diagnosticId ? ` (ref: ${data.diagnosticId})` : "";
        // `detail` is only included in non-production builds — surfaces the
        // underlying exception so local dev doesn't require checking the server
        // terminal to know why the call failed.
        const dev = data.detail ? `\nDetail: ${data.detail}` : "";
        throw new Error(`${base}${ref}${dev}`);
      }

      const { checkoutUrl } = (await res.json()) as { checkoutUrl: string };
      // Redirect to Stripe-hosted checkout. No success state in the wizard —
      // Stripe handles UI from here, and customers come back via /booking/success.
      window.location.href = checkoutUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Booking could not be started.";
      setError(message);
      setSubmitStatus("error");
    }
  }

  /** For legacy 15+ / custom-quote path — still uses Web3Forms/FormSubmit. */
  async function submitEmailQuote() {
    const payload = buildSubmissionPayload();
    try {
      if (WEB3_KEY) {
        const res = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ access_key: WEB3_KEY, ...payload }),
        });
        const data = await res.json();
        if (!data.success) throw new Error("submission failed");
      } else {
        const res = await fetch(
          `https://formsubmit.co/ajax/${encodeURIComponent(SITE_CONTACT.email)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              _subject: payload.subject,
              name: payload.from_name,
              email: payload.email,
              phone: payload.phone,
              message: payload.message,
            }),
          },
        );
        const data = await res.json();
        if (!data.success && data.success !== "true") throw new Error("submission failed");
      }
      setSubmitStatus("success");
      // Clean up the in-progress draft now that the booking is in the system —
      // a stale draft from a completed booking would confuse the customer on
      // a later visit.
      clearDraft();
    } catch {
      setSubmitStatus("error");
    }
  }

  /**
   * Convert datetime-local string to ISO. We interpret the value as the
   * customer's browser-local time. Confirmation emails always render in PT, so
   * customers booking from outside California should pick the LA-local pickup
   * time directly (the form copy reminds them).
   */
  function computePickupIso(): string | null {
    const local = state.pickupDateTime || state.flightTime;
    if (!local) return null;
    const date = new Date(local);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  /* ── Sub-renders ──────────────────────────────────────── */

  const ProgressBar = (
    // Sticks to top of viewport on phone/tablet (sub-lg) so users can see
    // their place in the flow while scrolling long steps. Negative side
    // margins cancel the card's padding so the bg extends edge-to-edge while
    // sticking; everything reverts to a static, padded layout at lg+ where
    // the sidebar already orients the user.
    <nav
      aria-label="Booking progress"
      className="sticky top-0 z-30 -mx-5 sm:-mx-8 px-5 sm:px-8 -mt-5 sm:-mt-8 pt-5 sm:pt-8 pb-3 mb-6 bg-white/95 backdrop-blur-md border-b border-border/40 lg:static lg:bg-transparent lg:backdrop-blur-none lg:border-0 lg:mx-0 lg:px-0 lg:mt-0 lg:pt-0 lg:pb-0 lg:mb-8"
    >
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, idx) => {
          const idx1 = idx + 1;
          const reached = idx1 <= highestStep;
          const isCurrent = idx1 === step;
          const isComplete = idx1 < step;
          return (
            <li key={idx1} className="flex-1">
              <button
                type="button"
                disabled={!reached}
                onClick={() => reached && goToStep(idx1)}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Step ${idx1}: ${STEP_LABELS_SHORT[idx]}`}
                className={`group block w-full text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 rounded-lg ${
                  reached ? "cursor-pointer" : "cursor-not-allowed"
                }`}
              >
                <div
                  className={`h-1.5 w-full rounded-full transition-colors ${
                    isComplete
                      ? "bg-gold"
                      : isCurrent
                        ? "bg-gold/70"
                        : "bg-border"
                  }`}
                />
                <span
                  className={`mt-2 hidden sm:block text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors ${
                    isCurrent ? "text-ink" : reached ? "text-muted" : "text-muted/60"
                  }`}
                >
                  {STEP_LABELS_SHORT[idx]}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs font-semibold text-muted sm:hidden">
        Step {step} of {TOTAL_STEPS} — <span className="text-ink">{STEP_LABELS_SHORT[step - 1]}</span>
      </p>
    </nav>
  );

  const PriceSummary = (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <p className="text-xs uppercase tracking-[0.18em] text-gold font-semibold">Booking summary</p>
      <h3 className="mt-3 font-display text-xl font-semibold text-ink">
        {state.service ? SERVICE_LABELS[state.service] : "Choose a service to begin"}
      </h3>
      {priceSummary.routeLabel && (
        <p className="mt-1 text-sm text-muted">{priceSummary.routeLabel}</p>
      )}

      <dl className="mt-5 space-y-2.5 text-sm text-ink">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Passengers</dt>
          <dd className="font-medium">
            {PASSENGER_GROUPS.find((p) => p.value === state.passengerGroup)?.label ?? "—"}
          </dd>
        </div>
        {priceSummary.breakdown && priceSummary.breakdown.length > 0 ? (
          priceSummary.breakdown.map((line, idx) => {
            // Section header — no amount, used to introduce a round-trip leg.
            if (line.amount === undefined) {
              return (
                <div
                  key={`${idx}-${line.label}`}
                  className="pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/80"
                >
                  {line.label}
                </div>
              );
            }
            return (
              <div
                key={`${idx}-${line.label}`}
                className={`flex justify-between gap-3${line.indent ? " pl-3" : ""}`}
              >
                <dt className="text-muted">{line.label}</dt>
                <dd className="font-medium tabular-nums">{formatCurrency(line.amount)}</dd>
              </div>
            );
          })
        ) : (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Base</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(priceSummary.basePrice)}</dd>
          </div>
        )}
        {priceSummary.addOns > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Add-ons</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(priceSummary.addOns)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-muted">
            Gratuity {state.gratuity !== "cash" ? `(${state.gratuity}%)` : ""}
          </dt>
          <dd className="font-medium tabular-nums">
            {state.gratuity === "cash" ? "Cash at pickup" : formatCurrency(priceSummary.gratuity)}
          </dd>
        </div>
      </dl>

      <div className="mt-5 border-t border-border pt-4 flex items-center justify-between">
        <span className="font-display text-lg font-semibold text-ink">{priceSummary.priceLabel}</span>
        <span className="font-display text-2xl font-semibold text-ink tabular-nums">
          {priceSummary.total !== null ? formatCurrency(priceSummary.total) : "—"}
        </span>
      </div>

      {/* Only show the "custom quote" message when the booking actually
          needs a manual quote — i.e. 15+ passengers. Generic "no quote yet"
          is communicated by the `Calculating…` routeLabel instead. */}
      {priceSummary.pending && state.passengerGroup === "15+" && (
        <p className="mt-3 rounded-xl border border-sunset/20 bg-sunset/10 px-3 py-2 text-xs text-ink">
          Custom or large group — we&apos;ll reply with a multi-vehicle quote within hours.
        </p>
      )}

      {requiresManualQuote(state.service, addressLookupDegraded) && (
        <p className="mt-3 rounded-xl border border-sunset/20 bg-sunset/10 px-3 py-2 text-xs text-ink leading-relaxed">
          Address search is temporarily unavailable, so we can&apos;t measure
          this route automatically. Finish the form and we&apos;ll confirm your
          addresses and send your fare — no card charged now.
        </p>
      )}

      <p className="mt-4 text-xs text-muted leading-relaxed">
        {requiresManualQuote(state.service, addressLookupDegraded)
          ? `Prefer to book right now? Call us at ${SITE_CONTACT.phoneDisplay} and we'll take it over the phone.`
          : "Payment is securely processed by Stripe at booking. Full refund if you cancel at least 24 hours before pickup."}
      </p>
    </div>
  );

  const ServiceCards = (
    <div role="radiogroup" aria-label="Choose a transportation service" className="grid gap-4 sm:grid-cols-3">
      {BOOKABLE_TRANSPORTATION_SERVICES.map((service, idx) => {
        const isSelected = state.service === service.code;
        return (
          <button
            key={service.code}
            type="button"
            role="radio"
            aria-checked={isSelected}
            ref={idx === 0 ? (el) => { firstFieldRef.current = el; } : undefined}
            onClick={() => {
              setState((current) => {
                // Switching service should reset any flags that only apply to
                // the previous service — otherwise (e.g.) an airport Round
                // Trip choice leaks into Point-to-Point and doubles the
                // total without the user being able to undo it (P2P has no
                // round-trip toggle in its UI). Bug 1 fix.
                const switchingAwayFromAirport =
                  current.service === "airport-transfer" && service.code !== "airport-transfer";
                const switchingAwayFromP2P =
                  current.service === "point-to-point" && service.code !== "point-to-point";
                return {
                  ...current,
                  service: service.code,
                  ...(switchingAwayFromAirport
                    ? { roundTrip: false, meetAndGreet: false }
                    : {}),
                  ...(switchingAwayFromP2P
                    ? { extraStop: false, extraStopDetails: "" }
                    : {}),
                };
              });
              setError("");
              // Auto-advance gives a faster feel; small delay so the user sees their selection.
              window.setTimeout(() => goToStep(2), 250);
            }}
            className={`relative flex flex-col text-left p-6 rounded-2xl border-2 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cream ${
              isSelected
                ? "border-gold bg-gold/5 shadow-md"
                : "border-border bg-white hover:border-ink/40 hover:shadow-sm"
            }`}
          >
            {isSelected && <CheckBadge />}
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-xl mb-4 ${
                isSelected ? "bg-gold text-ink" : "bg-cream text-ink"
              }`}
            >
              {SERVICE_ICONS[service.code]}
            </span>
            <span className="font-display text-lg font-semibold text-ink">{service.title}</span>
            <span className="mt-2 font-sans text-sm text-muted leading-relaxed">{service.description}</span>
          </button>
        );
      })}
    </div>
  );

  /* ── Step content ─────────────────────────────────────── */

  const StepHeader = ({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) => (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{eyebrow}</p>
      <h2 className="mt-2 font-display text-2xl sm:text-3xl font-semibold text-ink leading-tight">
        {title}
      </h2>
      {subtitle && <p className="mt-2 text-sm text-muted leading-relaxed">{subtitle}</p>}
    </div>
  );

  const RequiredMark = () => <span className="text-sunset" aria-hidden="true">*</span>;

  const Step1 = (
    <>
      <StepHeader
        eyebrow="Step 1 of 5"
        title="What kind of ride do you need?"
        subtitle="Pick the option that matches your trip — we’ll only ask the questions that apply."
      />
      {ServiceCards}
    </>
  );

  /** JSX fragment for the passenger / vehicle / luggage / child-seats group.
      Used to be its own step but merged into Step 2 so the wizard reads as
      five steps instead of six. Declared before Step2 so JS init order is
      satisfied (Step2 references it). */
  const PassengersBlock = (
    <>
      {/* Visual divider — separates trip details from "who's riding" without
          needing a whole step. Matches the spacing between other blocks. */}
      <div className="pt-2 border-t border-border/60">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold mt-4">
          Who&apos;s riding
        </p>
      </div>

      <div>
        <span className={labelClass}>Passenger group <RequiredMark /></span>
        <div
          className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2"
          role="radiogroup"
          aria-label="Passenger group"
        >
          {PASSENGER_GROUPS.map((option) => {
            const selected = state.passengerGroup === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => handleField("passengerGroup", option.value)}
                className={`flex flex-col items-center justify-center px-2 py-3 min-h-[64px] rounded-xl border-2 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cream ${
                  selected
                    ? "border-gold bg-gold/10 text-ink"
                    : "border-border bg-white text-muted hover:border-ink/40"
                }`}
              >
                <span className={`text-sm font-semibold leading-tight ${selected ? "text-ink" : "text-ink/85"}`}>
                  {option.label.replace(" passengers", "")}
                </span>
                <span className="mt-0.5 text-[10px] font-normal leading-tight text-muted">
                  passengers
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {shouldShowGroupQuoteMessage(state.passengerGroup) && (
        <div className="rounded-2xl border border-sunset/20 bg-sunset/10 p-4 text-sm text-ink">
          <p className="font-semibold">Groups over 14 passengers</p>
          <p className="mt-1 text-muted">
            Call <a href={SITE_CONTACT.phoneHref} className="text-gold underline">{SITE_CONTACT.phoneDisplay}</a> or finish the form and we&apos;ll quote a multi-vehicle setup.
          </p>
        </div>
      )}

      {state.service !== "point-to-point" && (() => {
        // Distance pill — surfaces the trip length right above the vehicle
        // selector so customers can sanity-check vehicle vs. trip size.
        // Pulls from the same priority order as the mobile sticky bar:
        // live API → cached ref → null (hidden).
        const pillDistance =
          quote.kind === "ok" &&
          quote.data.service === "airport-transfer" &&
          quote.data.vehicle.id === state.vehicleId &&
          typeof quote.data.distanceMiles === "number"
            ? quote.data.distanceMiles
            : lastAirportQuoteRef.current?.airport === state.airport &&
              lastAirportQuoteRef.current?.otherAddressPlaceId === state.otherAddressPlaceId
            ? lastAirportQuoteRef.current.distanceMiles
            : null;
        const pillHours = state.service === "hourly-charter" ? state.hours : null;
        return (
          <div>
            {(pillDistance != null || pillHours != null) && (
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {pillDistance != null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 border border-gold/30 px-3 py-1 text-xs font-semibold text-ink">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {pillDistance.toFixed(1)} mi
                  </span>
                )}
                {pillHours != null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 border border-gold/30 px-3 py-1 text-xs font-semibold text-ink">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
                    </svg>
                    {pillHours} {pillHours === 1 ? "hour" : "hours"}
                  </span>
                )}
              </div>
            )}
            <VehicleSelector
              label="Vehicle"
              description="Choose the vehicle that best fits your group size and luggage."
              vehicles={vehiclesForPassengerCount(passengersFromGroup(state.passengerGroup))}
              selectedId={state.vehicleId}
              onSelect={(vehicleId) => handleField("vehicleId", vehicleId)}
              hours={state.service === "hourly-charter" ? state.hours : undefined}
            />
          </div>
        );
      })()}

      <div className={fieldGroup}>
        <div>
          <span className={labelClass}>Luggage</span>
          <NumberStepper
            value={state.luggageCount}
            min={0}
            max={20}
            ariaLabel="Luggage count"
            onChange={(v) => handleField("luggageCount", v)}
          />
          <p className="mt-2 text-xs text-muted">Bags, suitcases, strollers — give us a ballpark.</p>
        </div>
      </div>

      <ChildSeatSelector
        selected={state.childSeats}
        onChange={(next) => handleField("childSeats", next)}
      />
    </>
  );

  const Step2 = (
    <>
      <StepHeader
        eyebrow="Step 2 of 5"
        title="Trip details"
        subtitle="The fields change with the service you picked. Required fields are marked with an asterisk."
      />

      {state.service === "airport-transfer" && (() => {
        // Derived "trip type" — collapses (airportDirection, roundTrip) into a
        // single mental model the customer picks at the top. Maps back to the
        // underlying state fields so pricing/server validation are unchanged.
        type TripType = "pickup" | "dropoff" | "round-trip";
        const tripType: TripType = state.roundTrip
          ? "round-trip"
          : state.airportDirection === "from-airport"
            ? "pickup"
            : "dropoff";
        const setTripType = (next: TripType) => {
          if (next === "pickup") {
            setState((s) => ({ ...s, airportDirection: "from-airport", roundTrip: false }));
          } else if (next === "dropoff") {
            setState((s) => ({ ...s, airportDirection: "to-airport", roundTrip: false }));
          } else {
            // Round trip — direction is "the first leg arrives", which is
            // typical for travellers visiting the area. Pricing treats both
            // legs the same.
            setState((s) => ({ ...s, airportDirection: "from-airport", roundTrip: true }));
          }
          setError("");
        };

        const tripOptions: Array<{
          value: TripType;
          title: string;
          hint: string;
          icon: React.ReactNode;
        }> = [
          {
            value: "pickup",
            title: "Airport Pickup",
            hint: "We meet you at the airport on arrival.",
            icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1L15 22v-1.5L13 19v-5.5z" />
              </svg>
            ),
          },
          {
            value: "dropoff",
            title: "Airport Drop-off",
            hint: "We pick you up and take you to the airport.",
            icon: (
              <svg className="w-5 h-5 -scale-y-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1L15 22v-1.5L13 19v-5.5z" />
              </svg>
            ),
          },
          {
            value: "round-trip",
            title: "Round Trip",
            hint: "Both legs — arrival pickup AND return drop-off.",
            icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
            ),
          },
        ];

        // Field-label adaptation by trip type
        const addressLabel =
          tripType === "round-trip"
            ? "Your hotel or address"
            : tripType === "pickup"
              ? "Where are we taking you?"
              : "Where are we picking you up?";
        const addressPlaceholder =
          tripType === "round-trip"
            ? "Hotel for your whole stay (e.g. Disney's Grand Californian)"
            : "Hotel, resort, or street address";
        const flightTimeLabel =
          tripType === "round-trip"
            ? "Arrival flight time"
            : tripType === "pickup"
              ? "Flight arrival time"
              : "Flight departure time";
        const flightTimeHint =
          tripType === "round-trip"
            ? "When you arrive — we track delays automatically."
            : tripType === "pickup"
              ? "We track flight delays automatically and adjust pickup."
              : "We'll plan pickup so you arrive comfortably before departure.";

        return (
          <div className="space-y-6">
            {/* 1. Trip type — one decision at the top */}
            <div>
              <span className={labelClass}>What do you need? <RequiredMark /></span>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Airport service type">
                {tripOptions.map((option, idx) => {
                  const selected = tripType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      ref={idx === 0 ? (el) => { firstFieldRef.current = el; } : undefined}
                      onClick={() => setTripType(option.value)}
                      className={`relative flex flex-col items-start gap-3 text-left p-4 rounded-2xl border-2 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cream ${
                        selected
                          ? "border-gold bg-gold/5 shadow-sm"
                          : "border-border bg-white hover:border-ink/40"
                      }`}
                    >
                      <span
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                          selected ? "bg-gold text-ink" : "bg-cream text-ink/70"
                        }`}
                      >
                        {option.icon}
                      </span>
                      <div className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">{option.title}</span>
                        <span className="block text-xs text-muted mt-0.5 leading-snug">{option.hint}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Airport */}
            <div data-error={fieldErrors.airport ? "true" : undefined}>
              <label htmlFor="airport" className={labelClass}>Airport <RequiredMark /></label>
              <select
                id="airport"
                value={state.airport}
                onChange={(e) => handleField("airport", e.target.value)}
                aria-invalid={fieldErrors.airport ? "true" : undefined}
                className={`${inputBase} ${fieldErrors.airport ? "border-red-500 ring-2 ring-red-200" : ""}`}
              >
                {AIRPORT_OPTIONS.map((code) => (
                  <option key={code} value={code}>{airportDisplayName(code)}</option>
                ))}
              </select>
              {fieldErrors.airport && <p className="mt-1.5 text-xs text-red-600" role="alert">{fieldErrors.airport}</p>}
            </div>

            {/* 3. Hotel / non-airport address — Google Places autocomplete
                so customers pick a real, validated address. Place ID is
                captured for future driver-routing use. */}
            <div data-error={fieldErrors["airport-other-address"] ? "true" : undefined}>
              <GoogleAddressAutocomplete
                id="airport-other-address"
                label={addressLabel}
                value={state.otherAddress}
                placeId={state.otherAddressPlaceId}
                onUnavailable={markAddressLookupDegraded}
                forceFallback={addressLookupDegraded}
                placeholder={addressPlaceholder}
                required
                onChange={(picked) => {
                  setState((s) => ({
                    ...s,
                    otherAddress: picked.formattedAddress || picked.name || "",
                    otherAddressPlaceId: picked.placeId,
                  }));
                  clearFieldError("airport-other-address");
                }}
              />
              {fieldErrors["airport-other-address"] && (
                <p className="mt-1.5 text-xs text-red-600" role="alert">{fieldErrors["airport-other-address"]}</p>
              )}
            </div>

            {/* 4. Flight info — airline + flight number (optional helpful info) */}
            <div className={fieldGroup}>
              <div>
                <label htmlFor="airline" className={labelClass}>
                  Airline{tripType === "round-trip" && <span className="font-normal text-muted ml-1">(arrival)</span>}
                </label>
                <input
                  id="airline"
                  value={state.airline}
                  onChange={(e) => handleField("airline", e.target.value)}
                  placeholder="e.g. United, Delta, Southwest"
                  className={inputBase}
                />
              </div>
              <div>
                <label htmlFor="flight-number" className={labelClass}>
                  Flight number{tripType === "round-trip" && <span className="font-normal text-muted ml-1">(arrival)</span>}
                </label>
                <input
                  id="flight-number"
                  value={state.flightNumber}
                  onChange={(e) => handleField("flightNumber", e.target.value)}
                  placeholder="e.g. AA1234"
                  inputMode="text"
                  className={inputBase}
                />
              </div>
            </div>

            {/* 5. Primary flight time */}
            <div data-error={fieldErrors["flight-time"] ? "true" : undefined}>
              <label htmlFor="flight-time" className={labelClass}>
                {flightTimeLabel} <RequiredMark />
              </label>
              <input
                id="flight-time"
                type="datetime-local"
                min={minDateTime}
                value={state.flightTime}
                onChange={(e) => handleField("flightTime", e.target.value)}
                aria-invalid={fieldErrors["flight-time"] ? "true" : undefined}
                className={`${inputBase} ${fieldErrors["flight-time"] ? "border-red-500 ring-2 ring-red-200" : ""}`}
              />
              {fieldErrors["flight-time"] ? (
                <p className="mt-1.5 text-xs text-red-600" role="alert">{fieldErrors["flight-time"]}</p>
              ) : (
                <p className="mt-2 text-xs text-muted">{flightTimeHint}</p>
              )}
            </div>

            {/* 6. Return flight time — round trip only */}
            {tripType === "round-trip" && (
              <div data-error={fieldErrors["return-flight-time"] ? "true" : undefined}>
                <label htmlFor="return-flight-time" className={labelClass}>
                  Return departure time <RequiredMark />
                </label>
                <input
                  id="return-flight-time"
                  type="datetime-local"
                  min={state.flightTime || minDateTime}
                  value={state.returnFlightTime}
                  onChange={(e) => handleField("returnFlightTime", e.target.value)}
                  aria-invalid={fieldErrors["return-flight-time"] ? "true" : undefined}
                  className={`${inputBase} ${fieldErrors["return-flight-time"] ? "border-red-500 ring-2 ring-red-200" : ""}`}
                />
                {fieldErrors["return-flight-time"] ? (
                  <p className="mt-1.5 text-xs text-red-600" role="alert">{fieldErrors["return-flight-time"]}</p>
                ) : (
                  <p className="mt-2 text-xs text-muted">
                    When you fly home — we&apos;ll pick you up and take you back to the airport.
                    Add your return flight number in the notes step if you&apos;d like.
                  </p>
                )}
              </div>
            )}

            {/* 7. Meet & greet — only relevant when we're picking you up at the airport */}
            {(tripType === "pickup" || tripType === "round-trip") && (
              <ToggleRow
                id="meet-greet"
                label="Meet & greet"
                hint="Driver waits inside the terminal with a sign (+$30). Recommended for international arrivals and families."
                checked={state.meetAndGreet}
                onChange={(v) => handleField("meetAndGreet", v)}
              />
            )}
          </div>
        );
      })()}

      {state.service === "point-to-point" && (() => {
        const passengerCount = passengersFromGroup(state.passengerGroup);
        const eligibleVehicles = vehiclesForPassengerCount(passengerCount);
        return (
          <div className="space-y-6">
            {/* How many passengers — surfaced on Step 2 because it directly
                affects the live quote and which vehicles are eligible. Mirrors
                the same state.passengerGroup that Step 3 also edits. */}
            <div>
              <span className={labelClass}>How many passengers? <RequiredMark /></span>
              <div
                className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2"
                role="radiogroup"
                aria-label="Passenger group"
              >
                {PASSENGER_GROUPS.map((option) => {
                  const selected = state.passengerGroup === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => handleField("passengerGroup", option.value)}
                      className={`flex flex-col items-center justify-center px-2 py-3 min-h-[60px] rounded-xl border-2 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cream ${
                        selected
                          ? "border-gold bg-gold/10 text-ink"
                          : "border-border bg-white text-muted hover:border-ink/40"
                      }`}
                    >
                      <span className={`text-sm font-semibold leading-tight ${selected ? "text-ink" : "text-ink/85"}`}>
                        {option.label.replace(" passengers", "")}
                      </span>
                      <span className="mt-0.5 text-[10px] font-normal leading-tight text-muted">
                        passengers
                      </span>
                    </button>
                  );
                })}
              </div>
              {state.passengerGroup === "15+" && (
                <p className="mt-2 text-xs text-sunset" role="alert">
                  Groups of 15+ are quoted manually — finish the form and we&apos;ll reply with a multi-vehicle quote.
                </p>
              )}
            </div>


            <div className="grid gap-4">
              <div data-error={fieldErrors["pickup-address-p2p"] ? "true" : undefined}>
                <GoogleAddressAutocomplete
                  id="pickup-address-p2p"
                  label="Pickup address"
                  value={state.pickupAddress}
                  placeId={state.pickupPlaceId}
                  onUnavailable={markAddressLookupDegraded}
                  forceFallback={addressLookupDegraded}
                  required
                  placeholder={`Start typing — we'll only show locations within ${SERVICE_RADIUS_MILES} miles of our home base.`}
                  inputRef={(el) => { firstFieldRef.current = el; }}
                  onChange={(picked) => {
                    setState((s) => ({
                      ...s,
                      pickupAddress: picked.formattedAddress || picked.name || "",
                      pickupPlaceId: picked.placeId,
                    }));
                    clearFieldError("pickup-address-p2p");
                  }}
                />
                {fieldErrors["pickup-address-p2p"] && (
                  <p className="mt-1.5 text-xs text-red-600" role="alert">{fieldErrors["pickup-address-p2p"]}</p>
                )}
                {quote.kind === "error" && (quote.offending === "pickup" || quote.offending === "both") && (
                  <p className="mt-2 text-xs text-red-600" role="alert">{quote.message}</p>
                )}
              </div>
              <div data-error={fieldErrors["dropoff-address-p2p"] ? "true" : undefined}>
                <GoogleAddressAutocomplete
                  id="dropoff-address-p2p"
                  label="Drop-off address"
                  value={state.dropoffAddress}
                  placeId={state.dropoffPlaceId}
                  onUnavailable={markAddressLookupDegraded}
                  forceFallback={addressLookupDegraded}
                  required
                  placeholder={`Destination — must also be within ${SERVICE_RADIUS_MILES} miles of our home base.`}
                  onChange={(picked) => {
                    setState((s) => ({
                      ...s,
                      dropoffAddress: picked.formattedAddress || picked.name || "",
                      dropoffPlaceId: picked.placeId,
                    }));
                    clearFieldError("dropoff-address-p2p");
                  }}
                />
                {fieldErrors["dropoff-address-p2p"] && (
                  <p className="mt-1.5 text-xs text-red-600" role="alert">{fieldErrors["dropoff-address-p2p"]}</p>
                )}
                {quote.kind === "error" && (quote.offending === "dropoff" || quote.offending === "both") && (
                  <p className="mt-2 text-xs text-red-600" role="alert">{quote.message}</p>
                )}
              </div>
            </div>
            {quote.kind === "error" && (quote.offending === "pickup" || quote.offending === "dropoff" || quote.offending === "both") && (
              <div className="mt-4 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                <p>{quote.message}</p>
                <a
                  href={SITE_CONTACT.phoneHref}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                >
                  Call {SITE_CONTACT.phoneDisplay}
                </a>
              </div>
            )}

            <VehicleSelector
              label="Vehicle"
              description="Choose the vehicle for this trip."
              vehicles={eligibleVehicles}
              selectedId={state.vehicleId}
              onSelect={(vehicleId) => handleField("vehicleId", vehicleId)}
              distanceMiles={quote.kind === "ok" ? quote.data.distanceMiles ?? undefined : undefined}
            />

            <div className={fieldGroup}>
              <div data-error={fieldErrors["pickup-time-p2p"] ? "true" : undefined}>
                <label htmlFor="pickup-time-p2p" className={labelClass}>Pickup date and time <RequiredMark /></label>
                <input
                  id="pickup-time-p2p"
                  type="datetime-local"
                  min={minDateTime}
                  value={state.pickupDateTime}
                  onChange={(e) => handleField("pickupDateTime", e.target.value)}
                  aria-invalid={fieldErrors["pickup-time-p2p"] ? "true" : undefined}
                  className={`${inputBase} ${fieldErrors["pickup-time-p2p"] ? "border-red-500 ring-2 ring-red-200" : ""}`}
                />
                {fieldErrors["pickup-time-p2p"] && (
                  <p className="mt-1.5 text-xs text-red-600" role="alert">{fieldErrors["pickup-time-p2p"]}</p>
                )}
              </div>
              <ToggleRow
                id="extra-stop"
                label="Add an extra stop"
                hint="Quick errand or pickup along the way (+$20)."
                checked={state.extraStop}
                onChange={(v) => handleField("extraStop", v)}
              />
            </div>

            {state.extraStop && (
              <div>
                <label htmlFor="extra-stop-details" className={labelClass}>Extra stop details</label>
                <input
                  id="extra-stop-details"
                  value={state.extraStopDetails}
                  onChange={(e) => handleField("extraStopDetails", e.target.value)}
                  placeholder="Address or instructions"
                  className={inputBase}
                />
              </div>
            )}

          </div>
        );
      })()}

      {state.service === "hourly-charter" && (
        <div className="space-y-6">
          <div className={fieldGroup}>
            {/* Pickup address — same Google Places autocomplete wrapper as P2P
                so the styling stays consistent (white background, dark text). */}
            <div data-error={fieldErrors["pickup-address-charter"] ? "true" : undefined}>
              <GoogleAddressAutocomplete
                id="pickup-address-charter"
                label="Pickup address"
                value={state.pickupAddress}
                placeId={state.pickupPlaceId}
                onUnavailable={markAddressLookupDegraded}
                forceFallback={addressLookupDegraded}
                placeholder="Hotel, event venue, or address"
                required
                inputRef={(el) => { firstFieldRef.current = el; }}
                onChange={(picked) => {
                  setState((s) => ({
                    ...s,
                    pickupAddress: picked.formattedAddress || picked.name || "",
                    pickupPlaceId: picked.placeId,
                  }));
                  clearFieldError("pickup-address-charter");
                }}
              />
              {fieldErrors["pickup-address-charter"] && (
                <p className="mt-1.5 text-xs text-red-600" role="alert">{fieldErrors["pickup-address-charter"]}</p>
              )}
            </div>
            <div data-error={fieldErrors["pickup-time-charter"] ? "true" : undefined}>
              <label htmlFor="pickup-time-charter" className={labelClass}>Pickup date and time <RequiredMark /></label>
              <input
                id="pickup-time-charter"
                type="datetime-local"
                min={minDateTime}
                value={state.pickupDateTime}
                onChange={(e) => handleField("pickupDateTime", e.target.value)}
                aria-invalid={fieldErrors["pickup-time-charter"] ? "true" : undefined}
                className={`${inputBase} ${fieldErrors["pickup-time-charter"] ? "border-red-500 ring-2 ring-red-200" : ""}`}
              />
              {fieldErrors["pickup-time-charter"] && (
                <p className="mt-1.5 text-xs text-red-600" role="alert">{fieldErrors["pickup-time-charter"]}</p>
              )}
            </div>
          </div>

          <div className={fieldGroup}>
            <div>
              <span className={labelClass}>Hours <RequiredMark /></span>
              {(() => {
                const tierMin = minHoursFor(state.vehicleId || state.passengerGroup);
                const billed = Math.max(tierMin, state.hours);
                const hourlyRate =
                  HOURLY_VEHICLE_RATES[state.vehicleId as keyof typeof HOURLY_VEHICLE_RATES] ??
                  HOURLY_RATES[state.passengerGroup as keyof typeof HOURLY_RATES] ??
                  0;
                return (
                  <>
                    <NumberStepper
                      value={Math.max(tierMin, state.hours)}
                      min={tierMin}
                      max={12}
                      ariaLabel="Number of hours"
                      onChange={(v) => handleField("hours", v)}
                    />
                    <p className="mt-2 text-xs text-muted">
                      {tierMin}-hour minimum. Longer days fine — we’ll plan stops with you. Unlimited miles within Greater LA &amp; Orange County.
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      ${hourlyRate}/hr × {billed} hours = {formatCurrency(hourlyRate * billed)}
                    </p>
                  </>
                );
              })()}
            </div>
            <div>
              <label htmlFor="planned-stops" className={labelClass}>Planned stops or notes</label>
              <input
                id="planned-stops"
                value={state.plannedStops}
                onChange={(e) => handleField("plannedStops", e.target.value)}
                placeholder="e.g. Disneyland, beach, dinner reservation"
                className={inputBase}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-cream/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Hourly rates</p>
            <ul className="mt-3 grid gap-1.5 text-sm text-ink sm:grid-cols-2">
              {Object.entries(HOURLY_RATES).map(([group, rate]) => (
                <li key={group} className="flex justify-between gap-3">
                  <span>{group} passengers <span className="text-muted text-xs">({minHoursFor(group)}-hr min)</span></span>
                  <span className="font-medium tabular-nums">{formatCurrency(rate)}/hr</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {PassengersBlock}
    </>
  );

  const Step4 = (
    <>
      <StepHeader
        eyebrow="Step 3 of 5"
        title="Your contact info"
        subtitle="So we can reach you with confirmation and pickup details."
      />

      <div className={fieldGroup}>
        <div data-error={fieldErrors.firstName ? "true" : undefined}>
          <label htmlFor="firstName" className={labelClass}>First name <RequiredMark /></label>
          <input
            id="firstName"
            value={state.firstName}
            onChange={(e) => handleField("firstName", e.target.value)}
            autoComplete="given-name"
            aria-invalid={fieldErrors.firstName ? "true" : undefined}
            className={`${inputBase} ${fieldErrors.firstName ? "border-red-500 ring-2 ring-red-200" : ""}`}
            ref={(el) => { firstFieldRef.current = el; }}
          />
          {fieldErrors.firstName && <p className="mt-1.5 text-xs text-red-600" role="alert">{fieldErrors.firstName}</p>}
        </div>
        <div data-error={fieldErrors.lastName ? "true" : undefined}>
          <label htmlFor="lastName" className={labelClass}>Last name <RequiredMark /></label>
          <input
            id="lastName"
            value={state.lastName}
            onChange={(e) => handleField("lastName", e.target.value)}
            autoComplete="family-name"
            aria-invalid={fieldErrors.lastName ? "true" : undefined}
            className={`${inputBase} ${fieldErrors.lastName ? "border-red-500 ring-2 ring-red-200" : ""}`}
          />
          {fieldErrors.lastName && <p className="mt-1.5 text-xs text-red-600" role="alert">{fieldErrors.lastName}</p>}
        </div>
      </div>

      <div className={fieldGroup}>
        <div data-error={fieldErrors.email ? "true" : undefined}>
          <label htmlFor="email" className={labelClass}>Email <RequiredMark /></label>
          <input
            id="email"
            type="email"
            value={state.email}
            onChange={(e) => handleField("email", e.target.value)}
            autoComplete="email"
            inputMode="email"
            aria-invalid={fieldErrors.email ? "true" : undefined}
            className={`${inputBase} ${fieldErrors.email ? "border-red-500 ring-2 ring-red-200" : ""}`}
          />
          {fieldErrors.email && <p className="mt-1.5 text-xs text-red-600" role="alert">{fieldErrors.email}</p>}
        </div>
        <div data-error={fieldErrors.phone ? "true" : undefined}>
          <label htmlFor="phone" className={labelClass}>Phone <RequiredMark /></label>
          <input
            id="phone"
            type="tel"
            value={state.phone}
            onChange={(e) => handleField("phone", e.target.value)}
            autoComplete="tel"
            inputMode="tel"
            placeholder="+1 (714) 555-0100"
            aria-invalid={fieldErrors.phone ? "true" : undefined}
            className={`${inputBase} ${fieldErrors.phone ? "border-red-500 ring-2 ring-red-200" : ""}`}
          />
          {fieldErrors.phone && <p className="mt-1.5 text-xs text-red-600" role="alert">{fieldErrors.phone}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>Anything else we should know?</label>
        <textarea
          id="notes"
          value={state.notes}
          onChange={(e) => handleField("notes", e.target.value)}
          rows={4}
          placeholder="Pickup instructions, hotel name, mobility needs, special requests…"
          className={`${inputBase} resize-y min-h-[120px]`}
        />
      </div>
    </>
  );

  const Step5 = (
    <>
      <StepHeader
        eyebrow="Step 4 of 5"
        title="Review your booking"
        subtitle="Take a quick look. You can jump back to any step from the progress bar above."
      />

      <div className="grid gap-6">
        <ReviewBlock
          title="Service"
          onEdit={() => goToStep(1)}
          rows={[{ label: "Type", value: state.service ? SERVICE_LABELS[state.service] : "—" }]}
        />

        {state.service === "airport-transfer" && (
          <ReviewBlock
            title="Trip"
            onEdit={() => goToStep(2)}
            rows={[
              {
                label: "Service",
                value: state.roundTrip
                  ? "Round trip (pickup + drop-off)"
                  : state.airportDirection === "from-airport"
                    ? "Airport pickup (arrival)"
                    : "Airport drop-off (departure)",
              },
              { label: "Airport", value: airportDisplayName(state.airport) },
              {
                label: state.roundTrip
                  ? "Hotel / address"
                  : state.airportDirection === "from-airport"
                    ? "Drop-off"
                    : "Pickup",
                value: state.otherAddress || "—",
              },
              { label: "Flight", value: `${state.airline || "—"} · ${state.flightNumber || "—"}` },
              {
                label: state.roundTrip
                  ? "Arrival"
                  : state.airportDirection === "from-airport"
                    ? "Arrival"
                    : "Departure",
                value: formatHumanDateTime(state.flightTime),
              },
              ...(state.roundTrip
                ? [{ label: "Return departure", value: formatHumanDateTime(state.returnFlightTime) }]
                : []),
              ...(state.airportDirection === "from-airport" || state.roundTrip
                ? [{ label: "Meet & greet", value: state.meetAndGreet ? "Yes (+$30)" : "No" }]
                : []),
            ]}
          />
        )}
        {state.service === "point-to-point" && (
          <ReviewBlock
            title="Trip"
            onEdit={() => goToStep(2)}
            rows={[
              { label: "Pickup", value: state.pickupAddress || "—" },
              { label: "Drop-off", value: state.dropoffAddress || "—" },
              { label: "Pickup time", value: formatHumanDateTime(state.pickupDateTime) },
              { label: "Extra stop", value: state.extraStop ? state.extraStopDetails || "Yes" : "No" },
            ]}
          />
        )}
        {state.service === "hourly-charter" && (
          <ReviewBlock
            title="Trip"
            onEdit={() => goToStep(2)}
            rows={[
              { label: "Pickup", value: state.pickupAddress || "—" },
              { label: "Pickup time", value: formatHumanDateTime(state.pickupDateTime) },
              { label: "Hours", value: `${state.hours} hours` },
              { label: "Planned stops", value: state.plannedStops || "—" },
            ]}
          />
        )}

        <ReviewBlock
          title="Passengers"
          // Passengers / vehicle / luggage live at the bottom of Step 2 since
          // the merge — editing jumps back to step 2 rather than the old step 3.
          onEdit={() => goToStep(2)}
          rows={[
            { label: "Group", value: PASSENGER_GROUPS.find((p) => p.value === state.passengerGroup)?.label ?? "—" },
            { label: "Vehicle", value: VEHICLES.find((v) => v.id === state.vehicleId)?.name ?? "Standard" },
            { label: "Luggage", value: String(state.luggageCount) },
            {
              label: "Child seats",
              value: state.childSeats.length
                ? state.childSeats.map((s) => CHILD_SEAT_OPTIONS.find((o) => o.value === s)?.label ?? s).join(", ")
                : "None",
            },
          ]}
        />

        <ReviewBlock
          title="Contact"
          onEdit={() => goToStep(3)}
          rows={[
            { label: "Name", value: `${state.firstName} ${state.lastName}`.trim() || "—" },
            { label: "Email", value: state.email || "—" },
            { label: "Phone", value: state.phone || "—" },
            ...(state.notes ? [{ label: "Notes", value: state.notes }] : []),
          ]}
        />

        {/* Gratuity — collapsed by default so the Review reads as confirmation
            rather than another decision. 20% is the pre-selected default
            (`INITIAL_STATE.gratuity`); the tier picker only opens when the
            user taps "Change". */}
        {(() => {
          const subtotal = (priceSummary.basePrice ?? 0) + priceSummary.addOns;
          const currentLabel =
            GRATUITY_OPTIONS.find((o) => o.value === state.gratuity)?.label ?? "20%";
          const currentAmount =
            state.gratuity === "cash"
              ? "Paid to driver"
              : subtotal > 0
                ? formatCurrency(Math.round(subtotal * (Number(state.gratuity) / 100)))
                : null;

          return (
            <div className="rounded-2xl border border-border bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Gratuity
                  </p>
                  <p className="mt-1 font-sans text-sm text-ink">
                    <span className="font-semibold">{currentLabel}</span>
                    {currentAmount && (
                      <span className="text-muted"> · {currentAmount}</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGratuityPicker((v) => !v)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink/60 transition-colors cursor-pointer"
                  aria-expanded={showGratuityPicker}
                  aria-controls="gratuity-picker"
                >
                  {showGratuityPicker ? "Done" : "Change"}
                </button>
              </div>

              {showGratuityPicker && (
                <div
                  id="gratuity-picker"
                  className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2"
                  role="radiogroup"
                  aria-label="Gratuity amount"
                >
                  {GRATUITY_OPTIONS.map((option) => {
                    const selected = state.gratuity === option.value;
                    const previewLabel =
                      option.value === "cash"
                        ? "Paid to driver"
                        : subtotal > 0
                          ? formatCurrency(
                              Math.round(subtotal * (Number(option.value) / 100)),
                            )
                          : null;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => handleField("gratuity", option.value)}
                        className={`relative flex flex-col items-center justify-center px-3 py-3 min-h-[68px] rounded-xl border-2 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cream ${
                          selected
                            ? "border-gold bg-gold/10"
                            : "border-border bg-white hover:border-ink/40"
                        }`}
                      >
                        <span
                          className={`text-sm font-semibold ${
                            selected ? "text-ink" : "text-ink/85"
                          }`}
                        >
                          {option.label}
                        </span>
                        {previewLabel && (
                          <span
                            className={`mt-1 text-xs tabular-nums ${
                              selected ? "text-ink/70" : "text-muted"
                            }`}
                          >
                            {previewLabel}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="mt-3 text-xs text-muted">
                Gratuity is included in your estimated total above (except &ldquo;cash at pickup&rdquo;, which you hand to the driver).
              </p>
            </div>
          );
        })()}
      </div>
    </>
  );

  const Step6 = (
    <>
      <StepHeader
        eyebrow="Last step"
        title="Confirm and pay"
        subtitle={
          priceSummary.total !== null
            ? "Review your booking, then continue to secure checkout. Card is charged in full at booking; full refund if you cancel up to 24 hours before pickup."
            : addressLookupDegraded
              ? "Address search is temporarily unavailable, so we're quoting this one by hand — we'll receive your details and reply with your fare, no card required at this step."
              : "Group sizes 15+ are quoted manually — we'll receive your details and reply with a quote, no card required at this step."
        }
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_4px_16px_-6px_rgba(12,11,10,0.08)]">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Service</p>
              <p className="mt-1 font-display text-xl font-semibold text-ink leading-tight">
                {state.service ? SERVICE_LABELS[state.service] : "—"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                {priceSummary.total !== null ? "Total" : "Estimated total"}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-ink tabular-nums">
                {priceSummary.total !== null ? formatCurrency(priceSummary.total) : "Quote pending"}
              </p>
            </div>
          </div>

          {/* Key trip details — gives the customer a moment of certainty
              before they leave the page for Stripe. */}
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
            <SummaryRow
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path strokeLinecap="round" d="M3 9h18M8 3v4M16 3v4" />
                </svg>
              }
              label="Pickup"
              value={
                state.service === "airport-transfer"
                  ? formatHumanDateTime(state.flightTime)
                  : formatHumanDateTime(state.pickupDateTime)
              }
            />
            <SummaryRow
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              label="Passengers"
              value={
                PASSENGER_GROUPS.find((p) => p.value === state.passengerGroup)?.label ?? "—"
              }
            />
            {(() => {
              // Vehicle + distance summary — last-mile reassurance that the
              // selected class and trip length match what the customer expects.
              const v = getVehicle(state.vehicleId);
              const dist =
                quote.kind === "ok" &&
                quote.data.vehicle.id === state.vehicleId &&
                typeof quote.data.distanceMiles === "number"
                  ? quote.data.distanceMiles
                  : state.service === "airport-transfer"
                    ? lastAirportQuoteRef.current?.airport === state.airport &&
                      lastAirportQuoteRef.current?.otherAddressPlaceId === state.otherAddressPlaceId
                      ? lastAirportQuoteRef.current.distanceMiles
                      : null
                    : state.service === "point-to-point"
                      ? lastP2PQuoteRef.current?.pickupPlaceId === state.pickupPlaceId &&
                        lastP2PQuoteRef.current?.dropoffPlaceId === state.dropoffPlaceId
                        ? lastP2PQuoteRef.current.distanceMiles
                        : null
                      : null;
              const vehicleValue = state.service === "hourly-charter"
                ? `${v?.name ?? "Standard"} · ${state.hours} hr`
                : dist != null
                  ? `${v?.name ?? "Standard"} · ${dist.toFixed(1)} mi`
                  : v?.name ?? "Standard";
              return (
                <SummaryRow
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l2-7h14l2 7M5 13h14m-14 0v6a1 1 0 001 1h2a1 1 0 001-1v-2h8v2a1 1 0 001 1h2a1 1 0 001-1v-6" />
                      <circle cx="8" cy="16" r="1.4" fill="currentColor" />
                      <circle cx="16" cy="16" r="1.4" fill="currentColor" />
                    </svg>
                  }
                  label="Vehicle"
                  value={vehicleValue}
                />
              );
            })()}
            {priceSummary.routeLabel && (
              <SummaryRow
                icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
                label="Route"
                value={priceSummary.routeLabel}
                wide
              />
            )}
            <SummaryRow
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14v3m-2 0h4M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              }
              label="Contact"
              value={`${state.firstName} ${state.lastName} · ${state.email}`}
              wide
            />
          </dl>

          <button
            type="button"
            onClick={() => goToStep(4)}
            className="mt-4 inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-muted hover:text-ink transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit details
          </button>
        </div>

        {submitStatus === "success" ? (
          <motion.div
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-900"
            role="status"
          >
            <p className="font-semibold">Quote request received.</p>
            <p className="mt-1 text-green-800/90">
              Thank you, {state.firstName}! We&apos;ll reply shortly to <span className="font-medium">{state.email}</span> with
              a custom quote for your group.
            </p>
            <p className="mt-3 text-xs text-green-800/80">
              Need to reach us right now? Call{" "}
              <a className="underline" href={SITE_CONTACT.phoneHref}>{SITE_CONTACT.phoneDisplay}</a>.
            </p>
          </motion.div>
        ) : (
          <>
            <motion.button
              type="submit"
              disabled={submitStatus === "sending"}
              whileTap={submitStatus === "idle" || submitStatus === "error" ? { scale: 0.98 } : undefined}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className={`${buttonPrimary} w-full sm:w-auto`}
            >
              <AnimatePresence mode="wait" initial={false}>
                {submitStatus === "sending" ? (
                  <motion.span
                    key="sending"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="inline-flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    {priceSummary.total !== null ? "Redirecting to checkout…" : "Sending…"}
                  </motion.span>
                ) : (
                  <motion.span
                    key="default"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="inline-flex items-center gap-2"
                  >
                    {priceSummary.total !== null
                      ? `Continue to secure checkout · ${formatCurrency(priceSummary.total)}`
                      : "Request a quote"}
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
            {priceSummary.total !== null && (
              <p className="text-xs text-muted leading-relaxed inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-muted/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                Secure payment by Stripe. Full refund if cancelled at least 24 hours before pickup.
              </p>
            )}
            <AnimatePresence>
              {submitStatus === "error" && (
                <motion.p
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -6 }}
                  animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="rounded-2xl border border-sunset/20 bg-sunset/10 p-4 text-sm text-ink"
                  role="alert"
                >
                  {error || "Something went wrong. Please try again, or"} email{" "}
                  <a className="underline" href={`mailto:${SITE_CONTACT.email}`}>{SITE_CONTACT.email}</a> or call{" "}
                  <a className="underline" href={SITE_CONTACT.phoneHref}>{SITE_CONTACT.phoneDisplay}</a>.
                </motion.p>
              )}
            </AnimatePresence>
            <p className="text-xs text-muted leading-relaxed">
              By continuing you agree to TNT Tours&apos; terms. Your card is processed securely by Stripe; we never store
              card details.
            </p>
          </>
        )}
      </form>
    </>
  );

  /* ── Layout ───────────────────────────────────────────── */

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-8 lg:px-12 pt-12 pb-36 lg:pb-20">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-gold/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
          Transportation booking
        </span>
        <h1 className="mt-5 font-display text-3xl sm:text-4xl md:text-5xl font-semibold text-ink leading-tight">
          Book your ride in five quick steps.
        </h1>
        <p className="mt-4 text-sm sm:text-base text-muted leading-relaxed">
          Airport transfers, point-to-point trips, and hourly charters across Anaheim, Orange County, and Los Angeles.
        </p>
      </div>

      <div ref={stepHeaderRef} />

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-border bg-white shadow-sm p-5 sm:p-8">
          {ProgressBar}

          {/* One-shot pill confirming we restored a saved draft. Auto-hides
              ~4.5 s after mount via the timer in the restore effect. */}
          <AnimatePresence>
            {draftRestored && (
              <motion.div
                key="draft-restored"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-ink"
                role="status"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Picked up where you left off
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.div
                key={error}
                role="alert"
                aria-live="polite"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, x: 0 }}
                animate={
                  reducedMotion
                    ? { opacity: 1 }
                    : { opacity: 1, y: 0, x: [0, -5, 5, -3, 3, 0] }
                }
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="mb-5 flex items-start gap-3 rounded-xl border-2 border-red-500 bg-red-50 p-4 text-sm font-medium text-red-700"
              >
                <svg className="w-5 h-5 shrink-0 text-red-600 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
                </svg>
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait" custom={stepDirection} initial={false}>
              <motion.div
                key={step}
                custom={stepDirection}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: stepDirection * 28 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: stepDirection * -28 }}
                transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
              >
                {/* Step3 (Passengers) was merged into Step2 — see PassengersBlock. */}
                {step === 1 && Step1}
                {step === 2 && Step2}
                {step === 3 && Step4}
                {step === 4 && Step5}
                {step === 5 && Step6}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Desktop / inline navigation (hide on mobile — sticky bottom takes over) */}
          {step < TOTAL_STEPS && (
            <div className="mt-10 hidden sm:flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={step === 1}
                className={`${buttonSecondary} ${step === 1 ? "invisible" : ""}`}
              >
                ← Back
              </button>
              <button type="button" onClick={handleNext} className={buttonPrimary}>
                Continue →
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* The mobile/tablet sticky pricing bar lives at the bottom of the
              page (after </aside>) — a single bar covers all sub-lg widths
              so it doesn't double up with another sticky element here. */}
        </div>

        <aside className="hidden lg:block">
          <div className="lg:sticky lg:top-28 space-y-4">
            {PriceSummary}
            <div className="rounded-2xl border border-border bg-cream p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Need help?</p>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Talk to a real human — we answer fast on weekdays.
              </p>
              <a href={SITE_CONTACT.phoneHref} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-ink hover:text-gold transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" />
                </svg>
                {SITE_CONTACT.phoneDisplay}
              </a>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile / tablet sticky pricing bar — visible on all viewports below
          `lg` (where the desktop sidebar takes over). Shows total + the
          context line (vehicle · distance · gratuity treatment) so the
          customer knows what they're paying for at a glance. */}
      {step < TOTAL_STEPS && (() => {
        const stickyVehicle = getVehicle(state.vehicleId);
        const stickyDistance = ((): number | null => {
          if (state.service === "airport-transfer") {
            if (
              quote.kind === "ok" &&
              quote.data.service === "airport-transfer" &&
              quote.data.vehicle.id === state.vehicleId &&
              typeof quote.data.distanceMiles === "number"
            ) {
              return quote.data.distanceMiles;
            }
            if (
              lastAirportQuoteRef.current?.airport === state.airport &&
              lastAirportQuoteRef.current?.otherAddressPlaceId === state.otherAddressPlaceId
            ) {
              return lastAirportQuoteRef.current.distanceMiles;
            }
            return null;
          }
          if (state.service === "point-to-point") {
            if (
              quote.kind === "ok" &&
              quote.data.service === "point-to-point" &&
              quote.data.vehicle.id === state.vehicleId &&
              typeof quote.data.distanceMiles === "number"
            ) {
              return quote.data.distanceMiles;
            }
            if (
              lastP2PQuoteRef.current?.pickupPlaceId === state.pickupPlaceId &&
              lastP2PQuoteRef.current?.dropoffPlaceId === state.dropoffPlaceId
            ) {
              return lastP2PQuoteRef.current.distanceMiles;
            }
            return null;
          }
          return null;
        })();
        const stickyContextParts: string[] = [];
        if (stickyVehicle?.name) stickyContextParts.push(stickyVehicle.name);
        if (state.service === "hourly-charter") {
          stickyContextParts.push(`${state.hours} hr`);
        } else if (stickyDistance != null) {
          stickyContextParts.push(`${stickyDistance.toFixed(1)} mi`);
        }
        stickyContextParts.push(
          state.gratuity === "cash" ? "Gratuity at pickup" : "Includes gratuity",
        );
        const stickyContext = stickyContextParts.join(" · ");

        return (
          <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(12,11,10,0.08)]">
            {/* "Why this price?" expandable drawer — slides up above the bar
                when the customer taps the price area. Shows whatever the
                desktop summary shows (Base / Mileage / Airport fee per leg,
                then Add-ons, Gratuity, Total). */}
            {showStickyBreakdown && (
              <div
                id="sticky-breakdown-drawer"
                className="max-w-2xl mx-auto px-4 pt-4 pb-3 border-b border-border/40 max-h-[60vh] overflow-y-auto"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold mb-2">
                  Why this price?
                </p>
                <dl className="space-y-2 text-sm text-ink">
                  {priceSummary.breakdown && priceSummary.breakdown.length > 0 ? (
                    priceSummary.breakdown.map((line, idx) => {
                      if (line.amount === undefined) {
                        return (
                          <div
                            key={`${idx}-${line.label}`}
                            className="pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/80"
                          >
                            {line.label}
                          </div>
                        );
                      }
                      return (
                        <div
                          key={`${idx}-${line.label}`}
                          className={`flex justify-between gap-3${line.indent ? " pl-3" : ""}`}
                        >
                          <dt className="text-muted">{line.label}</dt>
                          <dd className="font-medium tabular-nums">{formatCurrency(line.amount)}</dd>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Base</dt>
                      <dd className="font-medium tabular-nums">{formatCurrency(priceSummary.basePrice)}</dd>
                    </div>
                  )}
                  {priceSummary.addOns > 0 && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Add-ons</dt>
                      <dd className="font-medium tabular-nums">{formatCurrency(priceSummary.addOns)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">
                      Gratuity {state.gratuity !== "cash" ? `(${state.gratuity}%)` : ""}
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {state.gratuity === "cash" ? "Cash at pickup" : formatCurrency(priceSummary.gratuity)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 pt-2 mt-2 border-t border-border/60">
                    <dt className="font-semibold text-ink">
                      {priceSummary.priceLabel || "Total"}
                    </dt>
                    <dd className="font-display font-semibold text-ink tabular-nums">
                      {priceSummary.total !== null ? formatCurrency(priceSummary.total) : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
              {/* Price section is a button — tap to open the breakdown drawer.
                  Aria-expanded + aria-controls so screen readers announce
                  the disclosure correctly. */}
              <button
                type="button"
                onClick={() => setShowStickyBreakdown((v) => !v)}
                aria-expanded={showStickyBreakdown}
                aria-controls="sticky-breakdown-drawer"
                className="group min-w-0 flex-1 text-left -my-1 -ml-1 py-1 pl-1 pr-2 rounded-lg active:bg-gold/5 transition-colors cursor-pointer"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted leading-none flex items-center gap-1">
                  {priceSummary.priceLabel || "Estimated total"}
                  <svg
                    className={`w-3 h-3 text-muted transition-transform ${showStickyBreakdown ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </p>
                <p
                  className={`font-display text-xl font-semibold text-ink tabular-nums leading-tight transition-opacity duration-200 ${
                    priceSummary.pending ? "opacity-60" : "opacity-100"
                  }`}
                >
                  {priceSummary.total !== null ? formatCurrency(priceSummary.total) : "—"}
                </p>
                <p className="mt-0.5 text-[11px] text-muted leading-snug truncate">
                  {stickyContext}
                </p>
              </button>
              <div className="flex gap-2 shrink-0">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-4 py-3 rounded-full border border-border bg-white text-sm font-semibold text-ink min-h-[44px] active:scale-[0.96] transition-transform"
                    aria-label="Go back to previous step"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                {/* Inline phone CTA — escape hatch for customers who'd rather
                    book by voice. Visible only on phone widths to save space. */}
                <a
                  href={SITE_CONTACT.phoneHref}
                  className="sm:hidden inline-flex items-center justify-center px-4 py-3 rounded-full border border-border bg-white text-sm font-semibold text-ink min-h-[44px] active:scale-[0.96] transition-transform"
                  aria-label={`Call ${SITE_CONTACT.phoneDisplay} to book by phone`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" />
                  </svg>
                </a>
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full bg-ink text-white text-sm font-semibold min-h-[44px] active:scale-[0.96] transition-transform"
                >
                  {step === 4 ? "Confirm" : "Continue"}
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.6} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}

/* ── Sub components ──────────────────────────────────────── */

interface ToggleRowProps {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ToggleRow({ id, label, hint, checked, onChange }: ToggleRowProps) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition min-h-[60px] ${
        checked ? "border-gold bg-gold/5" : "border-border bg-white hover:border-ink/40"
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border text-gold focus:ring-gold"
      />
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

interface NumberStepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}

function NumberStepper({ value, min, max, onChange, ariaLabel }: NumberStepperProps) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <div className="inline-flex items-center rounded-xl border border-border bg-white p-1" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="Decrease"
        className="w-10 h-10 flex items-center justify-center rounded-lg text-ink disabled:text-muted/50 hover:bg-cream cursor-pointer disabled:cursor-not-allowed"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
        className="w-16 text-center font-semibold tabular-nums bg-transparent outline-none text-ink"
        aria-label={ariaLabel}
      />
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        aria-label="Increase"
        className="w-10 h-10 flex items-center justify-center rounded-lg text-ink disabled:text-muted/50 hover:bg-cream cursor-pointer disabled:cursor-not-allowed"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}

interface ReviewBlockProps {
  title: string;
  rows: { label: string; value: string }[];
  onEdit: () => void;
}

function ReviewBlock({ title, rows, onEdit }: ReviewBlockProps) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-semibold text-ink underline underline-offset-2 hover:text-gold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 rounded"
        >
          Edit
        </button>
      </div>
      <dl className="grid gap-2.5 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="text-muted">{row.label}</dt>
            <dd className="text-ink text-right max-w-[60%] break-words">{row.value || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Compact icon + label/value row used in the final confirmation card.
 * `wide` makes the row span both columns of the grid.
 */
function SummaryRow({
  icon,
  label,
  value,
  wide,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 ${wide ? "sm:col-span-2" : ""}`}
    >
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/12 text-gold ring-1 ring-gold/20">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          {label}
        </dt>
        <dd className="mt-0.5 font-sans text-sm font-medium text-ink leading-snug break-words">
          {value || "—"}
        </dd>
      </div>
    </div>
  );
}
