import { useEffect, useMemo, useState } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  fetchSummary,
  type SummaryAccountTotal,
  type SummaryMonthlyTotal,
  type SummaryResponse,
} from "../modules/summaryApi";
import { NetworkError } from "../modules/apiClient";
import { useStrings } from "../i18n/strings";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

type LoadState = "loading" | "error" | "offline" | "success";

const Summary = () => {
  const strings = useStrings();
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchSummary();
        setSummary(data);
        setState("success");
      } catch (error) {
        if (error instanceof NetworkError) {
          setState("offline");
        } else {
          setState("error");
        }
      }
    };

    void load();
  }, []);

  const pieData = useMemo(() => {
    const breakdown = summary?.breakdown ?? [];
    if (!summary || breakdown.length === 0) {
      return null;
    }
    return {
      labels: breakdown.map((item) => item.label),
      datasets: [
        {
          label: strings.summary.breakdownLabel,
          data: breakdown.map((item) => item.amount),
          backgroundColor: [
            "#4169e1",
            "#2ecc71",
            "#f39c12",
            "#9b59b6",
            "#e74c3c",
            "#1abc9c",
          ],
        },
      ],
    };
  }, [summary, strings.summary.breakdownLabel]);

  const barData = useMemo(() => {
    const breakdown = summary?.breakdown ?? [];
    if (!summary || breakdown.length === 0) {
      return null;
    }

    return {
      labels: breakdown.map((item) => item.label),
      datasets: [
        {
          label: strings.summary.breakdownLabel,
          data: breakdown.map((item) => item.amount),
          backgroundColor: "#4169e1",
        },
      ],
    };
  }, [summary, strings.summary.breakdownLabel]);

  const monthlyData = useMemo(() => {
    const totals = summary?.monthly_totals ?? [];
    if (!summary || totals.length === 0) {
      return null;
    }
    return {
      labels: totals.map((item: SummaryMonthlyTotal) => item.month),
      datasets: [
        {
          label: strings.summary.monthlyTitle,
          data: totals.map((item) => item.total),
          backgroundColor: "#2ecc71",
        },
      ],
    };
  }, [summary, strings.summary.monthlyTitle]);

  const topAccounts: SummaryAccountTotal[] = summary?.top_accounts ?? [];
  const approvalRate = summary?.approval_rate ?? 0;

  return (
    <section className="panel summary-panel">
      <header className="panel-header">
        <h2>{strings.summary.title}</h2>
      </header>
      {state === "loading" && <p>{strings.summary.loading}</p>}
      {state === "error" && (
        <div className="error-banner" role="alert">
          <p>{strings.summary.error}</p>
        </div>
      )}
      {state === "offline" && (
        <div className="error-banner" role="alert">
          <p>{strings.summary.offline}</p>
        </div>
      )}
      {state === "success" && summary && (
        <>
          <div className="summary-metrics">
            <div className="metric-card">
              <span className="metric-label">{strings.summary.totalSpend}</span>
              <span className="metric-value">
                ¥{summary.total_spend.toLocaleString("ja-JP")}
              </span>
            </div>
            <div className="metric-card">
              <span className="metric-label">{strings.summary.journalCount}</span>
              <span className="metric-value">{summary.journal_count}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">{strings.summary.month}</span>
              <span className="metric-value">{summary.month}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">{strings.summary.approvalRate}</span>
              <span className="metric-value">{(approvalRate * 100).toFixed(1)}%</span>
            </div>
          </div>

          {pieData ? (
            <div className="chart-grid">
              <div className="chart-card">
                <h3>{strings.summary.pieTitle}</h3>
                <div className="chart-frame">
                  <Doughnut data={pieData} options={{ maintainAspectRatio: false }} />
                </div>
              </div>
              <div className="chart-card">
                <h3>{strings.summary.barTitle}</h3>
                {barData && (
                  <div className="chart-frame">
                    <Bar
                      data={barData}
                      options={{
                        plugins: {
                          legend: { display: false },
                        },
                        responsive: true,
                        maintainAspectRatio: false,
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="chart-card">
                <h3>{strings.summary.monthlyTitle}</h3>
                {monthlyData ? (
                  <div className="chart-frame">
                    <Bar
                      data={monthlyData}
                      options={{
                        plugins: {
                          legend: { display: false },
                        },
                        responsive: true,
                        maintainAspectRatio: false,
                      }}
                    />
                  </div>
                ) : (
                  <p className="chart-placeholder">{strings.summary.monthlyEmpty}</p>
                )}
              </div>
              <div className="chart-card">
                <h3>{strings.summary.topAccountsTitle}</h3>
                {topAccounts.length > 0 ? (
                  <ul className="top-accounts-list">
                    {topAccounts.map((item) => (
                      <li key={item.account}>
                        <span>{item.account}</span>
                        <span>¥{item.amount.toLocaleString("ja-JP")}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="chart-placeholder">{strings.summary.noData}</p>
                )}
              </div>
            </div>
          ) : (
            <p>{strings.summary.noData}</p>
          )}
        </>
      )}
    </section>
  );
};

export default Summary;
