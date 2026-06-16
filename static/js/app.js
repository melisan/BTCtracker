const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtB = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 });

let chart = null;
let activeDays = 1;
let priceRefreshTimer = null;

async function fetchPrice() {
  try {
    const res = await fetch("/api/price");
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    document.getElementById("price").textContent = fmt.format(data.price);

    const changeEl = document.getElementById("change");
    const sign = data.change_24h >= 0 ? "+" : "";
    changeEl.textContent = `${sign}${data.change_24h.toFixed(2)}%`;
    changeEl.className = "change " + (data.change_24h >= 0 ? "positive" : "negative");

    document.getElementById("market-cap").textContent = fmtB.format(data.market_cap);
    document.getElementById("volume").textContent = fmtB.format(data.volume_24h);

    document.getElementById("last-updated").textContent =
      "Updated " + new Date().toLocaleTimeString();
  } catch (err) {
    console.error("Price fetch failed:", err);
  }
}

async function fetchChart(days) {
  try {
    const res = await fetch(`/api/chart/${days}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const labels = data.prices.map(p => {
      const d = new Date(p.t);
      return days === 1
        ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString([], { month: "short", day: "numeric" });
    });
    const values = data.prices.map(p => p.v);

    const isUp = values[values.length - 1] >= values[0];
    const lineColor = isUp ? "#3fb950" : "#f85149";
    const fillColor = isUp ? "rgba(63,185,80,0.08)" : "rgba(248,81,73,0.08)";

    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.data.datasets[0].borderColor = lineColor;
      chart.data.datasets[0].backgroundColor = fillColor;
      chart.update("none");
    } else {
      const ctx = document.getElementById("chart").getContext("2d");
      chart = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [{
            data: values,
            borderColor: lineColor,
            backgroundColor: fillColor,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: true,
            tension: 0.3,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => fmt.format(ctx.parsed.y),
              },
            },
          },
          scales: {
            x: {
              ticks: { color: "#6e7681", maxTicksLimit: 8, maxRotation: 0 },
              grid: { color: "#21262d" },
            },
            y: {
              ticks: { color: "#6e7681", callback: v => fmtB.format(v) },
              grid: { color: "#21262d" },
            },
          },
        },
      });
    }
  } catch (err) {
    console.error("Chart fetch failed:", err);
  }
}

function setActiveRange(days) {
  activeDays = days;
  document.querySelectorAll(".range-btn").forEach(btn => {
    btn.classList.toggle("active", parseInt(btn.dataset.days) === days);
  });
  fetchChart(days);
}

document.querySelectorAll(".range-btn").forEach(btn => {
  btn.addEventListener("click", () => setActiveRange(parseInt(btn.dataset.days)));
});

fetchPrice();
fetchChart(activeDays);

priceRefreshTimer = setInterval(fetchPrice, 60_000);
