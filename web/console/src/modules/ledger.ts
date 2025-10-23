export type RawLedgerRow = {
  account?: string;
  acct?: string;
  amount?: number | string;
  amt?: number | string;
  currency?: string;
};

export type NormalizedLedgerRow = {
  account: string;
  amount: number;
  currency: string;
};

const coerceNumber = (value: number | string | undefined): number => {
  if (value === undefined) {
    throw new Error("Missing amount/amt field");
  }
  const num = typeof value === "number" ? value : Number.parseFloat(value);
  if (Number.isNaN(num)) {
    throw new Error("Amount is not numeric");
  }
  return num;
};

const normalizeCurrency = (currency?: string): string => {
  return (currency ?? "USD").trim().toUpperCase() || "USD";
};

export const normalizeLedger = (
  rows: ReadonlyArray<RawLedgerRow>,
): NormalizedLedgerRow[] => {
  const seen = new Map<string, NormalizedLedgerRow>();
  rows.forEach((row) => {
    const account = (row.account ?? row.acct ?? "").toString().trim();
    if (!account) {
      throw new Error("Missing account/acct field");
    }
    seen.set(account, {
      account,
      amount: coerceNumber(row.amount ?? row.amt),
      currency: normalizeCurrency(row.currency),
    });
  });
  return Array.from(seen.values());
};

export class CurrencySummary {
  readonly totals: Map<string, number>;

  private constructor(totals: Map<string, number>) {
    this.totals = totals;
  }

  static from(rows: NormalizedLedgerRow[]): CurrencySummary {
    const totals = new Map<string, number>();
    rows.forEach((row) => {
      const current = totals.get(row.currency) ?? 0;
      totals.set(
        row.currency,
        Number.parseFloat((current + row.amount).toFixed(2)),
      );
    });
    return new CurrencySummary(totals);
  }

  get byCurrency(): Array<{ currency: string; total: number }> {
    return Array.from(this.totals.entries()).map(([currency, total]) => ({
      currency,
      total,
    }));
  }
}
