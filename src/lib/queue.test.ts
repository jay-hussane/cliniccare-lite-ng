import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isPaymentConfirmed } from "@/lib/queue";

describe("payment confirmation for doctor assignment", () => {
  it("requires a positive recorded payment amount", () => {
    assert.equal(isPaymentConfirmed(1), true);
    assert.equal(isPaymentConfirmed(0), false);
    assert.equal(isPaymentConfirmed(-1), false);
    assert.equal(isPaymentConfirmed(Number.NaN), false);
  });
});