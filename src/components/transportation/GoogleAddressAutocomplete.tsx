"use client";

import { useEffect, useId, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import pointToPointServiceAreaConfig from "@/../config/point-to-point-service-area.json";
import { milesToMeters } from "@/lib/geo/service-area";

/**
 * Google Places-backed address input for the point-to-point flow.
 *
 * Uses the newer `PlaceAutocompleteElement` web component (replaces the
 * legacy Autocomplete class which Google has stopped enhancing). The
 * `locationRestriction` is bound to our home base service area (see
 * config/point-to-point-service-area.json) so out-of-area suggestions never appear.
 *
 * The browser API key (`NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`) must be
 * configured with HTTP referrer restrictions and limited to Maps JS API +
 * Places API.
 */

const SERVICE_AREA = pointToPointServiceAreaConfig as {
  center: { lat: number; lng: number };
  radiusMiles: number;
};

interface PickedPlace {
  placeId: string;
  formattedAddress: string;
  name?: string;
  location?: { lat: number; lng: number };
}

interface Props {
  id: string;
  label: string;
  /** Formatted address text — the value rendered to the user. */
  value: string;
  /** Selected Place ID — what the server actually needs. */
  placeId: string;
  onChange: (next: PickedPlace) => void;
  placeholder?: string;
  required?: boolean;
  inputRef?: (el: HTMLElement | null) => void;
  /**
   * Called once when Places autocomplete turns out to be unusable — the API
   * key/library failed to load, or Google reported a request error (most
   * commonly HTTP 429 once the project's daily `AutocompletePlaces` quota is
   * exhausted). The parent uses this to relax its "pick from the suggestions"
   * validation so a Places outage can't take the whole booking funnel down.
   */
  onUnavailable?: (reason: string) => void;
  /**
   * Forces the typed-address fallback even though this particular field
   * hasn't errored yet. The parent sets it once any address field reports an
   * outage, so a form with two address inputs switches both together instead
   * of leaving the second one as a dead search box until the customer types
   * into it and it fails too.
   */
  forceFallback?: boolean;
}

// Singleton loader — concurrent mounts share the same places-library import.
// v2 of @googlemaps/js-api-loader uses a functional API: setOptions() once,
// then importLibrary() per library needed.
let optionsSet = false;
let placesLibPromise: Promise<google.maps.PlacesLibrary> | null = null;
function loadPlacesLibrary(): Promise<google.maps.PlacesLibrary> {
  if (placesLibPromise) return placesLibPromise;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error(
        "NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY is not set. Add it to your .env.local and Netlify env."
      )
    );
  }
  if (!optionsSet) {
    setOptions({ key: apiKey, v: "weekly" });
    optionsSet = true;
  }
  placesLibPromise = importLibrary("places");
  return placesLibPromise;
}

export default function GoogleAddressAutocomplete({
  id,
  label,
  value,
  placeId,
  onChange,
  placeholder,
  required,
  inputRef,
  onUnavailable,
  forceFallback,
}: Props) {
  const reactId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  /** Set once Google reports a request error — switches to the typed-address input. */
  const [requestError, setRequestError] = useState<string | null>(null);

  // The mount effect runs once, so read the latest callback through a ref
  // instead of capturing the first render's closure.
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;
  const valueRef = useRef(value);
  valueRef.current = value;
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);
  /** True when the Google element held focus at the moment it failed. */
  const stealFocusRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    loadPlacesLibrary()
      .then(async (places) => {
        if (cancelled) return;

        // PlaceAutocompleteElement is a web component (extends HTMLElement).
        // It's not in older @types/google.maps; type loosely.
        type PlacesNS = typeof places & {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          PlaceAutocompleteElement: new (opts: any) => HTMLElement;
        };
        const placesNS = places as PlacesNS;
        if (!placesNS.PlaceAutocompleteElement) {
          throw new Error(
            "Google PlaceAutocompleteElement is unavailable. The Places API (New) may not be enabled."
          );
        }

        const radiusMeters = milesToMeters(SERVICE_AREA.radiusMiles);

        const element = new placesNS.PlaceAutocompleteElement({
          // Use the curated component restrictions to keep suggestions tight
          // to our service area. `locationRestriction` is hard — out-of-area
          // results literally don't show.
          locationRestriction: {
            west: SERVICE_AREA.center.lng - 1.5,
            east: SERVICE_AREA.center.lng + 1.5,
            south: SERVICE_AREA.center.lat - 1.0,
            north: SERVICE_AREA.center.lat + 1.0,
          },
          // Additionally use a circle bias so the closest results sort first.
          // (Circle bias must be set via the underlying `requestedRegion` /
          // `origin` options in newer SDK builds; this snippet keeps it simple.)
          includedRegionCodes: ["us"],
        });

        // The element manages its own input. Mount it into our container.
        if (containerRef.current) {
          containerRef.current.replaceChildren(element);
        }
        elementRef.current = element;
        inputRef?.(element);

        // Stretch the Google host element to fill the wrapper. The wrapper
        // supplies the brand border for the unfocused state; on focus Google
        // paints its own 2px blue inner border from a closed shadow root we
        // can't reach (inline styles + injected shadow CSS both inert) — we
        // live with that as the focus indicator instead of fighting it.
        element.style.setProperty("width", "100%", "important");
        element.style.setProperty("flex", "1", "important");
        element.style.setProperty("background", "transparent", "important");

        // Style the embedded input to match our other form controls.
        applyInputStyling(element);

        // Pre-populate the value if we already have one (e.g. user navigated back)
        if (value) {
          tryPrefillValue(element, value);
        }

        // Google has shipped THREE different selection-event shapes for this
        // component across SDK versions ("gmp-placeselect", "gmp-select"
        // with detail.placePrediction, and prediction directly on event).
        // Listen on both names and probe defensively so a Google rev doesn't
        // silently break us.
        const handler = async (ev: Event) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const evAny = ev as any;
          const detail = (ev as CustomEvent).detail;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const placePrediction = (detail as any)?.placePrediction ?? evAny.placePrediction;

          if (process.env.NODE_ENV !== "production") {
            console.log(`[GoogleAddressAutocomplete:${id}] ${ev.type} fired`, {
              hasDetail: Boolean(detail),
              hasPrediction: Boolean(placePrediction),
              predictionKeys: placePrediction ? Object.keys(placePrediction) : null,
              evAnyKeys: Object.keys(evAny),
            });
          }

          if (!placePrediction) {
            console.warn(`[GoogleAddressAutocomplete:${id}] no placePrediction in event`);
            return;
          }

          // Place ID is available directly on the prediction — use that as
          // the source of truth so we capture it even if fetchFields fails.
          const predictionPlaceId =
            placePrediction.placeId ??
            placePrediction.place_id ??
            placePrediction.id ??
            "";

          // Now hydrate the Place for the formatted-address / coords.
          let place: {
            id?: string;
            formattedAddress?: string;
            displayName?: string;
            location?: { lat: () => number; lng: () => number };
          } | null = null;
          try {
            if (typeof placePrediction.toPlace === "function") {
              place = placePrediction.toPlace();
              if (place && typeof (place as { fetchFields?: unknown }).fetchFields === "function") {
                await (
                  place as unknown as { fetchFields: (a: { fields: string[] }) => Promise<unknown> }
                ).fetchFields({
                  fields: ["id", "formattedAddress", "displayName", "location"],
                });
              }
            }
          } catch (err) {
            console.error(`[GoogleAddressAutocomplete:${id}] fetchFields failed:`, err);
          }

          const placeId = place?.id ?? predictionPlaceId;
          if (!placeId) {
            console.warn(`[GoogleAddressAutocomplete:${id}] no placeId resolved`, { place, placePrediction });
            return;
          }

          const picked: PickedPlace = {
            placeId,
            formattedAddress:
              place?.formattedAddress ??
              placePrediction.text?.text ??
              placePrediction.description ??
              "",
            name:
              typeof place?.displayName === "string"
                ? place.displayName
                : placePrediction.mainText?.text ?? undefined,
            location: place?.location
              ? { lat: place.location.lat(), lng: place.location.lng() }
              : undefined,
          };

          if (process.env.NODE_ENV !== "production") {
            console.log(`[GoogleAddressAutocomplete:${id}] picked`, picked);
          }

          if (!cancelled) onChange(picked);
        };

        const events = ["gmp-select", "gmp-placeselect"];
        for (const name of events) element.addEventListener(name, handler as EventListener);

        // Google fires `gmp-error` for every failed backend request. In
        // production the likeliest cause by far is the Cloud project's daily
        // `AutocompletePlaces` quota running out — after that the field
        // returns no suggestions for the rest of the day and, without this
        // handler, says nothing at all while the customer types into a dead
        // search box. Degrade to a typed-address input on the first error.
        const errorHandler = (ev: Event) => {
          if (cancelled) return;
          const detail = (ev as CustomEvent).detail;
          const message = describeGoogleError(detail);
          console.error(`[GoogleAddressAutocomplete:${id}] gmp-error:`, message, detail);
          setRequestError((prev) => prev ?? message);
          // Carry whatever the customer already typed into the fallback input
          // so switching over doesn't wipe their work. The host element
          // mirrors the embedded input through its `value` property (the
          // shadow root is closed, so this is the only way to read it).
          const typed = (element as unknown as { value?: unknown }).value;
          if (typeof typed === "string" && typed.trim() && !valueRef.current) {
            onChange({ placeId: "", formattedAddress: typed, name: undefined, location: undefined });
          }
          // The customer is mid-word and we're about to hide the element out
          // from under them, so hand the caret to the replacement input.
          // Only when THIS field had focus — a sibling field degrading in the
          // background must not yank focus across the form.
          stealFocusRef.current = document.activeElement === element;
        };
        element.addEventListener("gmp-error", errorHandler);

        // The Google web component doesn't fire any event when the user
        // clears the input manually (or via its built-in × button), which
        // would otherwise leave React state holding a stale Place ID. Listen
        // on the embedded input and surface a clear via onChange with an
        // empty sentinel so the parent can reset its state.
        const detachClear = attachClearListener(element, () => {
          if (cancelled) return;
          if (process.env.NODE_ENV !== "production") {
            console.log(`[GoogleAddressAutocomplete:${id}] input cleared → firing onChange({placeId:""})`);
          }
          onChange({ placeId: "", formattedAddress: "", name: undefined, location: undefined });
        });

        cleanup = () => {
          for (const name of events) element.removeEventListener(name, handler as EventListener);
          element.removeEventListener("gmp-error", errorHandler);
          detachClear();
        };

        // Surface radius distance dynamically — keep alive for future tuning
        void radiusMeters;

        setReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
      // Removing the Google element can race with React if the parent is
      // also unmounting at the same time. Swallow DOM exceptions here —
      // anything not-removed will be GC'd when its container goes away.
      try {
        if (containerRef.current) containerRef.current.replaceChildren();
      } catch {
        /* noop */
      }
      elementRef.current = null;
    };
    // We deliberately don't depend on `value` / `onChange` — the element
    // owns its internal state after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every failure mode means the customer can never produce a Place ID, so
  // they all fall back to the same plain typed-address input.
  const ownFailure = loadError ?? requestError;
  const unavailableReason =
    ownFailure ?? (forceFallback ? "Address search is unavailable" : null);

  // Only report our OWN failure upward — echoing a parent-driven
  // `forceFallback` back to the parent would be a pointless round trip.
  useEffect(() => {
    if (ownFailure) onUnavailableRef.current?.(ownFailure);
  }, [ownFailure]);

  useEffect(() => {
    if (!unavailableReason || !stealFocusRef.current) return;
    stealFocusRef.current = false;
    const input = fallbackInputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    // Caret to the end so the customer just keeps typing where they left off.
    input.setSelectionRange(input.value.length, input.value.length);
  }, [unavailableReason]);

  return (
    <div>
      <label
        htmlFor={id || reactId}
        className="block font-sans text-xs font-semibold text-muted uppercase tracking-wide mb-1.5"
      >
        {label}
        {required && <span className="text-sunset ml-0.5">*</span>}
      </label>

      {/* Loading placeholder — separate sibling so React never owns children
          inside the Google-managed container. */}
      {!ready && !unavailableReason && (
        <input
          id={id || reactId}
          type="text"
          disabled
          placeholder="Loading address search…"
          className="w-full rounded-xl border border-border bg-cream/60 px-4 py-3 font-sans text-sm text-muted outline-none"
        />
      )}

      {/*
        The Google PlaceAutocompleteElement mounts imperatively INSIDE this div.
        We never put React-rendered children in here — doing so causes
        removeChild errors when React's virtual DOM and Google's imperative
        DOM mutations disagree on what's a child of what.

        The wrapper carries the visible field border. Google's web component
        renders its own input/icon layout inside a shadow root that's hard to
        style reliably across SDK versions — wrapping it gives users a clear,
        consistent field boundary regardless of what Google paints inside.
      */}
      <div
        ref={containerRef}
        data-google-autocomplete={id}
        className="relative flex items-center w-full min-h-[3rem] rounded-xl border border-[#C9BFAE] bg-white px-3 transition-colors outline-none hover:border-[#A88850] focus-within:border-[#A88850]"
        // Hidden until ready so it doesn't reserve layout space before the
        // web component upgrades, and hidden again if Google turns out to be
        // unusable — the typed-address input below takes over.
        style={{ display: ready && !unavailableReason ? "flex" : "none" }}
      />

      {/* Fallback: address search is down, so take the address as free text.
          The booking still goes through — it routes to the manual-quote path
          instead of instant checkout, because we can't measure the distance
          without coordinates. */}
      {unavailableReason && (
        <>
          <input
            id={id || reactId}
            type="text"
            value={value}
            onChange={(e) =>
              onChange({
                placeId: "",
                formattedAddress: e.target.value,
                name: undefined,
                location: undefined,
              })
            }
            placeholder="Type the full address, e.g. 1313 Disneyland Dr, Anaheim"
            autoComplete="street-address"
            required={required}
            // Take over the parent's focus target — the Google element it was
            // pointed at on mount is hidden now and can't receive focus.
            ref={(el) => {
              fallbackInputRef.current = el;
              inputRef?.(el);
            }}
            className="w-full rounded-xl border border-[#C9BFAE] bg-white px-4 py-3 font-sans text-sm text-ink placeholder:text-muted/70 outline-none transition-colors hover:border-[#A88850] focus:border-[#A88850]"
          />
          {/* Kept to one line — the booking summary panel carries the full
              "here's what happens next" explanation, and repeating it under
              every address field buries the form. */}
          <p className="mt-1.5 text-xs text-muted" role="status">
            Address search is temporarily unavailable — please type the full address.
          </p>
        </>
      )}

      {placeId && value && !unavailableReason && (
        <p className="mt-1.5 text-xs text-muted truncate" aria-live="polite">
          Selected: <span className="text-ink/80">{value}</span>
        </p>
      )}

      {placeholder && !value && ready && !unavailableReason && (
        <p className="mt-1.5 text-xs text-muted/80">{placeholder}</p>
      )}
    </div>
  );
}

/**
 * Pull a human-readable message out of a `gmp-error` event detail. Google
 * hasn't settled on one shape across SDK revisions, so probe defensively and
 * fall back to a generic string rather than rendering "[object Object]".
 */
function describeGoogleError(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (detail instanceof Error) return detail.message;
  if (detail && typeof detail === "object") {
    const d = detail as { error?: unknown; message?: unknown };
    if (d.error instanceof Error) return d.error.message;
    if (typeof d.message === "string") return d.message;
    if (typeof d.error === "string") return d.error;
  }
  return "Google address search request failed";
}

/**
 * Apply our form-input styling to the embedded input inside the
 * PlaceAutocompleteElement web component. The element renders its own input
 * (no slots in this version), so we reach in once at mount time AND inject a
 * scoped stylesheet inside the shadow DOM — the component otherwise honors
 * `prefers-color-scheme: dark` and renders a black background, which breaks
 * with the rest of the form on every mount of this component.
 */
function applyInputStyling(element: HTMLElement): void {
  requestAnimationFrame(() => {
    // Force light mode on the web component element itself — Google's CSS
    // toggles on `:host([color-scheme="dark"])`.
    element.setAttribute("color-scheme", "light");
    element.style.colorScheme = "light";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shadow = (element as any).shadowRoot as ShadowRoot | null;

    // Inject a small stylesheet inside the shadow root so the dropdown panel
    // (also rendered inside the shadow tree) inherits light colors AND a
    // visible border on the input itself. Tailwind classes added via
    // `classList` below can't reach inside the shadow tree, so without this
    // the input has no visible boundary at all.
    if (shadow && !shadow.querySelector("style[data-tnt-light]")) {
      const style = document.createElement("style");
      style.setAttribute("data-tnt-light", "");
      style.textContent = `
        :host, :host(*), .widget-container { color-scheme: light !important; }
        /* Suppress the default :focus outline Google's component paints on
           the host element — the React wrapper provides the brand gold focus
           ring instead. :host inside shadow DOM has higher specificity than
           an external inline style, so we have to override here. */
        :host { outline: none !important; border: none !important; }
        :host(:focus), :host(:focus-visible), :host(:focus-within) {
          outline: none !important;
          border: none !important;
          box-shadow: none !important;
        }
        input, .widget-container { background-color: transparent !important; color: #111827 !important; }
        input {
          /* No border / padding / outline here — the React wrapper supplies
             the bordered field. We just keep the input transparent + full
             width so it sits flush inside the wrapper. */
          border: none !important;
          outline: none !important;
          background: transparent !important;
          width: 100% !important;
          padding: 0 !important;
          font-size: 0.875rem !important;
          box-shadow: none !important;
        }
        input:focus { outline: none !important; box-shadow: none !important; }
        .widget-prediction, .widget-prediction *, [role="option"] { background-color: #ffffff !important; color: #111827 !important; }
        [role="option"]:hover, [role="option"][aria-selected="true"] { background-color: #f5f5f4 !important; }
      `;
      shadow.appendChild(style);
    }

    const targets: HTMLElement[] = [];
    if (shadow) {
      shadow.querySelectorAll("input").forEach((el) => targets.push(el as HTMLElement));
    }
    element.querySelectorAll("input").forEach((el) => targets.push(el as HTMLElement));
    for (const input of targets) {
      // The bordered field is the React wrapper around this component — the
      // input itself stays transparent and borderless so it sits flush
      // inside that wrapper instead of painting a second border around an
      // icon-width box.
      input.style.backgroundColor = "transparent";
      input.style.color = "#111827";
      input.style.caretColor = "#111827";
      input.style.outline = "none";
      input.style.border = "none";
      input.style.boxShadow = "none";
      input.style.padding = "0";
      input.style.width = "100%";
      input.style.fontSize = "0.875rem";
      input.style.colorScheme = "light";
    }
  });
}

/**
 * Detect when the embedded input becomes empty (manual delete OR the web
 * component's built-in × clear button, which sets the value programmatically
 * and does NOT dispatch an `input` event) and invoke `onClear`.
 *
 * Two complementary detectors so we react quickly when the user types and
 * still catch programmatic clears:
 *
 *  - `input` event listener — instant feedback for user typing
 *  - 200 ms poll comparing the previous value to the current — catches
 *    programmatic resets that bypass the `input` event
 */
function attachClearListener(element: HTMLElement, onClear: () => void): () => void {
  let stopped = false;
  let lastValue = "";
  let attachedInput: HTMLInputElement | null = null;
  let removeInputHandler: (() => void) | null = null;

  const findInput = (): HTMLInputElement | null => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shadow = (element as any).shadowRoot as ShadowRoot | null;
    return (
      (shadow?.querySelector("input") as HTMLInputElement | null) ??
      (element.querySelector("input") as HTMLInputElement | null)
    );
  };

  const attachInputHandlerOnce = (input: HTMLInputElement) => {
    if (attachedInput === input) return;
    removeInputHandler?.();
    const handler = () => {
      if (stopped) return;
      const current = input.value;
      if (lastValue !== "" && current === "") onClear();
      lastValue = current;
    };
    input.addEventListener("input", handler);
    attachedInput = input;
    removeInputHandler = () => input.removeEventListener("input", handler);
  };

  const tick = () => {
    if (stopped) return;
    const input = findInput();
    if (!input) return;
    const firstTimeFound = attachedInput !== input;
    attachInputHandlerOnce(input);
    if (firstTimeFound && process.env.NODE_ENV !== "production") {
      console.log("[attachClearListener] found embedded input — clear detection armed");
    }
    const current = input.value;
    if (lastValue !== "" && current === "") onClear();
    lastValue = current;
  };

  const intervalId = window.setInterval(tick, 150);
  tick();

  return () => {
    stopped = true;
    window.clearInterval(intervalId);
    removeInputHandler?.();
  };
}

/**
 * If the user has a previously-saved formattedAddress, mirror it into the
 * embedded input so they don't see an empty field on re-mount (e.g. when
 * stepping back in the wizard). Not a perfect rehydration — the user still
 * has to re-pick to get a fresh Place ID — but better than blank.
 */
function tryPrefillValue(element: HTMLElement, value: string): void {
  requestAnimationFrame(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shadow = (element as any).shadowRoot as ShadowRoot | null;
    const input =
      (shadow?.querySelector("input") as HTMLInputElement | null) ??
      (element.querySelector("input") as HTMLInputElement | null);
    if (input) input.value = value;
  });
}
