import { describe, expect, it } from "bun:test";
import { isPaymentConfirmed } from "@/lib/queue";

describe("payment confirmation for doctor assignment", () => {
  it("requires a positive recorded payment amount", () => {
    expect(isPaymentConfirmed(1)).toBe(true);
    expect(isPaymentConfirmed(0)).toBe(false);
    expect(isPaymentConfirmed(-1)).toBe(false);
    expect(isPaymentConfirmed(Number.NaN)).toBe(false);
  });
});