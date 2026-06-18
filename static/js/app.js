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

const DEFAULT_RETIREMENT = {
  kyowon: {
    monthly: 1500000, startYear: 2014, startMonth: 4,
    durationYears: 30, durationMonths: 0, rate: 2.5,
    // Official 교원공제회 figures (조회 기준일 2026-06-19, 추정 기준일 2044-03-01)
    officialNet: 805169550, officialPrincipal: 438780000,
    officialInterest: 379847510, officialIncomeTax: 12234510,
    officialLocalTax: 1223450, officialAsOf: "2026-06-19",
    officialProjected: "2044-03-01",
  },
  sakhak: {
    currentSalary: 250000000, growthRate: 4.5,
    startYear: 2014, startMonth: 4, accrualRate: 1.7,
    birthYear: 1978, birthMonth: 12, birthDay: 3,
    retirementAge: 65, retirementYear: 2044, retirementMonth: 3,
  },
};

// ── i18n ──────────────────────────────────────────────────────
let lang = "en";

const STRINGS = {
  en: {
    tab_total: "🌳 Overview",   tab_us: "📈 US Stocks",
    tab_korean: "🌸 Korean",    tab_crypto: "₿ Crypto",    tab_krw: "🐷 KRW",
    tab_retirement: "🌾 Retirement",
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
    // Retirement
    ret_card_kyowon: "교원공제회",   ret_card_pension: "사학연금 / mo.",
    ret_card_time: "To Retirement",  ret_card_total: "Est. Retirement",
    h2_kyowon: "교원공제회 Savings", h2_sakhak: "사학연금 Pension",
    ret_monthly: "Monthly",   ret_start: "Start",  ret_duration: "Duration",
    ret_rate: "Rate",         ret_total_paid: "Total Paid",  ret_end_date: "Maturity",
    ret_lumpsum: "Est. Lump Sum",
    ret_salary: "Current Salary",  ret_growth: "Growth Rate",
    ret_service: "Service Period", ret_accrual: "Accrual Rate",
    ret_birth: "Birth Date",       ret_ret_age: "Retire Age",
    ret_final_salary: "Salary at Retirement",  ret_avg_salary: "Career Avg Salary",
    ret_monthly_pension: "Monthly Pension",    ret_annual_pension: "Annual Pension",
    ret_lifetime_pension: "20yr Total",        ret_ret_date: "Est. Retirement",
    ret_service_progress: "Service Record",
    ret_net_payout: "Net Payout (after tax)",
    ret_note_kyowon: "※ Official figures from 교원공제회 (2026-06-19). Update annually.",
    ret_note_sakhak: "※ Pension = career avg monthly income × service years × 1.7%. Subject to income caps and pension reform.",
    lbl_yr: "yr",  lbl_mo: "mo",
  },
  ko: {
    tab_total: "🌳 개요",         tab_us: "📈 미국 주식",
    tab_korean: "🌸 한국 주식",   tab_crypto: "₿ 암호화폐",  tab_krw: "🐷 원화",
    tab_retirement: "🌾 은퇴",
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
    // 은퇴
    ret_card_kyowon: "교원공제회",   ret_card_pension: "사학연금 / 월",
    ret_card_time: "퇴직까지",       ret_card_total: "총 노후자산",
    h2_kyowon: "교원공제회 장기저축급여", h2_sakhak: "사학연금",
    ret_monthly: "월 납입액",   ret_start: "가입월",  ret_duration: "납입기간",
    ret_rate: "이율",           ret_total_paid: "총 납입액",  ret_end_date: "만기",
    ret_lumpsum: "예상 일시금",
    ret_salary: "현재 연봉",    ret_growth: "연봉 상승률",
    ret_service: "재직기간",    ret_accrual: "연금 배율",
    ret_birth: "생년월일",      ret_ret_age: "퇴직 나이",
    ret_final_salary: "퇴직시 연봉",  ret_avg_salary: "재직 평균 연봉",
    ret_monthly_pension: "예상 월 수령", ret_annual_pension: "연간 수령",
    ret_lifetime_pension: "20년 총 수령", ret_ret_date: "예상 퇴직일",
    ret_service_progress: "재직 현황",
    ret_net_payout: "세후 수령액",
    ret_note_kyowon: "※ 교원공제회 공식 조회 결과 (2026-06-19 기준). 매년 업데이트 권장.",
    ret_note_sakhak: "※ 연금액 = 평균기준소득월액 × 재직연수 × 1.7%. 소득상한 및 개혁 내용에 따라 실제 금액 상이.",
    lbl_yr: "년",  lbl_mo: "개월",
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
let retirementParams = null;

// ── Retirement params ─────────────────────────────────────────
function loadRetirementParams() {
  try {
    const stored = localStorage.getItem("retirementParams");
    if (stored) {
      const parsed = JSON.parse(stored);
      const defK = DEFAULT_RETIREMENT.kyowon, defS = DEFAULT_RETIREMENT.sakhak;
      retirementParams = {
        kyowon: { ...defK, ...parsed.kyowon },
        sakhak: { ...defS, ...parsed.sakhak },
      };
    } else {
      retirementParams = JSON.parse(JSON.stringify(DEFAULT_RETIREMENT));
    }
  } catch { retirementParams = JSON.parse(JSON.stringify(DEFAULT_RETIREMENT)); }
}
function saveRetirementParams() {
  localStorage.setItem("retirementParams", JSON.stringify(retirementParams));
}

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
  if (activeTab === "us")         renderUSTab();
  if (activeTab === "korean")     renderKoreanTab();
  if (activeTab === "crypto")     renderCryptoTab();
  if (activeTab === "krw")        renderKRWTab();
  if (activeTab === "retirement") renderRetirementTab();
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
        datasets: [{ data: vals, backgroundColor: PIE_COLORS, borderColor: "#0d1117", borderWidth: 2, hoverOffset: 6 }],
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
  if (!data.length) { canvas.classList.add("hidden"); empty.classList.remove("hidden"); return; }
  canvas.classList.remove("hidden"); empty.classList.add("hidden");

  const labels   = data.map(d => d.date);
  const datasets = SERIES.map((s, i) => {
    let values = data.map(d => d[s.key] || 0);
    if (normalizeMode) {
      const nonZero = values.filter(v => v > 0);
      if (nonZero.length) {
        const ref = nonZero[nonZero.length - 1];
        values = values.map(v => v > 0 ? parseFloat((v / ref * 100).toFixed(2)) : null);
      } else { values = values.map(() => null); }
    }
    return {
      id: s.key, label: s.label, data: values,
      borderColor: s.color, backgroundColor: s.color + "12",
      borderWidth: i === 0 ? 2.5 : 1.5,
      pointRadius: 0, pointHoverRadius: 4, fill: false, tension: 0.3, spanGaps: false,
    };
  });

  const yTickCb = normalizeMode
    ? v => v.toFixed(1) + "%"
    : v => { if (v >= 1e8) return (v / 1e8).toFixed(1) + "억"; if (v >= 1e4) return (v / 1e4).toFixed(0) + "만"; return v.toLocaleString(); };
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
    type: "line", data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: tooltipLabelCb }}},
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

document.querySelectorAll(".range-btn[data-range]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".range-btn[data-range]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeRange = btn.dataset.range;
    fetchHistory();
  });
});

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
      try { await fetch("/api/portfolio/backfill", { method: "POST" }); await fetchHistory(); }
      finally { banner.classList.add("hidden"); }
    }
  } catch (err) { document.getElementById("backfill-banner")?.classList.add("hidden"); }
}

// ── US Stock History Chart ────────────────────────────────────
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
    canvas.classList.add("hidden"); empty.classList.remove("hidden"); empty.textContent = S.empty_us_chart; return;
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
    return { label: t, data: vals.map(v => v != null ? parseFloat((v / first * 100).toFixed(2)) : null),
      borderColor: color, backgroundColor: "transparent", borderWidth: 1.5,
      pointRadius: 0, pointHoverRadius: 4, fill: false, tension: 0.3, spanGaps: false };
  });

  if (usStocksChart) { usStocksChart.data.labels = allDates; usStocksChart.data.datasets = datasets; usStocksChart.update("none"); return; }
  usStocksChart = new Chart(canvas.getContext("2d"), {
    type: "line", data: { labels: allDates, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: true, labels: { color: "#8b949e", font: { size: 11 }, boxWidth: 12, padding: 10 }},
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) + "%" : "—"}` }}},
      scales: {
        x: { ticks: { color: "#6e7681", maxRotation: 0, maxTicksLimit: 8 }, grid: { color: "#21262d" }},
        y: { ticks: { color: "#6e7681", callback: v => v.toFixed(0) + "%" }, grid: { color: "#21262d" }},
      },
    },
  });
}

// ── Crypto History Chart ──────────────────────────────────────
const CRYPTO_COLORS = { BTC: "#f7931a", ETH: "#627eea" };

function renderCryptoHistChart() {
  const canvas = document.getElementById("crypto-price-chart");
  const empty  = document.getElementById("crypto-chart-empty");
  if (!canvas) return;
  const S = STRINGS[lang];
  const tickers = [...new Set(holdings.filter(h => h.asset_type === "BTC" || h.asset_type === "ETH").map(h => h.asset_type))];
  if (!tickers.length || !Object.keys(usHistoryData).length) {
    canvas.classList.add("hidden"); empty.classList.remove("hidden"); empty.textContent = S.empty_crypto_chart; return;
  }
  const allDates = [...new Set(tickers.flatMap(t => Object.keys(usHistoryData[t] || {})))].sort();
  if (!allDates.length) { canvas.classList.add("hidden"); empty.classList.remove("hidden"); return; }
  canvas.classList.remove("hidden"); empty.classList.add("hidden");

  const datasets = tickers.map(t => {
    const prices = usHistoryData[t] || {};
    const vals   = allDates.map(d => prices[d] ?? null);
    const first  = vals.find(v => v != null) || 1;
    return { label: t, data: vals.map(v => v != null ? parseFloat((v / first * 100).toFixed(2)) : null),
      borderColor: CRYPTO_COLORS[t] || "#888", backgroundColor: "transparent", borderWidth: 2,
      pointRadius: 0, pointHoverRadius: 4, fill: false, tension: 0.3, spanGaps: false };
  });

  if (cryptoHistChart) { cryptoHistChart.data.labels = allDates; cryptoHistChart.data.datasets = datasets; cryptoHistChart.update("none"); return; }
  cryptoHistChart = new Chart(canvas.getContext("2d"), {
    type: "line", data: { labels: allDates, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: true, labels: { color: "#8b949e", font: { size: 12 }, boxWidth: 14, padding: 12 }},
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) + "%" : "—"}` }}},
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
  if (!Object.keys(usHistoryData).length) fetchUSHistory(); else renderUSStocksChart();

  const usH   = holdings.filter(h => STOCK_TYPES.has(h.asset_type));
  let total   = 0;
  const tbody = document.getElementById("us-tbody");
  if (!usH.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">${S.empty_us}</td></tr>`;
  } else {
    tbody.innerHTML = usH.map(h => {
      const usd = stockData.prices?.[h.asset_type] || 0;
      const krw = h.amount * usd * usd_krw; total += krw;
      const amtAttrs = editMode ? `class="amount-cell" data-id="${h.id}" data-amount="${h.amount}"` : "";
      return `<tr>${editRow(`<td>${escHtml(h.label)}</td><td ${amtAttrs}>${fmtNum(h.amount)}</td><td class="krw-muted">${usd ? fmtUSD.format(h.amount * usd) : "—"}</td><td>${fmtKRW.format(krw)}</td>`, h.id)}`;
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
      const krw = h.amount * p; total += krw;
      const amtAttrs = editMode ? `class="amount-cell" data-id="${h.id}" data-amount="${h.amount}"` : "";
      return `<tr>${editRow(`<td>${escHtml(h.label)}</td><td ${amtAttrs}>${fmtNum(h.amount)}</td><td>${fmtKRW.format(krw)}</td>`, h.id)}`;
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
  if (!Object.keys(usHistoryData).length) fetchUSHistory(); else renderCryptoHistChart();

  const cH    = holdings.filter(h => h.asset_type === "BTC" || h.asset_type === "ETH");
  let total   = 0;
  const tbody = document.getElementById("crypto-tbody");
  if (!cH.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">${S.empty_crypto}</td></tr>`;
  } else {
    tbody.innerHTML = cH.map(h => {
      const krw = calcKRW(h); total += krw;
      const cls = h.asset_type === "BTC" ? "badge-btc" : "badge-eth";
      const amtAttrs = editMode ? `class="amount-cell" data-id="${h.id}" data-amount="${h.amount}"` : "";
      return `<tr>${editRow(`<td>${escHtml(h.label)}</td><td><span class="badge ${cls}">${h.asset_type}</span></td><td ${amtAttrs}>${fmtNum(h.amount)}</td><td>${fmtKRW.format(krw)}</td>`, h.id)}`;
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
      return `<tr>${editRow(`<td>${escHtml(h.label)}</td><td ${amtAttrs}>${fmtKRW.format(h.amount)}</td>`, h.id)}`;
    }).join("");
    wireEditRows(tbody);
  }
  document.getElementById("krw-subtotal").textContent = fmtKRW.format(total);
}

// ── Retirement Calculation ────────────────────────────────────
function calcRetirement() {
  const { kyowon, sakhak } = retirementParams;
  const now          = new Date();
  const curYear      = now.getFullYear();
  const curMonth     = now.getMonth() + 1;

  // Personal timing
  const birthDate    = new Date(sakhak.birthYear, sakhak.birthMonth - 1, sakhak.birthDay || 1);
  const ageMs        = now - birthDate;
  const ageDecimal   = ageMs / (365.25 * 24 * 3600 * 1000);
  const currentAge   = Math.floor(ageDecimal);
  const retYear      = sakhak.retirementYear  || (sakhak.birthYear + sakhak.retirementAge);
  const retMonth     = sakhak.retirementMonth || sakhak.birthMonth;
  const retFrac      = retYear + (retMonth - 1) / 12;
  const curFrac      = curYear + (curMonth - 1) / 12;
  const yearsToRet   = retFrac - curFrac;
  const ytrY         = Math.floor(Math.max(0, yearsToRet));
  const ytrM         = Math.round(Math.max(0, yearsToRet - ytrY) * 12);

  // ── 교원공제회 ──
  const kwTotalMonths = kyowon.durationYears * 12 + kyowon.durationMonths;
  let endM = kyowon.startMonth - 1 + kwTotalMonths;
  const kwEndYear  = kyowon.startYear + Math.floor(endM / 12);
  const kwEndMonth = (endM % 12) + 1;
  const kwTotalPaid = kyowon.monthly * kwTotalMonths;

  const rm = kyowon.rate / 100 / 12;
  const kwLumpSum = rm < 1e-9
    ? kwTotalPaid
    : kyowon.monthly * ((Math.pow(1 + rm, kwTotalMonths) - 1) / rm) * (1 + rm);

  const monthsPaid = Math.max(0, Math.min(kwTotalMonths,
    (curYear - kyowon.startYear) * 12 + (curMonth - kyowon.startMonth)));
  const kwProgress = monthsPaid / kwTotalMonths;

  // ── 사학연금 ──
  const skStart    = sakhak.startYear + (sakhak.startMonth - 1) / 12;
  const serviceYrs = retFrac - skStart;
  const workedYrs  = Math.max(0, curFrac - skStart);
  const g          = sakhak.growthRate / 100;

  const startSalary = workedYrs > 0
    ? sakhak.currentSalary / Math.pow(1 + g, workedYrs)
    : sakhak.currentSalary;

  const avgAnnualSalary = g < 1e-9
    ? startSalary
    : startSalary * (Math.pow(1 + g, serviceYrs) - 1) / (g * serviceYrs);

  const finalSalary     = startSalary * Math.pow(1 + g, serviceYrs);
  const monthlyPension  = (avgAnnualSalary / 12) * serviceYrs * (sakhak.accrualRate / 100);
  const annualPension   = monthlyPension * 12;
  const lifetimePension = annualPension * 20;
  const skProgress      = Math.min(1, workedYrs / serviceYrs);

  return {
    kw: { totalMonths: kwTotalMonths, totalPaid: kwTotalPaid, lumpSum: kwLumpSum,
          endYear: kwEndYear, endMonth: kwEndMonth, monthsPaid, progress: kwProgress },
    sk: { serviceYrs, workedYrs, startSalary, finalSalary, avgAnnualSalary,
          monthlyPension, annualPension, lifetimePension, progress: skProgress },
    personal: { currentAge, yearsToRet, ytrY, ytrM, retYear, retMonth },
    totalValue: kwLumpSum + lifetimePension,
  };
}

// ── Retirement Tab ────────────────────────────────────────────
function renderRetirementTab() {
  const S = STRINGS[lang];
  setLockBtn("ret-kyowon-lock-btn");
  setLockBtn("ret-sakhak-lock-btn");
  document.getElementById("ret-kyowon-form")?.classList.toggle("hidden", !editMode);
  document.getElementById("ret-sakhak-form")?.classList.toggle("hidden", !editMode);

  const c = calcRetirement();
  const { kw, sk, personal } = c;
  const p = retirementParams;

  // Use official 교원공제회 net if set
  const kwDisplay = (p.kyowon.officialNet > 0) ? p.kyowon.officialNet : kw.lumpSum;

  // Summary cards
  setText("ret-kw-val",   fmtKRW.format(kwDisplay));
  setText("ret-sk-val",   fmtKRW.format(sk.monthlyPension));
  setText("ret-time-val", personal.ytrY > 0
    ? `${personal.ytrY}${S.lbl_yr} ${personal.ytrM}${S.lbl_mo}`
    : lang === "ko" ? "퇴직!" : "Retired!");
  setText("ret-total-val", fmtKRW.format(c.totalValue));

  // 교원공제회 params display
  setText("kw-monthly",    fmtKRW.format(p.kyowon.monthly));
  setText("kw-start",      `${p.kyowon.startYear}.${String(p.kyowon.startMonth).padStart(2,"0")}`);
  setText("kw-duration",   `${p.kyowon.durationYears}${S.lbl_yr} ${p.kyowon.durationMonths}${S.lbl_mo}`);
  setText("kw-rate",       `${p.kyowon.rate}%`);
  setText("kw-total-paid", fmtKRW.format(kw.totalPaid));
  setText("kw-end-date",   `${kw.endYear}.${String(kw.endMonth).padStart(2,"0")}`);

  // Progress bar
  const kwPct = Math.round(kw.progress * 100);
  setWidth("kw-bar", kwPct);
  setText("kw-prog-pct",   `${kwPct}%`);
  setText("kw-prog-label", kwPct >= 100
    ? (lang === "ko" ? "납입 완료 ✓" : "Complete ✓")
    : (lang === "ko" ? `납입 중 (${kw.monthsPaid}/${kw.totalMonths}개월)` : `Paying (${kw.monthsPaid}/${kw.totalMonths}mo)`));

  // 교원공제회 official breakdown
  const hasOfficial = p.kyowon.officialNet > 0;
  const bkSection = document.getElementById("kw-breakdown");
  if (bkSection) bkSection.classList.toggle("hidden", !hasOfficial);
  if (hasOfficial) {
    setText("kw-principal",  fmtKRW.format(p.kyowon.officialPrincipal));
    setText("kw-interest",   fmtKRW.format(p.kyowon.officialInterest));
    setText("kw-income-tax", `▼ ${fmtKRW.format(p.kyowon.officialIncomeTax)}`);
    setText("kw-local-tax",  `▼ ${fmtKRW.format(p.kyowon.officialLocalTax)}`);
    setText("kw-net",        fmtKRW.format(p.kyowon.officialNet));
    setText("kw-as-of",      `조회: ${p.kyowon.officialAsOf}`);
    setText("kw-projected",  `퇴직 기준: ${p.kyowon.officialProjected}`);
  }
  setText("kw-lumpsum", fmtKRW.format(kwDisplay));

  // Populate edit form when visible
  if (editMode) {
    setVal("kw-inp-monthly",   p.kyowon.monthly);
    setVal("kw-inp-sy",        p.kyowon.startYear);
    setVal("kw-inp-sm",        p.kyowon.startMonth);
    setVal("kw-inp-dy",        p.kyowon.durationYears);
    setVal("kw-inp-dm",        p.kyowon.durationMonths);
    setVal("kw-inp-rate",      p.kyowon.rate);
    setVal("kw-inp-offnet",    p.kyowon.officialNet);
    setVal("kw-inp-offprin",   p.kyowon.officialPrincipal);
    setVal("kw-inp-offint",    p.kyowon.officialInterest);
    setVal("kw-inp-offitax",   p.kyowon.officialIncomeTax);
    setVal("kw-inp-offltax",   p.kyowon.officialLocalTax);
    setVal("kw-inp-offasof",   p.kyowon.officialAsOf);
    setVal("kw-inp-offproj",   p.kyowon.officialProjected);
    setVal("sk-inp-salary",    p.sakhak.currentSalary);
    setVal("sk-inp-growth",    p.sakhak.growthRate);
    setVal("sk-inp-sy",        p.sakhak.startYear);
    setVal("sk-inp-sm",        p.sakhak.startMonth);
    setVal("sk-inp-accrual",   p.sakhak.accrualRate);
    setVal("sk-inp-by",        p.sakhak.birthYear);
    setVal("sk-inp-bm",        p.sakhak.birthMonth);
    setVal("sk-inp-ret-age",   p.sakhak.retirementAge);
    setVal("sk-inp-ret-year",  p.sakhak.retirementYear);
    setVal("sk-inp-ret-month", p.sakhak.retirementMonth);
  }

  // 사학연금 params display
  setText("sk-salary",  fmtKRW.format(p.sakhak.currentSalary));
  setText("sk-growth",  `${p.sakhak.growthRate}%/${S.lbl_yr}`);
  setText("sk-service", `${p.sakhak.startYear}.${String(p.sakhak.startMonth).padStart(2,"0")} ~ ${personal.retYear}.${String(personal.retMonth).padStart(2,"0")}`);
  setText("sk-accrual", `${p.sakhak.accrualRate}%`);
  setText("sk-birth",   `${p.sakhak.birthYear}.${String(p.sakhak.birthMonth).padStart(2,"0")}.${String(p.sakhak.birthDay || 1).padStart(2,"0")}`);
  setText("sk-ret-age", `${p.sakhak.retirementAge}세`);

  const skPct = Math.round(sk.progress * 100);
  setWidth("sk-bar", skPct);
  setText("sk-prog-pct", `${skPct}%`);
  setText("sk-prog-label",
    lang === "ko"
      ? `재직 현황 (${sk.workedYrs.toFixed(1)}년 / ${sk.serviceYrs.toFixed(1)}년)`
      : `Service (${sk.workedYrs.toFixed(1)}yr / ${sk.serviceYrs.toFixed(1)}yr)`);

  setText("sk-final-salary",  fmtKRW.format(sk.finalSalary));
  setText("sk-avg-salary",    fmtKRW.format(sk.avgAnnualSalary));
  setText("sk-monthly-pension", fmtKRW.format(sk.monthlyPension));
  setText("sk-annual-pension",  fmtKRW.format(sk.annualPension));
  setText("sk-lifetime",        fmtKRW.format(sk.lifetimePension));
  setText("sk-ret-date", `${personal.retYear}.${String(personal.retMonth).padStart(2,"0")} (${lang === "ko" ? "나이" : "age"} ${p.sakhak.retirementAge})`);
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setWidth(id, pct) { const el = document.getElementById(id); if (el) el.style.width = `${Math.min(100, pct)}%`; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val ?? ""; }

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
  await fetch(`/api/holdings/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount }) });
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
      if (!editMode) ["us","korean","crypto","krw","ret-kyowon","ret-sakhak"].forEach(p =>
        document.getElementById(`${p}-form`)?.classList.add("hidden"));
      renderActiveTab();
    }
  });
});

// ── Retirement edit forms ─────────────────────────────────────
document.getElementById("kw-cancel-btn")?.addEventListener("click", () => {
  document.getElementById("ret-kyowon-form")?.classList.add("hidden");
  editMode = false; renderActiveTab();
});
document.getElementById("kw-save-btn")?.addEventListener("click", () => {
  const num = id => parseFloat(document.getElementById(id)?.value) || 0;
  const int = id => parseInt(document.getElementById(id)?.value)   || 0;
  const str = id => document.getElementById(id)?.value?.trim()     || "";
  retirementParams.kyowon.monthly             = num("kw-inp-monthly");
  retirementParams.kyowon.startYear           = int("kw-inp-sy");
  retirementParams.kyowon.startMonth          = int("kw-inp-sm");
  retirementParams.kyowon.durationYears       = int("kw-inp-dy");
  retirementParams.kyowon.durationMonths      = int("kw-inp-dm");
  retirementParams.kyowon.rate                = num("kw-inp-rate");
  retirementParams.kyowon.officialNet         = num("kw-inp-offnet");
  retirementParams.kyowon.officialPrincipal   = num("kw-inp-offprin");
  retirementParams.kyowon.officialInterest    = num("kw-inp-offint");
  retirementParams.kyowon.officialIncomeTax   = num("kw-inp-offitax");
  retirementParams.kyowon.officialLocalTax    = num("kw-inp-offltax");
  retirementParams.kyowon.officialAsOf        = str("kw-inp-offasof");
  retirementParams.kyowon.officialProjected   = str("kw-inp-offproj");
  saveRetirementParams();
  editMode = false; renderActiveTab();
});

document.getElementById("sk-cancel-btn")?.addEventListener("click", () => {
  document.getElementById("ret-sakhak-form")?.classList.add("hidden");
  editMode = false; renderActiveTab();
});
document.getElementById("sk-save-btn")?.addEventListener("click", () => {
  const num = id => parseFloat(document.getElementById(id)?.value) || 0;
  const int = id => parseInt(document.getElementById(id)?.value)   || 0;
  retirementParams.sakhak.currentSalary  = num("sk-inp-salary");
  retirementParams.sakhak.growthRate     = num("sk-inp-growth");
  retirementParams.sakhak.startYear      = int("sk-inp-sy");
  retirementParams.sakhak.startMonth     = int("sk-inp-sm");
  retirementParams.sakhak.accrualRate    = num("sk-inp-accrual");
  retirementParams.sakhak.birthYear      = int("sk-inp-by");
  retirementParams.sakhak.birthMonth     = int("sk-inp-bm");
  retirementParams.sakhak.retirementAge   = int("sk-inp-ret-age");
  retirementParams.sakhak.retirementYear  = int("sk-inp-ret-year");
  retirementParams.sakhak.retirementMonth = int("sk-inp-ret-month");
  saveRetirementParams();
  editMode = false; renderActiveTab();
});

// ── Per-tab add forms ─────────────────────────────────────────
function wireAddForm(prefix, fixedType) {
  const form     = document.getElementById(`${prefix}-add-form`);
  const labelEl  = document.getElementById(`${prefix}-new-label`);
  const typeEl   = document.getElementById(`${prefix}-new-type`);
  const amountEl = document.getElementById(`${prefix}-new-amount`);
  document.getElementById(`${prefix}-add-btn`)?.addEventListener("click", () => { form?.classList.remove("hidden"); labelEl?.focus(); });
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
    await fetch("/api/holdings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label, asset_type, amount }) });
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
  loadRetirementParams();
  await fetchCryptoPrices();
  await Promise.all([fetchHoldings(), fetchHistory(), fetchStockPrices()]);
  await checkAndBackfill();
  setInterval(fetchStockPrices, 300_000);
})();
