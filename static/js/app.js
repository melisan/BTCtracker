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

// ── i18n ──────────────────────────────────────────────────────
let lang = "en";

const STRINGS = {
  en: {
    tab_total: "🌳 Overview",   tab_us: "📈 US Stocks",
    tab_korean: "🌸 Korean",    tab_crypto: "₿ Crypto",    tab_krw: "🐷 KRW",
    scard_total: "Total Harvest",  scard_btc: "₿ Bitcoin",  scard_eth: "Ξ Ethereum",
    scard_us: "📈 US Stocks",   scard_korean: "🌸 Korean",  scard_krw: "🐷 KRW Cash",
    chart_alloc: "Harvest Allocation",  chart_growth: "Growth Over Time 🌳",
    chart_us_perf: "30-Day Price Performance 📈",
    chart_crypto_perf: "30-Day Crypto Performance ₿",
    h2_us: "My US Holdings 🌿",   h2_korean: "My Korean Holdings 🌸",
    h2_crypto: "My Crypto Holdings ₿",  h2_krw: "My KRW Holdings 🐷",
    th_label: "Label",  th_shares: "Shares",   th_usd_val: "USD Value",
    th_krw_val: "KRW Value",  th_my_val: "My Value (₩)",
    th_asset: "Asset",  th_amount: "Amount",   th_amount_krw: "Amount (₩)",
    lbl_subtotal: "Subtotal",  lbl_total: "Total",
    lbl_usd_krw: "USD / KRW",
    btn_add: "+ Add",   btn_save: "Save",   btn_cancel: "Cancel",   btn_unlock: "Unlock",
    empty_us: "No US stock holdings yet.",
    empty_korean: "No Korean stock holdings yet.",
    empty_crypto: "No crypto holdings yet.",
    empty_krw: "No KRW holdings yet.",
    empty_us_chart: "Add US stock holdings to see price charts.",
    empty_crypto_chart: "Add crypto holdings to see price chart.",
    ph_us_label: "Label (e.g. Fidelity AAPL)",   ph_us_amount: "Shares",
    ph_korean_label: "Label (e.g. 삼성전자)",       ph_korean_amount: "Shares",
    ph_crypto_label: "Label (e.g. Upbit BTC)",    ph_crypto_amount: "Amount",
    ph_krw_label: "Label (e.g. Kakao Bank)",      ph_krw_amount: "Amount (₩)",
    ph_auth_pw: "Enter admin password",
    app_title: "Harvest Portfolio",
    app_tagline: "Faithful stewardship of every blessing",
    auth_title: "🔒 Admin Access",
    footer_verse: '"The blessing of the LORD brings wealth, and He adds no trouble to it."',
    footer_ref: "Proverbs 10:22",
    del_confirm: label => `Delete "${label}"?`,
  },
  ko: {
    tab_total: "🌳 개요",         tab_us: "📈 미국 주식",
    tab_korean: "🌸 한국 주식",   tab_crypto: "₿ 암호화폐",  tab_krw: "🐷 원화",
    scard_total: "총 자산",       scard_btc: "₿ 비트코인",   scard_eth: "Ξ 이더리움",
    scard_us: "📈 미국 주식",     scard_korean: "🌸 한국 주식", scard_krw: "🐷 원화 현금",
    chart_alloc: "자산 배분",     chart_growth: "성장 추이 🌳",
    chart_us_perf: "30일 미국 주식 추이 📈",
    chart_crypto_perf: "30일 암호화폐 추이 ₿",
    h2_us: "미국 주식 보유 🌿",   h2_korean: "한국 주식 보유 🌸",
    h2_crypto: "암호화폐 보유 ₿", h2_krw: "원화 보유 🐷",
    th_label: "라벨",   th_shares: "주수",     th_usd_val: "달러 가치",
    th_krw_val: "원화 가치",  th_my_val: "내 가치 (₩)",
    th_asset: "자산",   th_amount: "수량",     th_amount_krw: "금액 (₩)",
    lbl_subtotal: "소계",  lbl_total: "합계",
    lbl_usd_krw: "달러 / 원",
    btn_add: "+ 추가", btn_save: "저장", btn_cancel: "취소", btn_unlock: "잠금 해제",
    empty_us: "미국 주식 보유가 없습니다.",
    empty_korean: "한국 주식 보유가 없습니다.",
    empty_crypto: "암호화폐 보유가 없습니다.",
    empty_krw: "원화 보유가 없습니다.",
    empty_us_chart: "미국 주식을 추가하면 가격 차트가 표시됩니다.",
    empty_crypto_chart: "암호화폐를 추가하면 가격 차트가 표시됩니다.",
    ph_us_label: "라벨 (예: 피델리티 AAPL)",     ph_us_amount: "주수",
    ph_korean_label: "라벨 (예: 삼성전자)",        ph_korean_amount: "주수",
    ph_crypto_label: "라벨 (예: 업비트 BTC)",     ph_crypto_amount: "수량",
    ph_krw_label: "라벨 (예: 카카오뱅크)",         ph_krw_amount: "금액 (₩)",
    ph_auth_pw: "관리자 비밀번호 입력",
    app_title: "하베스트 포트폴리오",
    app_tagline: "모든 축복을 신실하게 관리합니다",
    auth_title: "🔒 관리자 접근",
    footer_verse: '"여호와의 복은 사람을 부하게 하고 근심을 겸하여 주지 아니하시느니라"',
    footer_ref: "잠언 10:22",
    del_confirm: label => `"${label}"을(를) 삭제할까요?`,
  },
};

function applyLang() {
  const S = STRINGS[lang];
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (S[key] !== undefined) el.textContent = S[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (S[key] !== undefined) el.placeholder = S[key];
  });
  const btn = document.getElementById("lang-btn");
  if (btn) btn.textContent = lang === "en" ? "한" : "EN";
  renderActiveTab();
}

// ── State ─────────────────────────────────────────────────────
let cryptoPrices    = { btc: 0, eth: 0, usd_krw: 1350 };
let stockData       = { prices: {}, kospi_prices: {}, meta: {}, kospi_meta: {} };
let holdings        = [];
let pieChart        = null;
let totalChart      = null;
let usStocksChart   = null;
let cryptoHistChart = null;
let activeTab       = "total";
let activeRange     = "daily";
let normalizeMode   = false;
let historyData     = [];
let usHistoryData   = {};
let isAuthenticated = false;
let editMode        = false;
let togglesWired    = false;

// ── Breakdown (live) ─────────────────────────────────────────
function computeBreakdown() {
  const usd_krw = cryptoPrices.usd_krw || 1350;
  const bd = { btc: 0, eth: 0, us: 0, korean: 0, krw: 0 };
  holdings.forEach(h => {
    const t = h.asset_type, amt = h.amount;
    if      (t === "BTC")         bd.btc    += amt * cryptoPrices.btc;
    else if (t === "ETH")         bd.eth    += amt * cryptoPrices.eth;
    else if (t === "KRW")         bd.krw    += amt;
    else if (STOCK_TYPES.has(t))  bd.us     += amt * (stockData.prices?.[t] || 0) * usd_krw;
    else if (KOSPI_TYPES.has(t))  bd.korean += amt * (stockData.kospi_prices?.[t] || 0);
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
function showAuthModal(onSuccess) {
  const modal = document.getElementById("auth-modal");
  modal.classList.remove("hidden");
  document.getElementById("auth-pw").value = "";
  document.getElementById("auth-error").classList.add("hidden");
  document.getElementById("auth-pw").focus();
  const cleanup = () => modal.classList.add("hidden");
  document.getElementById("auth-cancel").onclick = cleanup;
  document.getElementById("auth-submit").onclick = async () => {
    const pw  = document.getElementById("auth-pw").value;
    const res = await fetch("/api/auth", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) { isAuthenticated = true; cleanup(); if (onSuccess) onSuccess(); }
    else { document.getElementById("auth-error").classList.remove("hidden"); document.getElementById("auth-pw").select(); }
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
    document.getElementById("stock-ts").textContent = ts;
    document.getElementById("kospi-ts").textContent = ts;
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
  renderPieChart(bd);
  if (activeTab === "us")     renderUSTab();
  if (activeTab === "korean") renderKoreanTab();
  if (activeTab === "crypto") renderCryptoTab();
  if (activeTab === "krw")    renderKRWTab();
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

// ── Pie / Donut Chart ─────────────────────────────────────────
const PIE_LABELS = ["BTC", "ETH", "US Stocks", "Korean", "KRW"];
const PIE_COLORS = ["#f7931a", "#627eea", "#58a6ff", "#ff6b6b", "#3fb950"];

function renderPieChart(bd) {
  const canvas = document.getElementById("pie-chart");
  if (!canvas) return;
  const vals = [bd.btc, bd.eth, bd.us, bd.korean, bd.krw];

  if (pieChart) {
    pieChart.data.datasets[0].data = vals;
    pieChart.update("none");
  } else {
    pieChart = new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: PIE_LABELS,
        datasets: [{
          data: vals,
          backgroundColor: PIE_COLORS,
          borderColor: "#0d1117",
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => {
            const pct = bd.total > 0 ? (ctx.parsed / bd.total * 100).toFixed(1) : "0.0";
            return `${ctx.label}: ${fmtKRW.format(ctx.parsed)} (${pct}%)`;
          }}},
        },
        cutout: "62%",
      },
    });
  }

  const legend = document.getElementById("pie-legend");
  if (!legend) return;
  legend.innerHTML = PIE_LABELS.map((l, i) => {
    const pct = bd.total > 0 ? (vals[i] / bd.total * 100).toFixed(1) : "0.0";
    return `<div class="pie-leg-item">
      <span class="pie-dot" style="background:${PIE_COLORS[i]}"></span>
      <span class="pie-leg-label">${l}</span>
      <span class="pie-leg-val">${fmtKRW.format(vals[i])}</span>
      <span class="pie-leg-pct">${pct}%</span>
    </div>`;
  }).join("");
}

// ── Line Chart ────────────────────────────────────────────────
const SERIES = [
  { key: "total_krw",        label: "Total",  color: "#f0f6fc" },
  { key: "btc_total_krw",    label: "BTC",    color: "#f7931a" },
  { key: "eth_total_krw",    label: "ETH",    color: "#627eea" },
  { key: "us_total_krw",     label: "US",     color: "#58a6ff" },
  { key: "korean_total_krw", label: "Korean", color: "#ff6b6b" },
  { key: "krw_total_krw",    label: "KRW",    color: "#3fb950" },
];

function renderLineChart(data) {
  const canvas = document.getElementById("total-chart");
  const empty  = document.getElementById("total-chart-empty");
  if (!canvas) return;

  if (!data.length) {
    canvas.classList.add("hidden"); empty.classList.remove("hidden"); return;
  }
  canvas.classList.remove("hidden"); empty.classList.add("hidden");

  const labels = data.map(d => d.date);

  const datasets = SERIES.map((s, i) => {
    let values = data.map(d => d[s.key] || 0);
    if (normalizeMode) {
      const nonZero = values.filter(v => v > 0);
      if (nonZero.length) {
        const ref = nonZero[nonZero.length - 1];
        values = values.map(v => v > 0 ? parseFloat((v / ref * 100).toFixed(2)) : null);
      } else {
        values = values.map(() => null);
      }
    }
    return {
      id: s.key, label: s.label, data: values,
      borderColor: s.color, backgroundColor: s.color + "12",
      borderWidth: i === 0 ? 2.5 : 1.5,
      pointRadius: 0, pointHoverRadius: 4,
      fill: false, tension: 0.3, spanGaps: false,
    };
  });

  const yTickCb = normalizeMode
    ? v => v.toFixed(1) + "%"
    : v => {
        if (v >= 1e8) return (v / 1e8).toFixed(1) + "억";
        if (v >= 1e4) return (v / 1e4).toFixed(0) + "만";
        return v.toLocaleString();
      };

  const tooltipLabelCb = normalizeMode
    ? ctx => `${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) + "%" : "—"}`
    : ctx => `${ctx.dataset.label}: ${fmtKRW.format(ctx.parsed.y)}`;

  if (totalChart) {
    totalChart.data.labels = labels;
    totalChart.data.datasets.forEach((ds, i) => { ds.data = datasets[i].data; });
    totalChart.options.scales.y.ticks.callback = yTickCb;
    totalChart.options.plugins.tooltip.callbacks.label = tooltipLabelCb;
    totalChart.update("none");
    return;
  }

  totalChart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: tooltipLabelCb }},
      },
      scales: {
        x: { ticks: { color: "#6e7681", maxRotation: 0, maxTicksLimit: 10 }, grid: { color: "#21262d" }},
        y: { ticks: { color: "#6e7681", callback: yTickCb }, grid: { color: "#21262d" }},
      },
    },
  });

  if (!togglesWired) {
    togglesWired = true;
    document.querySelectorAll(".tog").forEach(btn => {
      btn.addEventListener("click", () => {
        const ds = totalChart.data.datasets[+btn.dataset.ds];
        ds.hidden = !ds.hidden;
        btn.classList.toggle("active", !ds.hidden);
        totalChart.update();
      });
    });
  }
}

async function fetchHistory() {
  try {
    const res = await fetch(`/api/portfolio/history?range=${activeRange}`);
    const raw = await res.json();
    historyData = raw.length > 1 ? raw.slice(0, -1) : raw;
    renderLineChart(historyData);
  } catch (err) { console.error("History fetch failed:", err); }
}

// Wire range buttons
document.querySelectorAll(".range-btn[data-range]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".range-btn[data-range]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeRange = btn.dataset.range;
    fetchHistory();
  });
});

// Wire normalize (Indexed) toggle
document.getElementById("normalize-btn").addEventListener("click", () => {
  normalizeMode = !normalizeMode;
  document.getElementById("normalize-btn").classList.toggle("active", normalizeMode);
  renderLineChart(historyData);
});

// ── Backfill ──────────────────────────────────────────────────
async function checkAndBackfill() {
  if (!holdings.length) return;
  try {
    const res  = await fetch("/api/portfolio/history?range=daily");
    const data = await res.json();
    if (data.length < 7) {
      const banner = document.getElementById("backfill-banner");
      banner.classList.remove("hidden");
      try {
        await fetch("/api/portfolio/backfill", { method: "POST" });
        await fetchHistory();
      } finally {
        banner.classList.add("hidden");
      }
    }
  } catch (err) {
    document.getElementById("backfill-banner")?.classList.add("hidden");
  }
}

// ── US Stock History Chart (US stocks only) ───────────────────
const STOCK_COLORS = [
  "#58a6ff","#3fb950","#a371f7","#e3b341","#ff7b72",
  "#79c0ff","#56d364","#ffa657","#ff6b6b","#f0883e",
];

async function fetchUSHistory() {
  try {
    const res = await fetch("/api/stocks/history");
    usHistoryData = await res.json();
    renderUSStocksChart();
    renderCryptoHistChart();
  } catch (err) { console.error("US history fetch failed:", err); }
}

function renderUSStocksChart() {
  const canvas = document.getElementById("us-stocks-chart");
  const empty  = document.getElementById("us-chart-empty");
  if (!canvas) return;

  const S = STRINGS[lang];
  const tickers = [...new Set(holdings.filter(h => STOCK_TYPES.has(h.asset_type)).map(h => h.asset_type))];
  if (!tickers.length || !Object.keys(usHistoryData).length) {
    canvas.classList.add("hidden"); empty.classList.remove("hidden");
    empty.textContent = S.empty_us_chart;
    return;
  }

  const allDates = [...new Set(tickers.flatMap(t => Object.keys(usHistoryData[t] || {})))].sort();
  if (!allDates.length) { canvas.classList.add("hidden"); empty.classList.remove("hidden"); return; }
  canvas.classList.remove("hidden"); empty.classList.add("hidden");

  let usIdx = 0;
  const datasets = tickers.map(t => {
    const prices = usHistoryData[t] || {};
    const vals   = allDates.map(d => prices[d] ?? null);
    const first  = vals.find(v => v != null) || 1;
    const color  = STOCK_COLORS[usIdx++ % STOCK_COLORS.length];
    return {
      label: t,
      data: vals.map(v => v != null ? parseFloat((v / first * 100).toFixed(2)) : null),
      borderColor: color, backgroundColor: "transparent",
      borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 4,
      fill: false, tension: 0.3, spanGaps: false,
    };
  });

  if (usStocksChart) {
    usStocksChart.data.labels   = allDates;
    usStocksChart.data.datasets = datasets;
    usStocksChart.update("none");
    return;
  }

  usStocksChart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { labels: allDates, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: true, labels: { color: "#8b949e", font: { size: 11 }, boxWidth: 12, padding: 10 }},
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) + "%" : "—"}` }},
      },
      scales: {
        x: { ticks: { color: "#6e7681", maxRotation: 0, maxTicksLimit: 8 }, grid: { color: "#21262d" }},
        y: { ticks: { color: "#6e7681", callback: v => v.toFixed(0) + "%" }, grid: { color: "#21262d" }},
      },
    },
  });
}

// ── Crypto History Chart (BTC / ETH) ─────────────────────────
const CRYPTO_COLORS = { BTC: "#f7931a", ETH: "#627eea" };

function renderCryptoHistChart() {
  const canvas = document.getElementById("crypto-price-chart");
  const empty  = document.getElementById("crypto-chart-empty");
  if (!canvas) return;

  const S = STRINGS[lang];
  const tickers = [...new Set(
    holdings.filter(h => h.asset_type === "BTC" || h.asset_type === "ETH").map(h => h.asset_type)
  )];

  if (!tickers.length || !Object.keys(usHistoryData).length) {
    canvas.classList.add("hidden"); empty.classList.remove("hidden");
    empty.textContent = S.empty_crypto_chart;
    return;
  }

  const allDates = [...new Set(tickers.flatMap(t => Object.keys(usHistoryData[t] || {})))].sort();
  if (!allDates.length) { canvas.classList.add("hidden"); empty.classList.remove("hidden"); return; }
  canvas.classList.remove("hidden"); empty.classList.add("hidden");

  const datasets = tickers.map(t => {
    const prices = usHistoryData[t] || {};
    const vals   = allDates.map(d => prices[d] ?? null);
    const first  = vals.find(v => v != null) || 1;
    return {
      label: t,
      data: vals.map(v => v != null ? parseFloat((v / first * 100).toFixed(2)) : null),
      borderColor: CRYPTO_COLORS[t] || "#888",
      backgroundColor: "transparent",
      borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
      fill: false, tension: 0.3, spanGaps: false,
    };
  });

  if (cryptoHistChart) {
    cryptoHistChart.data.labels   = allDates;
    cryptoHistChart.data.datasets = datasets;
    cryptoHistChart.update("none");
    return;
  }

  cryptoHistChart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { labels: allDates, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: true, labels: { color: "#8b949e", font: { size: 12 }, boxWidth: 14, padding: 12 }},
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) + "%" : "—"}` }},
      },
      scales: {
        x: { ticks: { color: "#6e7681", maxRotation: 0, maxTicksLimit: 8 }, grid: { color: "#21262d" }},
        y: { ticks: { color: "#6e7681", callback: v => v.toFixed(0) + "%" }, grid: { color: "#21262d" }},
      },
    },
  });
}

// ── Edit-mode helpers ─────────────────────────────────────────
function setLockBtn(id) {
  const btn = document.getElementById(id);
  if (btn) { btn.textContent = editMode ? "🔓" : "🔒"; btn.classList.toggle("active", editMode); }
}
function editRow(cells, delId) {
  return editMode
    ? `${cells}<td><button class="btn-del" data-id="${delId}">✕</button></td>`
    : `${cells}<td></td>`;
}
function wireEditRows(tbody) {
  if (!editMode) return;
  tbody.querySelectorAll(".amount-cell").forEach(c => c.addEventListener("click", startEdit));
  tbody.querySelectorAll(".btn-del").forEach(b => b.addEventListener("click", () => deleteHolding(+b.dataset.id)));
}

// ── US Stocks Tab ─────────────────────────────────────────────
function renderUSTab() {
  const S = STRINGS[lang];
  const usd_krw = cryptoPrices.usd_krw || 1350;
  document.getElementById("us-usd-krw").textContent = fmtKRW.format(usd_krw);
  setLockBtn("us-lock-btn");
  document.getElementById("us-add-btn")?.classList.toggle("hidden", !editMode);

  if (!Object.keys(usHistoryData).length) fetchUSHistory();
  else renderUSStocksChart();

  const usH   = holdings.filter(h => STOCK_TYPES.has(h.asset_type));
  let total   = 0;
  const tbody = document.getElementById("us-tbody");
  if (!usH.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">${S.empty_us}</td></tr>`;
  } else {
    tbody.innerHTML = usH.map(h => {
      const usd = stockData.prices?.[h.asset_type] || 0;
      const krw = h.amount * usd * usd_krw;
      total += krw;
      const amtAttrs = editMode ? `class="amount-cell" data-id="${h.id}" data-amount="${h.amount}"` : "";
      return `<tr>${editRow(
        `<td>${escHtml(h.label)}</td>
        <td ${amtAttrs}>${fmtNum(h.amount)}</td>
        <td class="krw-muted">${usd ? fmtUSD.format(h.amount * usd) : "—"}</td>
        <td>${fmtKRW.format(krw)}</td>`, h.id)}`;
    }).join("");
    wireEditRows(tbody);
  }
  document.getElementById("us-subtotal").textContent = fmtKRW.format(total);
}

// ── Korean Tab ────────────────────────────────────────────────
function renderKoreanTab() {
  const S = STRINGS[lang];
  setLockBtn("korean-lock-btn");
  document.getElementById("korean-add-btn")?.classList.toggle("hidden", !editMode);

  const kH    = holdings.filter(h => KOSPI_TYPES.has(h.asset_type));
  let total   = 0;
  const tbody = document.getElementById("korean-tbody");
  if (!kH.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="4">${S.empty_korean}</td></tr>`;
  } else {
    tbody.innerHTML = kH.map(h => {
      const p   = stockData.kospi_prices?.[h.asset_type] || 0;
      const krw = h.amount * p;
      total += krw;
      const amtAttrs = editMode ? `class="amount-cell" data-id="${h.id}" data-amount="${h.amount}"` : "";
      return `<tr>${editRow(
        `<td>${escHtml(h.label)}</td>
        <td ${amtAttrs}>${fmtNum(h.amount)}</td>
        <td>${fmtKRW.format(krw)}</td>`, h.id)}`;
    }).join("");
    wireEditRows(tbody);
  }
  document.getElementById("korean-subtotal").textContent = fmtKRW.format(total);
}

// ── Crypto Tab ────────────────────────────────────────────────
function renderCryptoTab() {
  const S = STRINGS[lang];
  document.getElementById("crypto-btc-price").textContent = fmtKRW.format(cryptoPrices.btc);
  document.getElementById("crypto-eth-price").textContent = fmtKRW.format(cryptoPrices.eth);
  document.getElementById("crypto-ts").textContent = "Updated " + new Date().toLocaleTimeString();
  setLockBtn("crypto-lock-btn");
  document.getElementById("crypto-add-btn")?.classList.toggle("hidden", !editMode);

  if (!Object.keys(usHistoryData).length) fetchUSHistory();
  else renderCryptoHistChart();

  const cH    = holdings.filter(h => h.asset_type === "BTC" || h.asset_type === "ETH");
  let total   = 0;
  const tbody = document.getElementById("crypto-tbody");
  if (!cH.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">${S.empty_crypto}</td></tr>`;
  } else {
    tbody.innerHTML = cH.map(h => {
      const krw = calcKRW(h);
      total += krw;
      const cls = h.asset_type === "BTC" ? "badge-btc" : "badge-eth";
      const amtAttrs = editMode ? `class="amount-cell" data-id="${h.id}" data-amount="${h.amount}"` : "";
      return `<tr>${editRow(
        `<td>${escHtml(h.label)}</td>
        <td><span class="badge ${cls}">${h.asset_type}</span></td>
        <td ${amtAttrs}>${fmtNum(h.amount)}</td>
        <td>${fmtKRW.format(krw)}</td>`, h.id)}`;
    }).join("");
    wireEditRows(tbody);
  }
  document.getElementById("crypto-subtotal").textContent = fmtKRW.format(total);
}

// ── KRW Tab ───────────────────────────────────────────────────
function renderKRWTab() {
  const S = STRINGS[lang];
  setLockBtn("krw-lock-btn");
  document.getElementById("krw-add-btn")?.classList.toggle("hidden", !editMode);

  const kH    = holdings.filter(h => h.asset_type === "KRW");
  let total   = 0;
  const tbody = document.getElementById("krw-tbody");
  if (!kH.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="3">${S.empty_krw}</td></tr>`;
  } else {
    tbody.innerHTML = kH.map(h => {
      total += h.amount;
      const amtAttrs = editMode ? `class="amount-cell" data-id="${h.id}" data-amount="${h.amount}"` : "";
      return `<tr>${editRow(
        `<td>${escHtml(h.label)}</td>
        <td ${amtAttrs}>${fmtKRW.format(h.amount)}</td>`, h.id)}`;
    }).join("");
    wireEditRows(tbody);
  }
  document.getElementById("krw-subtotal").textContent = fmtKRW.format(total);
}

// ── Inline edit ───────────────────────────────────────────────
function startEdit(e) {
  const cell = e.currentTarget, id = +cell.dataset.id, current = cell.dataset.amount;
  cell.className = "";
  cell.innerHTML = `<input class="amount-input" type="number" value="${current}" step="any" min="0" />`;
  const input = cell.querySelector("input");
  input.focus(); input.select();
  let saved = false;
  const finish = async () => {
    if (saved) return; saved = true;
    const v = parseFloat(input.value);
    if (!isNaN(v) && v !== parseFloat(current)) await updateHolding(id, v);
    else await fetchHoldings();
  };
  input.addEventListener("blur", finish);
  input.addEventListener("keydown", async ke => {
    if (ke.key === "Enter")  input.blur();
    if (ke.key === "Escape") { saved = true; await fetchHoldings(); }
  });
}

async function updateHolding(id, amount) {
  await fetch(`/api/holdings/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  await Promise.all([fetchHoldings(), fetchHistory()]);
}

async function deleteHolding(id) {
  const label = holdings.find(h => h.id === id)?.label ?? "this entry";
  if (!confirm(STRINGS[lang].del_confirm(label))) return;
  await fetch(`/api/holdings/${id}`, { method: "DELETE" });
  await Promise.all([fetchHoldings(), fetchHistory()]);
}

// ── Lock buttons ──────────────────────────────────────────────
document.querySelectorAll(".btn-edit-lock").forEach(btn => {
  btn.addEventListener("click", () => {
    if (!isAuthenticated) {
      showAuthModal(() => { editMode = true; renderActiveTab(); });
    } else {
      editMode = !editMode;
      if (!editMode) ["us","korean","crypto","krw"].forEach(p =>
        document.getElementById(`${p}-add-form`)?.classList.add("hidden"));
      renderActiveTab();
    }
  });
});

// ── Per-tab add forms ─────────────────────────────────────────
function wireAddForm(prefix, fixedType) {
  const form     = document.getElementById(`${prefix}-add-form`);
  const labelEl  = document.getElementById(`${prefix}-new-label`);
  const typeEl   = document.getElementById(`${prefix}-new-type`);
  const amountEl = document.getElementById(`${prefix}-new-amount`);
  document.getElementById(`${prefix}-add-btn`)?.addEventListener("click", () => {
    form?.classList.remove("hidden"); labelEl?.focus();
  });
  document.getElementById(`${prefix}-cancel-btn`)?.addEventListener("click", () => {
    form?.classList.add("hidden");
    if (labelEl)  labelEl.value  = "";
    if (amountEl) amountEl.value = "";
    if (typeEl)   typeEl.selectedIndex = 0;
  });
  document.getElementById(`${prefix}-save-btn`)?.addEventListener("click", async () => {
    const label      = labelEl?.value.trim();
    const asset_type = typeEl ? typeEl.value : fixedType;
    const amount     = parseFloat(amountEl?.value);
    if (!label || isNaN(amount) || amount < 0) { alert("Enter a label and valid amount."); return; }
    await fetch("/api/holdings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, asset_type, amount }),
    });
    form?.classList.add("hidden");
    if (labelEl)  labelEl.value  = "";
    if (amountEl) amountEl.value = "";
    if (typeEl)   typeEl.selectedIndex = 0;
    await Promise.all([fetchHoldings(), fetchHistory()]);
  });
}
wireAddForm("us");
wireAddForm("korean");
wireAddForm("crypto");
wireAddForm("krw", "KRW");

// ── Language toggle ───────────────────────────────────────────
document.getElementById("lang-btn")?.addEventListener("click", () => {
  lang = lang === "en" ? "ko" : "en";
  applyLang();
});

// ── Refresh button ────────────────────────────────────────────
document.getElementById("refresh-btn").addEventListener("click", async () => {
  const btn = document.getElementById("refresh-btn");
  btn.style.transition = "transform 0.5s"; btn.style.transform = "rotate(360deg)";
  setTimeout(() => { btn.style.transform = ""; btn.style.transition = ""; }, 500);
  await Promise.all([fetchCryptoPrices(), fetchStockPrices()]);
});

// ── Init ──────────────────────────────────────────────────────
(async () => {
  await fetchCryptoPrices();
  await Promise.all([fetchHoldings(), fetchHistory(), fetchStockPrices()]);
  await checkAndBackfill();
  setInterval(fetchStockPrices, 300_000);
})();
