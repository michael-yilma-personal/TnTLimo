import { describe, expect, it } from "vitest";
import {
  MIN_MANUAL_ADDRESS_LENGTH,
  isAddressProvided,
  requiresManualQuote,
} from "./addressFallback";

describe("isAddressProvided", () => {
  describe("when Places autocomplete is healthy", () => {
    it("accepts an address that came with a Place ID", () => {
      expect(
        isAddressProvided({
          address: "1313 Disneyland Dr, Anaheim, CA 92802, USA",
          placeId: "ChIJdz0kQXTX3IARLZjyeuFxrCE",
          lookupDegraded: false,
        }),
      ).toBe(true);
    });

    it("rejects free text with no Place ID — the customer must pick a suggestion", () => {
      expect(
        isAddressProvided({
          address: "1313 Disneyland Dr",
          placeId: "",
          lookupDegraded: false,
        }),
      ).toBe(false);
    });
  });

  describe("when Places autocomplete is unavailable (quota exhausted / API down)", () => {
    it("accepts a typed address with no Place ID so the customer isn't dead-ended", () => {
      expect(
        isAddressProvided({
          address: "1313 Disneyland Dr, Anaheim",
          placeId: "",
          lookupDegraded: true,
        }),
      ).toBe(true);
    });

    it("still rejects an empty address", () => {
      expect(isAddressProvided({ address: "", placeId: "", lookupDegraded: true })).toBe(false);
    });

    it("still rejects whitespace-only input", () => {
      expect(isAddressProvided({ address: "   ", placeId: "", lookupDegraded: true })).toBe(false);
    });

    it("rejects input too short to be a real address", () => {
      const tooShort = "a".repeat(MIN_MANUAL_ADDRESS_LENGTH - 1);
      expect(isAddressProvided({ address: tooShort, placeId: "", lookupDegraded: true })).toBe(
        false,
      );
    });

    it("accepts input at exactly the minimum length", () => {
      const justLongEnough = "a".repeat(MIN_MANUAL_ADDRESS_LENGTH);
      expect(
        isAddressProvided({ address: justLongEnough, placeId: "", lookupDegraded: true }),
      ).toBe(true);
    });

    it("measures length after trimming", () => {
      const padded = `  ${"a".repeat(MIN_MANUAL_ADDRESS_LENGTH - 1)}  `;
      expect(isAddressProvided({ address: padded, placeId: "", lookupDegraded: true })).toBe(false);
    });

    it("still accepts a Place ID captured before the outage started", () => {
      expect(
        isAddressProvided({
          address: "1313 Disneyland Dr, Anaheim, CA 92802, USA",
          placeId: "ChIJdz0kQXTX3IARLZjyeuFxrCE",
          lookupDegraded: true,
        }),
      ).toBe(true);
    });
  });
});

describe("requiresManualQuote", () => {
  // Distance-priced services can't be quoted from an unvalidated string — we
  // must never put a card charge behind a guessed fare.
  it("forces a manual quote for point-to-point when the lookup is degraded", () => {
    expect(requiresManualQuote("point-to-point", true)).toBe(true);
  });

  it("forces a manual quote for airport transfers when the lookup is degraded", () => {
    expect(requiresManualQuote("airport-transfer", true)).toBe(true);
  });

  // Hourly charter is priced on hours × vehicle rate, so an unvalidated
  // pickup address doesn't affect the fare — it stays instantly bookable.
  it("leaves hourly charter bookable when the lookup is degraded", () => {
    expect(requiresManualQuote("hourly-charter", true)).toBe(false);
  });

  it("handles the no-service-chosen-yet state", () => {
    expect(requiresManualQuote(null, true)).toBe(false);
    expect(requiresManualQuote(undefined, true)).toBe(false);
    expect(requiresManualQuote("", true)).toBe(false);
  });

  it("never forces a manual quote while the lookup is healthy", () => {
    expect(requiresManualQuote("point-to-point", false)).toBe(false);
    expect(requiresManualQuote("airport-transfer", false)).toBe(false);
    expect(requiresManualQuote("hourly-charter", false)).toBe(false);
  });
});
