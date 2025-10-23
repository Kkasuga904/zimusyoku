import React from "react";
import ReactDOM from "react-dom/client";
import { CurrencySummary, normalizeLedger } from "./modules/ledger";

const SAMPLE_ROWS = [
  { account: "A", amount: 12.5, currency: "USD" },
  { acct: "B", amt: "7.50", currency: "usd" },
  { acct: "A", amt: 3, currency: "USD" },
];

const App = () => {
  const summary = CurrencySummary.from(normalizeLedger(SAMPLE_ROWS));
  return (
    <main>
      <h1>Universal Paste Console</h1>
      <p>Tracked currencies:</p>
      <ul>
        {summary.byCurrency.map((item) => (
          <li key={item.currency}>
            {item.currency}: {item.total.toFixed(2)}
          </li>
        ))}
      </ul>
    </main>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
