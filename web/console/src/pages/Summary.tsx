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
import { fetchSummary, type SummaryResponse } from "../modules/summaryApi";
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
    if (!summary || summary.breakdown.length === 0) {
      return null;
    }
    return {
      labels: summary.breakdown.map((item) => item.label),
      datasets: [
        {
          label: strings.summary.breakdownLabel,
          data: summary.breakdown.map((item) => item.amount),
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
    if (!summary || summary.breakdown.length === 0) {
      return null;
    }

    return {
      labels: summary.breakdown.map((item) => item.label),
      datasets: [
        {
          label: strings.summary.breakdownLabel,
          data: summary.breakdown.map((item) => item.amount),
          backgroundColor: "#4169e1",
        },
      ],
    };
  }, [summary, strings.summary.breakdownLabel]);

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
          </div>

          {pieData ? (
            <div className="chart-grid">
              <div className="chart-card">
                <h3>{strings.summary.pieTitle}</h3>
                <Doughnut data={pieData} />
              </div>
              <div className="chart-card">
                <h3>{strings.summary.barTitle}</h3>
                {barData && (
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
