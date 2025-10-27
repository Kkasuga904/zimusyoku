import { describe, expect, it } from 'vitest';
import { CurrencySummary, normalizeLedger } from "./ledger";

describe("normalizeLedger", () => {
  it("normalizes field aliases and currency", () => {
    const rows = normalizeLedger([
      { acct: "A", amt: "1.25", currency: "usd" },
      { account: "A", amount: 2, currency: "USD" },
      { account: "B", amount: 3 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.account === "A")?.amount).toBeCloseTo(2);
    expect(rows.find((row) => row.account === "B")?.currency).toBe("USD");
  });

  it("throws when account is missing", () => {
    expect(() => normalizeLedger([{ amount: 1 }])).toThrow(/account/);
  });
});

describe("CurrencySummary", () => {
  it("totals by currency with rounding", () => {
    const summary = CurrencySummary.from(
      normalizeLedger([
        { acct: "A", amt: 1.335, currency: "eur" },
        { account: "B", amount: 2.665, currency: "eur" },
        { account: "C", amount: 7, currency: "usd" },
      ]),
    );
    const eur = summary.byCurrency.find((entry) => entry.currency === "EUR");
    const usd = summary.byCurrency.find((entry) => entry.currency === "USD");
    expect(eur?.total).toBeCloseTo(4.0);
    expect(usd?.total).toBeCloseTo(7.0);
  });
});
