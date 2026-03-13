"use client";

import { useMemo, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin,
);

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const formatXAxisLabel = (value, interval) => {
  if (!value) return "";
  const raw = String(value);
  if (interval === "hourly") {
    const parts = raw.split(" ");
    const timePart = parts[1] || "";
    return timePart.slice(0, 2) ? `${timePart.slice(0, 2)}:00` : raw;
  }
  if (interval === "daily") {
    const date = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  }
  if (interval === "weekly") {
    const weekParts = raw.split("-W");
    if (weekParts.length === 2) {
      return `Wk ${weekParts[1]}`;
    }
    return raw;
  }
  if (interval === "monthly") {
    const [year, month] = raw.split("-");
    const monthIndex = Number(month) - 1;
    if (!Number.isNaN(monthIndex) && MONTHS[monthIndex]) {
      return `${MONTHS[monthIndex]} ${year}`;
    }
    return raw;
  }
  if (interval === "yearly") {
    return raw;
  }
  return raw;
};

export default function SalesChart({ data = [], interval = "daily" }) {
  const chartRef = useRef(null);
  const rawLabels = useMemo(() => data.map((point) => point.date), [data]);
  const labels = useMemo(
    () => data.map((point) => formatXAxisLabel(point.date, interval)),
    [data, interval],
  );

  const chartData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Confirmed Orders",
          data: data.map((point) => point.confirmed || 0),
          borderColor: "#3B82F6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          tension: 0.35,
          pointRadius: 2,
          pointHoverRadius: 5,
        },
        {
          label: "RTO Orders",
          data: data.map((point) => point.rto || 0),
          borderColor: "#F97316",
          backgroundColor: "rgba(249, 115, 22, 0.1)",
          tension: 0.35,
          pointRadius: 2,
          pointHoverRadius: 5,
        },
      ],
    }),
    [data, labels],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      interaction: { mode: "nearest", intersect: false },
      scales: {
        x: {
          ticks: {
            autoSkip: true,
            maxTicksLimit: 12,
          },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: "rgba(148, 163, 184, 0.2)" },
        },
      },
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            title: (items) => rawLabels[items[0]?.dataIndex] || "",
            label: (context) =>
              `${context.dataset.label}: ${context.parsed.y} orders`,
          },
        },
        zoom: {
          pan: {
            enabled: true,
            mode: "x",
          },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            drag: { enabled: true },
            mode: "x",
          },
        },
      },
    }),
    [rawLabels],
  );

  const handleResetZoom = () => {
    chartRef.current?.resetZoom?.();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Confirmed vs RTO Orders
          </h2>
          <p className="text-sm text-gray-500">
            Interval: {interval.charAt(0).toUpperCase() + interval.slice(1)}
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetZoom}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Reset Zoom
        </button>
      </div>

      {data.length === 0 ? (
        <div className="h-[320px] flex items-center justify-center text-gray-500">
          No chart data for this range.
        </div>
      ) : (
        <div className="h-[320px]">
          <Line ref={chartRef} data={chartData} options={options} />
        </div>
      )}
    </div>
  );
}
