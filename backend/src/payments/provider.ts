// Project: Via Nostra
// File: backend/src/payments/provider.ts
// Purpose: The payment provider, the part that actually moves money in and out.
//          Today it is a TEST provider that pretends every payment works, so the
//          whole flow can be used with no real money. A real provider (card, M-Pesa)
//          will replace it later without changing the rest of the code.

import { randomUUID } from 'node:crypto';

export type ProviderResult = { reference: string };

export type PaymentProvider = {
  name: string;
  charge(input: { bookingId: string; amountMinor: number; currency: string }): Promise<ProviderResult>;
  refund(input: { bookingId: string; amountMinor: number; currency: string }): Promise<ProviderResult>;
  payout(input: {
    payoutId: string;
    amountMinor: number;
    currency: string;
    destination: string;
  }): Promise<ProviderResult>;
};

const testProvider: PaymentProvider = {
  name: 'test',
  async charge() {
    return { reference: `test_charge_${randomUUID()}` };
  },
  async refund() {
    return { reference: `test_refund_${randomUUID()}` };
  },
  async payout() {
    return { reference: `test_payout_${randomUUID()}` };
  },
};

export function getPaymentProvider(): PaymentProvider {
  return testProvider;
}

// File: backend/src/payments/provider.ts
// END OF FILE