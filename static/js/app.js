// ── Formatters ───────────────────────────────────────────────
const fmtKRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const fmtUSD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const fmtNum = v => {
  if (v == null) return "—";
  const abs = Math.abs(v);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: abs >= 1 ? 4 : 8 }).format(v);
};
function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Constants ─────────────────────────────────────────────────
const STOCK_TYPES = new Set(["AAPL","AMZN","CVX","LLY","GOOGL","GOOG","NVO","OXY","MSTR","NVDA"]);
const KOSPI_TYPES = new Set(["005930.KS","000660.KS"]);
const KOSPI_BADGE = { "005930.KS": "삼성전자", "000660.KS": "SK하이닉스" };

// ── State ─────────────────────────────────────────────────────
let cryptoPrices   = { btc: 0, eth: 0, usd_krw: 1350 };
let stockData      = { prices: {}, kospi_prices: {}, meta: {}, kospi_meta: {} };
let holdings       = [];
let totalChart     = null;
let activeTab      = "total";
let isAuthenticated = false;

// ── Breakdown (live) ─────────────────────────────────────────
function computeBreakdown() {
  const usd_krw = cryptoPrices.usd_krw || 1350;
  const bd = { btc: 0, eth: 0, us: 0, korean: 0, krw: 0 };
  holdings.forEach(h => {
    const t = h.asset_type, amt = h.amount;
    if      (t === "BTC")          bd.btc    += amt * cryptoPrices.btc;
    else if (t === "ETH")          bd.eth    += amt * cryptoPrices.eth;
    else if (t === "KRW")          bd.krw    += amt;
    else if (STOCK_TYPES.has(t))   bd.us     += amt * (stockData.prices?.[t] || 0) * usd_krw;
    else if (KOSPI_TYPES.has(t))   bd.korean += amt * (stockData.kospi_prices?.[t] || 0);
  });
  bd.total = bd.btc + bd.eth + bd.us + bd.korean + bd.krw;
  return bd;
}

function calcKRW(h) {
  const t = h.asset_type;
  if (t === "BTC") return h.amount * cryptoPrices.btc;
  if (t === "ETH") return h.amount * cryptoPrices.eth;
  if (t === "KRW") return h.amount;
  if (STOCK_TYPES.has(t)) return h.amount * (stockData.prices?.[t] || 0) * (cryptoPrices.usd_krw || 1350);
  if (KOSPI_TYPES.has(t)) return h.amount * (stockData.kospi_prices?.[t] || 0);
  return 0;
}

// ── Tab switching ─────────────────────────────────────────────
function switchTab(tab) {
  if (tab === "entry" && !isAuthenticated) {
    showAuthModal(tab); return;
  }
  activeTab = tab;
  document.querySelectorAll(".tab-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach(p =>
    p.classList.toggle("hidden", p.id !== `tab-${tab}`));
  renderActiveTab();
}

document.querySelectorAll(".tab-btn").forEach(btn =>
  btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

// ── Auth Modal ────────────────────────────────────────────────
function showAuthModal(targetTab) {
  const modal = document.getElementById("auth-modal");
  modal.classList.remove("hidden");
  document.getElementById("auth-pw").value = "";
  document.getElementById("auth-error").classList.add("hidden");
  document.getElementById("auth-pw").focus();

  const cleanup = () => modal.classList.add("hidden");

  document.getElementById("auth-cancel").onclick = cleanup;
  document.getElementById("modal-backdrop")?.addEventListener("click", cleanup);

  document.getElementById("auth-submit").onclick = async () => {
    const pw = document.getElementById("auth-pw").value;
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      isAuthenticated = true;
      cleanup();
      switchTab(targetTab);
    } else {
      document.getElementById("auth-error").classList.remove("hidden");
      document.getElementById("auth-pw").select();
    }
  };

  document.getElementById("auth-pw").onkeydown = e => {
    if (e.key === "Enter")  document.getElementById("auth-submit").click();
    if (e.key === "Escape") cleanup();
  };
}

// ── Fetch Crypto Prices ───────────────────────────────────────
async function fetchCryptoPrices() {
  try {
    const res  = await fetch("/api/prices");
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    cryptoPrices = data;
    renderActiveTab();
  } catch (err) { console.error("Crypto fetch failed:", err); }
}

// ── Fetch Stock Prices ────────────────────────────────────────
async function fetchStockPrices() {
  try {
    const res  = await fetch("/api/stocks");
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    stockData = data;
    const ts = "Updated " + new Date().toLocaleTimeString();
    document.getElementById("stock-ts").textContent  = ts;
    document.getElementById("kospi-ts").textContent  = ts;
    renderActiveTab();
  } catch (err) { console.error("Stock fetch failed:", err); }
}

// ── Fetch Holdings ────────────────────────────────────────────
async function fetchHoldings() {
  const res = await fetch("/api/holdings");
  holdings  = await res.json();
  renderActiveTab();
}

// ── Render dispatcher ─────────────────────────────────────────
function renderActiveTab() {
  const bd = computeBreakdown();
  updateSummaryCards(bd);

  if (activeTab === "total")   { /* summary already updated; chart needs data */ }
  if (activeTab === "us")      renderUSTab();
  if (activeTab === "korean")  renderKoreanTab();
  if (activeTab === "crypto")  renderCryptoTab();
  if (activeTab === "krw")     renderKRWTab();
  if (activeTab === "entry")   renderEntryTab();
}

// ── Summary Cards ─────────────────────────────────────────────
function updateSummaryCards(bd) {
  document.getElementById("sum-total").textContent  = fmtKRW.format(bd.total);
  document.getElementById("sum-btc").textContent    = fmtKRW.format(bd.btc);
  document.getElementById("sum-eth").textContent    = fmtKRW.format(bd.eth);
  document.getElementById("sum-us").textContent     = fmtKRW.format(bd.us);
  document.getElementById("sum-korean").textContent = fmtKRW.format(bd.korean);
  document.getElementById("sum-krw").textContent    = fmtKRW.format(bd.krw);
}

// ── US Stocks Tab ─────────────────────────────────────────────
function renderUSTab() {
  const usd_krw = cryptoPrices.usd_krw || 1350;

  // Prices grid
  document.getElementById("us-usd-krw").textContent = fmtKRW.format(usd_krw);
  document.getElementById("stocks-grid").innerHTML =
    Object.entries(stockData.meta || {}).map(([t, name]) => {
      const p = stockData.prices?.[t];
      return `<div class="stock-card">
        <div class="stock-ticker">${t}</div>
        <div class="stock-name">${name}</div>
        <div class="stock-price">${p != null ? fmtUSD.format(p) : '<span class="stock-na">N/A</span>'}</div>
        ${p != null ? `<div class="stock-sub">${fmtKRW.format(p * usd_krw)}</div>` : ""}
      </div>`;
    }).join("") || '<div class="stock-loading">No data</div>';

  // Holdings
  const usH = holdings.filter(h => STOCK_TYPES.has(h.asset_type));
  let total  = 0;
  const tbody = document.getElementById("us-tbody");
  if (!usH.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No US stock holdings yet.</td></tr>';
  } else {
    tbody.innerHTML = usH.map(h => {
      const usd    = stockData.prices?.[h.asset_type] || 0;
      const krw    = h.amount * usd * usd_krw;
      total += krw;
      return `<tr>
        <td>${escHtml(h.label)}</td>
        <td><span class="badge badge-stock">${h.asset_type}</span></td>
        <td>${fmtNum(h.amount)}</td>
        <td class="krw-muted">${usd ? fmtUSD.format(h.amount * usd) : "—"}</td>
        <td>${fmtKRW.format(krw)}</td>
      </tr>`;
    }).join("");
  }
  document.getElementById("us-subtotal").textContent = fmtKRW.format(total);
}

// ── Korean Tab ────────────────────────────────────────────────
function renderKoreanTab() {
  document.getElementById("kospi-grid").innerHTML =
    Object.entries(stockData.kospi_meta || {}).map(([t, name]) => {
      const p = stockData.kospi_prices?.[t];
      return `<div class="stock-card kospi">
        <div class="stock-ticker">${KOSPI_BADGE[t] ?? t}</div>
        <div class="stock-name">${name}</div>
        <div class="stock-price">${p != null ? fmtKRW.format(p) : '<span class="stock-na">N/A</span>'}</div>
      </div>`;
    }).join("") || '<div class="stock-loading">No data</div>';

  const kH    = holdings.filter(h => KOSPI_TYPES.has(h.asset_type));
  let total   = 0;
  const tbody = document.getElementById("korean-tbody");
  if (!kH.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No Korean stock holdings yet.</td></tr>';
  } else {
    tbody.innerHTML = kH.map(h => {
      const p   = stockData.kospi_prices?.[h.asset_type] || 0;
      const krw = h.amount * p;
      total += krw;
      return `<tr>
        <td>${escHtml(h.label)}</td>
        <td><span class="badge badge-kospi">${KOSPI_BADGE[h.asset_type] ?? h.asset_type}</span></td>
        <td>${fmtNum(h.amount)}</td>
        <td>${fmtKRW.format(krw)}</td>
      </tr>`;
    }).join("");
  }
  document.getElementById("korean-subtotal").textContent = fmtKRW.format(total);
}

// ── Crypto Tab ────────────────────────────────────────────────
function renderCryptoTab() {
  document.getElementById("crypto-btc-price").textContent = fmtKRW.format(cryptoPrices.btc);
  document.getElementById("crypto-eth-price").textContent = fmtKRW.format(cryptoPrices.eth);
  document.getElementById("crypto-ts").textContent = "Updated " + new Date().toLocaleTimeString();

  const cH    = holdings.filter(h => h.asset_type === "BTC" || h.asset_type === "ETH");
  let total   = 0;
  const tbody = document.getElementById("crypto-tbody");
  if (!cH.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No crypto holdings yet.</td></tr>';
  } else {
    tbody.innerHTML = cH.map(h => {
      const krw = calcKRW(h);
      total += krw;
      const cls = h.asset_type === "BTC" ? "badge-btc" : "badge-eth";
      return `<tr>
        <td>${escHtml(h.label)}</td>
        <td><span class="badge ${cls}">${h.asset_type}</span></td>
        <td>${fmtNum(h.amount)}</td>
        <td>${fmtKRW.format(krw)}</td>
      </tr>`;
    }).join("");
  }
  document.getElementById("crypto-subtotal").textContent = fmtKRW.format(total);
}

// ── KRW Tab ───────────────────────────────────────────────────
function renderKRWTab() {
  const kH    = holdings.filter(h => h.asset_type === "KRW");
  let total   = 0;
  const tbody = document.getElementById("krw-tbody");
  if (!kH.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="2">No KRW holdings yet.</td></tr>';
  } else {
    tbody.innerHTML = kH.map(h => {
      total += h.amount;
      return `<tr>
        <td>${escHtml(h.label)}</td>
        <td>${fmtKRW.format(h.amount)}</td>
      </tr>`;
    }).join("");
  }
  document.getElementById("krw-subtotal").textContent = fmtKRW.format(total);
}

// ── Entry Tab ─────────────────────────────────────────────────
function renderEntryTab() {
  const tbody = document.getElementById("entry-tbody");
  if (!holdings.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No assets yet.</td></tr>';
    return;
  }
  tbody.innerHTML = holdings.map(h => {
    const krw      = calcKRW(h);
    const isKospi  = KOSPI_TYPES.has(h.asset_type);
    const isStock  = STOCK_TYPES.has(h.asset_type);
    const badgeLbl = isKospi ? (KOSPI_BADGE[h.asset_type] ?? h.asset_type) : h.asset_type;
    const badgeCls = isKospi ? "badge-kospi" : isStock ? "badge-stock" : `badge-${h.asset_type.toLowerCase()}`;
    return `<tr data-id="${h.id}">
      <td>${escHtml(h.label)}</td>
      <td><span class="badge ${badgeCls}">${badgeLbl}</span></td>
      <td class="amount-cell" data-id="${h.id}" data-amount="${h.amount}">${fmtNum(h.amount)}</td>
      <td class="krw-muted">${fmtKRW.format(krw)}</td>
      <td><button class="btn-del" data-id="${h.id}">✕</button></td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll(".amount-cell").forEach(c => c.addEventListener("click", startEdit));
  tbody.querySelectorAll(".btn-del").forEach(b => b.addEventListener("click", () => deleteHolding(+b.dataset.id)));
}

// ── Inline edit ───────────────────────────────────────────────
function startEdit(e) {
  const cell    = e.currentTarget;
  const id      = +cell.dataset.id;
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
    } else { await fetchHoldings(); }
  };
  input.addEventListener("blur", finish);
  input.addEventListener("keydown", async ke => {
    if (ke.key === "Enter")  input.blur();
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
  await Promise.all([fetchHoldings(), fetchLogs(), fetchHistory()]);
}

// ── Add Entry Form ────────────────────────────────────────────
document.getElementById("add-btn").addEventListener("click", () => {
  document.getElementById("add-form").classList.remove("hidden");
  document.getElementById("new-label").focus();
});
document.getElementById("cancel-new-btn").addEventListener("click", () => {
  document.getElementById("add-form").classList.add("hidden"); clearAddForm();
});
document.getElementById("save-new-btn").addEventListener("click", async () => {
  const label      = document.getElementById("new-label").value.trim();
  const asset_type = document.getElementById("new-type").value;
  const amount     = parseFloat(document.getElementById("new-amount").value);
  if (!label || isNaN(amount) || amount < 0) { alert("Please enter a label and a valid amount."); return; }
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
  document.getElementById("new-label").value  = "";
  document.getElementById("new-amount").value = "";
  document.getElementById("new-type").value   = "BTC";
}

// ── Portfolio History Chart (Total tab) ───────────────────────
const SERIES = [
  { key: "total_krw",        label: "Total",  color: "#f0f6fc" },
  { key: "btc_total_krw",    label: "BTC",    color: "#f7931a" },
  { key: "eth_total_krw",    label: "ETH",    color: "#627eea" },
  { key: "us_total_krw",     label: "US",     color: "#58a6ff" },
  { key: "korean_total_krw", label: "Korean", color: "#ff6b6b" },
  { key: "krw_total_krw",    label: "KRW",    color: "#3fb950" },
];

async function fetchHistory() {
  const res  = await fetch("/api/portfolio/history");
  const data = await res.json();

  const canvas = document.getElementById("total-chart");
  const empty  = document.getElementById("total-chart-empty");

  if (!data.length) {
    canvas.classList.add("hidden"); empty.classList.remove("hidden"); return;
  }
  canvas.classList.remove("hidden"); empty.classList.add("hidden");

  const labels   = data.map(d => d.date);
  const datasets = SERIES.map((s, i) => ({
    id:          s.key,
    label:       s.label,
    data:        data.map(d => d[s.key] || 0),
    borderColor: s.color,
    backgroundColor: s.color + "18",
    borderWidth: i === 0 ? 2.5 : 1.5,
    pointRadius: 2,
    pointHoverRadius: 4,
    fill: false,
    tension: 0.3,
  }));

  if (totalChart) {
    totalChart.data.labels = labels;
    totalChart.data.datasets.forEach((ds, i) => { ds.data = datasets[i].data; });
    totalChart.update("none"); return;
  }

  totalChart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtKRW.format(ctx.parsed.y)}` } },
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

  // Wire toggle buttons
  document.querySelectorAll(".tog").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = +btn.dataset.ds;
      const ds  = totalChart.data.datasets[idx];
      ds.hidden = !ds.hidden;
      btn.classList.toggle("active", !ds.hidden);
      totalChart.update();
    });
  });
}

// ── Change Log ────────────────────────────────────────────────
async function fetchLogs() {
  const res  = await fetch("/api/logs");
  const logs = await res.json();
  const el   = document.getElementById("log-list");
  if (!logs.length) { el.innerHTML = '<div class="empty-msg">No changes yet.</div>'; return; }

  el.innerHTML = logs.map(log => {
    const diff  = log.new_amount - log.old_amount;
    const isNew = log.old_amount === 0 && log.new_amount > 0;
    const isDel = log.new_amount === 0 && log.old_amount > 0;
    let cls, txt;
    if (isNew)       { cls = "log-new";  txt = `Added ${fmtNum(log.new_amount)} ${log.asset_type}`; }
    else if (isDel)  { cls = "log-del";  txt = `Removed ${fmtNum(log.old_amount)} ${log.asset_type}`; }
    else {
      cls = diff >= 0 ? "log-up" : "log-down";
      txt = `${fmtNum(log.old_amount)} → ${fmtNum(log.new_amount)} ${log.asset_type} (${diff > 0 ? "+" : ""}${fmtNum(diff)})`;
    }
    const time     = new Date(log.changed_at + "Z").toLocaleString();
    const totalStr = log.total_krw ? `Total: ${fmtKRW.format(log.total_krw)}` : "";
    return `<div class="log-item">
      <span class="log-time">${time}</span>
      <span class="log-label">${escHtml(log.label)}</span>
      <span class="log-change ${cls}">${txt}</span>
      ${totalStr ? `<span class="log-total">${totalStr}</span>` : ""}
    </div>`;
  }).join("");
}

// ── Refresh button ────────────────────────────────────────────
document.getElementById("refresh-btn").addEventListener("click", async () => {
  const btn = document.getElementById("refresh-btn");
  btn.style.transition = "transform 0.5s";
  btn.style.transform  = "rotate(360deg)";
  setTimeout(() => { btn.style.transform = ""; btn.style.transition = ""; }, 500);
  await Promise.all([fetchCryptoPrices(), fetchStockPrices()]);
});

// ── Init ──────────────────────────────────────────────────────
(async () => {
  await fetchCryptoPrices();
  await Promise.all([fetchHoldings(), fetchHistory(), fetchLogs(), fetchStockPrices()]);
  setInterval(fetchCryptoPrices, 60_000);
  setInterval(fetchStockPrices,  300_000);
})();
