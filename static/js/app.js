const fmtKRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const fmtUSD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const fmtNum = v => {
  if (v == null) return "—";
  const abs = Math.abs(v);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: abs >= 1 ? 4 : 8 }).format(v);
};

const STOCK_TYPES = new Set(["AAPL","AMZN","CVX","LLY","GOOGL","GOOG","NVO","OXY"]);

let cryptoPrices = { btc: 0, eth: 0, usd_krw: 1350 };
let stockData = { prices: {}, meta: {} };
let holdings = [];
let portfolioChart = null;

// ── Crypto Prices ─────────────────────────────────────────────
async function fetchCryptoPrices() {
  try {
    const res = await fetch("/api/prices");
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    cryptoPrices = data;

    document.getElementById("btc-price").textContent = fmtKRW.format(data.btc);
    document.getElementById("eth-price").textContent = fmtKRW.format(data.eth);
    document.getElementById("usd-krw").textContent = fmtKRW.format(data.usd_krw);
    document.getElementById("last-updated").textContent = "Updated " + new Date().toLocaleTimeString();

    renderHoldings();
  } catch (err) {
    console.error("Crypto price fetch failed:", err);
  }
}

// ── Stock Prices ──────────────────────────────────────────────
async function fetchStockPrices() {
  try {
    const res = await fetch("/api/stocks");
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    stockData = data;

    renderStocksGrid();
    document.getElementById("stock-ts").textContent =
      "Updated " + new Date().toLocaleTimeString();

    renderHoldings(); // refresh KRW values for stock holdings
  } catch (err) {
    console.error("Stock fetch failed:", err);
    document.getElementById("stocks-grid").innerHTML =
      '<div class="stock-loading">Failed to load stock prices. Market may be closed.</div>';
  }
}

function renderStocksGrid() {
  const grid = document.getElementById("stocks-grid");
  const usd_krw = cryptoPrices.usd_krw || 1350;

  grid.innerHTML = Object.entries(stockData.meta || {}).map(([ticker, name]) => {
    const price = stockData.prices?.[ticker];
    const priceUSD = price != null ? fmtUSD.format(price) : '<span class="stock-na">N/A</span>';
    const priceKRW = price != null ? fmtKRW.format(price * usd_krw) : "";
    return `<div class="stock-card">
      <div class="stock-ticker">${ticker}</div>
      <div class="stock-name">${name}</div>
      <div class="stock-price-usd">${priceUSD}</div>
      ${priceKRW ? `<div class="stock-price-krw">${priceKRW}</div>` : ""}
    </div>`;
  }).join("");
}

// ── Holdings ──────────────────────────────────────────────────
async function fetchHoldings() {
  const res = await fetch("/api/holdings");
  holdings = await res.json();
  renderHoldings();
}

function calcKRW(h) {
  const t = h.asset_type;
  if (t === "BTC") return h.amount * cryptoPrices.btc;
  if (t === "ETH") return h.amount * cryptoPrices.eth;
  if (t === "KRW") return h.amount;
  if (STOCK_TYPES.has(t)) {
    const usd = stockData.prices?.[t] ?? 0;
    return h.amount * usd * (cryptoPrices.usd_krw || 1350);
  }
  return 0;
}

function renderHoldings() {
  const tbody = document.getElementById("holdings-tbody");

  if (!holdings.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No assets yet. Click "+ Add Entry" to get started.</td></tr>';
    document.getElementById("total-krw").textContent = "₩0";
    return;
  }

  let total = 0;
  tbody.innerHTML = holdings.map(h => {
    const krw = calcKRW(h);
    total += krw;
    const isStock = STOCK_TYPES.has(h.asset_type);
    const usdVal = isStock && stockData.prices?.[h.asset_type]
      ? `<span class="usd-sub">${fmtUSD.format(h.amount * stockData.prices[h.asset_type])}</span>` : "";
    const badgeCls = isStock ? "badge-stock" : `badge-${h.asset_type.toLowerCase()}`;

    return `<tr data-id="${h.id}">
      <td>${escHtml(h.label)}</td>
      <td><span class="badge ${badgeCls}">${h.asset_type}</span></td>
      <td class="amount-cell" data-id="${h.id}" data-amount="${h.amount}">${fmtNum(h.amount)}</td>
      <td class="krw-val">${fmtKRW.format(krw)}${usdVal}</td>
      <td><button class="btn-del" data-id="${h.id}" title="Delete">✕</button></td>
    </tr>`;
  }).join("");

  document.getElementById("total-krw").textContent = fmtKRW.format(total);

  tbody.querySelectorAll(".amount-cell").forEach(c => c.addEventListener("click", startEdit));
  tbody.querySelectorAll(".btn-del").forEach(b => b.addEventListener("click", () => deleteHolding(+b.dataset.id)));
}

function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function startEdit(e) {
  const cell = e.currentTarget;
  const id = +cell.dataset.id;
  const current = cell.dataset.amount;

  cell.className = "";
  cell.innerHTML = `<input class="amount-input" type="number" value="${current}" step="any" min="0" />`;
  const input = cell.querySelector("input");
  input.focus(); input.select();

  let saved = false;
  const finish = async () => {
    if (saved) return; saved = true;
    const newVal = parseFloat(input.value);
    if (!isNaN(newVal) && newVal !== parseFloat(current)) {
      await updateHolding(id, newVal);
    } else {
      await fetchHoldings();
    }
  };
  input.addEventListener("blur", finish);
  input.addEventListener("keydown", async ke => {
    if (ke.key === "Enter") input.blur();
    if (ke.key === "Escape") { saved = true; await fetchHoldings(); }
  });
}

async function updateHolding(id, amount) {
  await fetch(`/api/holdings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  await Promise.all([fetchHoldings(), fetchLogs(), fetchHistory()]);
}

async function deleteHolding(id) {
  const label = holdings.find(h => h.id === id)?.label ?? "this entry";
  if (!confirm(`Delete "${label}"?`)) return;
  await fetch(`/api/holdings/${id}`, { method: "DELETE" });
  await Promise.all([fetchHoldings(), fetchLogs()]);
}

// ── Add Entry Form ────────────────────────────────────────────
document.getElementById("add-btn").addEventListener("click", () => {
  document.getElementById("add-form").classList.remove("hidden");
  document.getElementById("new-label").focus();
});
document.getElementById("cancel-new-btn").addEventListener("click", () => {
  document.getElementById("add-form").classList.add("hidden");
  clearAddForm();
});
document.getElementById("save-new-btn").addEventListener("click", async () => {
  const label = document.getElementById("new-label").value.trim();
  const asset_type = document.getElementById("new-type").value;
  const amount = parseFloat(document.getElementById("new-amount").value);

  if (!label || isNaN(amount) || amount < 0) {
    alert("Please enter a label and a valid amount.");
    return;
  }
  await fetch("/api/holdings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, asset_type, amount }),
  });
  document.getElementById("add-form").classList.add("hidden");
  clearAddForm();
  await Promise.all([fetchHoldings(), fetchLogs(), fetchHistory()]);
});

function clearAddForm() {
  document.getElementById("new-label").value = "";
  document.getElementById("new-amount").value = "";
  document.getElementById("new-type").value = "BTC";
}

// ── Portfolio Chart ───────────────────────────────────────────
async function fetchHistory() {
  const res = await fetch("/api/portfolio/history");
  const data = await res.json();
  const canvas = document.getElementById("portfolio-chart");
  const empty  = document.getElementById("chart-empty");

  if (!data.length) {
    canvas.classList.add("hidden"); empty.classList.remove("hidden"); return;
  }
  canvas.classList.remove("hidden"); empty.classList.add("hidden");

  const labels = data.map(d => d.date);
  const values = data.map(d => d.total_krw);
  const isUp = values[values.length - 1] >= values[0];
  const lineColor = isUp ? "#3fb950" : "#f85149";
  const fillColor = isUp ? "rgba(63,185,80,0.08)" : "rgba(248,81,73,0.08)";

  if (portfolioChart) {
    portfolioChart.data.labels = labels;
    portfolioChart.data.datasets[0].data = values;
    portfolioChart.data.datasets[0].borderColor = lineColor;
    portfolioChart.data.datasets[0].backgroundColor = fillColor;
    portfolioChart.update("none");
    return;
  }

  portfolioChart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { labels, datasets: [{
      data: values, borderColor: lineColor, backgroundColor: fillColor,
      borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, fill: true, tension: 0.3,
    }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => fmtKRW.format(ctx.parsed.y) } },
      },
      scales: {
        x: { ticks: { color: "#6e7681", maxRotation: 0, maxTicksLimit: 10 }, grid: { color: "#21262d" } },
        y: {
          ticks: { color: "#6e7681", callback: v => {
            if (v >= 1e8) return (v / 1e8).toFixed(1) + "억";
            if (v >= 1e4) return (v / 1e4).toFixed(0) + "만";
            return v.toLocaleString();
          }},
          grid: { color: "#21262d" },
        },
      },
    },
  });
}

// ── Change Log ────────────────────────────────────────────────
async function fetchLogs() {
  const res = await fetch("/api/logs");
  const logs = await res.json();
  const el = document.getElementById("log-list");

  if (!logs.length) { el.innerHTML = '<div class="empty-log">No changes logged yet.</div>'; return; }

  el.innerHTML = logs.map(log => {
    const diff = log.new_amount - log.old_amount;
    const isNew = log.old_amount === 0 && log.new_amount > 0;
    const isDel = log.new_amount === 0 && log.old_amount > 0;
    let cls, changeStr;

    if (isNew) {
      cls = "log-new"; changeStr = `Added ${fmtNum(log.new_amount)} ${log.asset_type}`;
    } else if (isDel) {
      cls = "log-del"; changeStr = `Removed ${fmtNum(log.old_amount)} ${log.asset_type}`;
    } else {
      cls = diff >= 0 ? "log-up" : "log-down";
      const sign = diff > 0 ? "+" : "";
      changeStr = `${fmtNum(log.old_amount)} → ${fmtNum(log.new_amount)} ${log.asset_type} (${sign}${fmtNum(diff)})`;
    }

    const time = new Date(log.changed_at + "Z").toLocaleString();
    const totalStr = log.total_krw ? `Total: ${fmtKRW.format(log.total_krw)}` : "";

    return `<div class="log-item">
      <span class="log-time">${time}</span>
      <span class="log-label">${escHtml(log.label)}</span>
      <span class="log-change ${cls}">${changeStr}</span>
      ${totalStr ? `<span class="log-total">${totalStr}</span>` : ""}
    </div>`;
  }).join("");
}

// ── Refresh Button ────────────────────────────────────────────
document.getElementById("refresh-btn").addEventListener("click", async () => {
  const btn = document.getElementById("refresh-btn");
  btn.style.transition = "transform 0.5s"; btn.style.transform = "rotate(360deg)";
  setTimeout(() => { btn.style.transform = ""; btn.style.transition = ""; }, 500);
  await Promise.all([fetchCryptoPrices(), fetchStockPrices()]);
});

// ── Init ──────────────────────────────────────────────────────
(async () => {
  await fetchCryptoPrices();
  await Promise.all([fetchHoldings(), fetchHistory(), fetchLogs(), fetchStockPrices()]);

  setInterval(fetchCryptoPrices, 60_000);
  setInterval(fetchStockPrices, 300_000); // stocks every 5 min
})();
