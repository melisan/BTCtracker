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
const CRYPTO_KRW  = new Set(["BTC", "ETH", "KRW"]);
const KOSPI_BADGE = { "005930.KS": "삼성전자", "000660.KS": "SK하이닉스" };

function isKorean(t)  { return /\.(KS|KQ)$/i.test(t); }
function isUSStock(t) { return !CRYPTO_KRW.has(t) && !isKorean(t); }

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
    tab_history: "📅 History",  tab_retirement: "🌾 Retirement",
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
    empty_korean_chart: "Add Korean stock holdings to see price chart.",
    chart_korean_perf: "30-Day Korean Stock Performance 🌸",
    chart_history: "Weekly Portfolio Value 📅",
    h2_history: "Weekly Snapshots",
    lbl_seed: "Base Investment",
    empty_history: "No history yet — data builds as you update assets.",
    th_date: "Date",  th_total_val: "Total (₩)",  th_vs_seed: "vs Seed",
    ph_us_label: "Label (e.g. Fidelity TSLA)",   ph_us_amount: "Shares",
    ph_us_type: "Ticker (e.g. TSLA)",
    ph_korean_label: "Label (e.g. 삼성전자)",       ph_korean_amount: "Shares",
    ph_korean_type: "KRX: 005930.KS · KOSDAQ: 035420.KQ",
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
    h2_notes: "Notes",  ph_note: "Write a note…",  btn_note_add: "Add Note",
    notes_empty: "No notes yet.",
    btn_fix_anomalies: "🔧 Fix Price Anomalies",
  },
  ko: {
    tab_total: "🌳 개요",         tab_us: "📈 미국 주식",
    tab_korean: "🌸 한국 주식",   tab_crypto: "₿ 암호화폐",  tab_krw: "🐷 원화",
    tab_history: "📅 이력",       tab_retirement: "🌾 은퇴",
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
    empty_korean_chart: "한국 주식을 추가하면 가격 차트가 표시됩니다.",
    chart_korean_perf: "30일 한국 주식 추이 🌸",
    chart_history: "주간 포트폴리오 가치 📅",
    h2_history: "주간 스냅샷",
    lbl_seed: "기준 투자금",
    empty_history: "이력 없음 — 자산을 업데이트하면 데이터가 쌓입니다.",
    th_date: "날짜",  th_total_val: "총액 (₩)",  th_vs_seed: "투자금 대비",
    ph_us_label: "라벨 (예: 피델리티 TSLA)",      ph_us_amount: "주수",
    ph_us_type: "종목 코드 (예: TSLA)",
    ph_korean_label: "라벨 (예: 삼성전자)",        ph_korean_amount: "주수",
    ph_korean_type: "KRX: 005930.KS · KOSDAQ: 035420.KQ",
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
    h2_notes: "노트",  ph_note: "노트를 입력하세요…",  btn_note_add: "노트 추가",
    notes_empty: "노트가 없습니다.",
    btn_fix_anomalies: "🔧 가격 오류 수정",
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
let cryptoHistChart   = null;
let koreanStocksChart = null;
let historyChart      = null;
let activeTab       = "total";
let activeRange     = "daily";
let normalizeMode   = false;
let historyData     = [];
let usHistoryData   = {};
let weeklyHistData  = [];
let isAuthenticated = false;
let editMode        = false;
let togglesWired    = false;
let retirementParams = null;
let seedFund   = parseInt(localStorage.getItem("seedFund") || "") || 1530000000;
let notesCache = {}; // tabId → [{id, content, created_at}]

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
    else if (isUSStock(t))  bd.us     += amt * (stockData.prices?.[t] || 0) * usd_krw;
    else if (isKorean(t))  bd.korean += amt * (stockData.kospi_prices?.[t] || 0);
  });
  bd.total = bd.btc + bd.eth + bd.us + bd.korean + bd.krw;
  return bd;
}

function calcKRW(h) {
  const t = h.asset_type;
  if (t === "BTC") return h.amount * cryptoPrices.btc;
  if (t === "ETH") return h.amount * cryptoPrices.eth;
  if (t === "KRW") return h.amount;
  if (isUSStock(t)) return h.amount * (stockData.prices?.[t] || 0) * (cryptoPrices.usd_krw || 1350);
  if (isKorean(t)) return h.amount * (stockData.kospi_prices?.[t] || 0);
  return 0;
}

// ── Tab switching ─────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".tab-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === tab));
  if (tab === "history" && diagRows.length === 0) {
    loadAllDiagnostics();
  }
  document.querySelectorAll(".tab-panel").forEach(p =>
    p.classList.toggle("hidden", p.id !== `tab-${tab}`));
  renderActiveTab();
}
document.querySelectorAll(".tab-btn").forEach(btn =>
  btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

document.querySelectorAll(".scard-nav").forEach(card =>
  card.addEventListener("click", () => switchTab(card.dataset.nav)));

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
  if (activeTab === "history")    renderHistoryTab();
  if (activeTab === "retirement") renderRetirementTab();
}

// ── Summary Cards ─────────────────────────────────────────────
function updateSummaryCards(bd) {
  document.getElementById("sum-total").textContent  = fmtKRW.format(bd.total);
  document.getElementById("sum-crypto").textContent = fmtKRW.format(bd.btc + bd.eth);
  document.getElementById("sum-us").textContent     = fmtKRW.format(bd.us);
  document.getElementById("sum-korean").textContent = fmtKRW.format(bd.korean);
  document.getElementById("sum-krw").textContent    = fmtKRW.format(bd.krw);

  // Gain vs seed fund
  const gain    = bd.total - seedFund;
  const gainPct = seedFund > 0 ? gain / seedFund * 100 : 0;
  const pos     = gain >= 0;
  const gainEl  = document.getElementById("sum-gain");
  const pctEl   = document.getElementById("sum-gain-pct");
  if (gainEl) {
    gainEl.textContent = (pos ? "+" : "") + fmtKRW.format(gain);
    gainEl.className   = "scard-gain-val " + (pos ? "gain-pos" : "gain-neg");
  }
  if (pctEl) {
    pctEl.textContent = "(" + (pos ? "+" : "") + gainPct.toFixed(1) + "%)";
    pctEl.className   = "scard-gain-pct " + (pos ? "gain-pos" : "gain-neg");
  }
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
    // Null-out extreme outliers (>100× or <1/100× of series median) before plotting
    const nonZero = values.filter(v => v > 0).sort((a, b) => a - b);
    if (nonZero.length >= 3) {
      const med = nonZero[Math.floor(nonZero.length / 2)];
      values = values.map(v => v > 0 && (v / med > 100 || v / med < 0.01) ? null : v);
    }
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

// ── History Tab ───────────────────────────────────────────────
const fmtShort = v => {
  if (v == null) return "—";
  const abs = Math.abs(v), neg = v < 0;
  let s = abs >= 1e8 ? (abs/1e8).toFixed(1) + "억"
        : abs >= 1e4 ? (abs/1e4).toFixed(0) + "만"
        : abs.toLocaleString();
  return (neg ? "-" : "") + s;
};

function isoWeekKey(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const wk   = 1 + Math.round(((d - jan4) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(wk).padStart(2, "0")}`;
}

async function fetchWeeklyHistory() {
  try {
    const res = await fetch("/api/portfolio/history/weekly");
    const raw = await res.json();

    // Drop any entry from the current ISO week — we'll replace it with live data
    const thisWeek = isoWeekKey(new Date().toISOString().slice(0, 10));
    const past = raw.filter(r => isoWeekKey(r.date) !== thisWeek);

    // Append today's live breakdown as the final "current" entry
    const bd    = computeBreakdown();
    const today = new Date().toISOString().slice(0, 10);
    const live  = {
      date:             today,
      total_krw:        bd.total,
      btc_total_krw:    bd.btc,
      eth_total_krw:    bd.eth,
      us_total_krw:     bd.us,
      korean_total_krw: bd.korean,
      krw_total_krw:    bd.krw,
    };

    weeklyHistData = [...past, live];
    if (activeTab === "history") renderHistoryTab();
  } catch (err) { console.error("Weekly history fetch failed:", err); }
}

function renderHistoryChart(data) {
  const canvas = document.getElementById("history-chart");
  const empty  = document.getElementById("history-chart-empty");
  if (!canvas) return;
  if (!data.length) { canvas.classList.add("hidden"); empty.classList.remove("hidden"); return; }
  canvas.classList.remove("hidden"); empty.classList.add("hidden");

  const labels   = data.map(r => r.date);
  const totals   = data.map(r => r.total_krw || 0);
  const seedLine = data.map(() => seedFund);

  const datasets = [
    { label: lang === "ko" ? "포트폴리오" : "Portfolio",
      data: totals, borderColor: "#e8b84b", backgroundColor: "transparent",
      borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 5,
      fill: { target: 1, above: "rgba(76,175,125,0.13)", below: "rgba(224,123,106,0.13)" },
      tension: 0.3 },
    { label: lang === "ko" ? "기준 투자금" : "Seed Fund",
      data: seedLine, borderColor: "rgba(232,184,75,0.45)",
      backgroundColor: "transparent", borderWidth: 1.5,
      borderDash: [7, 4], pointRadius: 0, fill: false, tension: 0 },
  ];

  const yFmt = v => v >= 1e8 ? (v/1e8).toFixed(0) + "억" : v >= 1e4 ? (v/1e4).toFixed(0) + "만" : v.toLocaleString();

  if (historyChart) {
    historyChart.data.labels = labels;
    historyChart.data.datasets[0].data = totals;
    historyChart.data.datasets[0].label = datasets[0].label;
    historyChart.data.datasets[1].data  = seedLine;
    historyChart.data.datasets[1].label = datasets[1].label;
    historyChart.update("none");
    return;
  }
  historyChart = new Chart(canvas.getContext("2d"), {
    type: "line", data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: true, labels: { color: "#8b949e", font: { size: 11 }, boxWidth: 12, padding: 10 }},
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtKRW.format(ctx.parsed.y)}` }},
      },
      scales: {
        x: { ticks: { color: "#6e7681", maxRotation: 0, maxTicksLimit: 12 }, grid: { color: "#21262d" }},
        y: { ticks: { color: "#6e7681", callback: yFmt }, grid: { color: "#21262d" }},
      },
    },
  });
}

function renderHistoryTable(data, S) {
  const tbody = document.getElementById("history-tbody");
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">${S.empty_history}</td></tr>`;
    return;
  }
  tbody.innerHTML = [...data].reverse().map(r => {
    const total = r.total_krw || 0;
    const gain  = total - seedFund;
    const pct   = seedFund > 0 ? gain / seedFund * 100 : 0;
    const cls   = gain >= 0 ? "hist-pos" : "hist-neg";
    const sign  = gain >= 0 ? "+" : "";
    return `<tr>
      <td class="hist-date">${r.date}</td>
      <td class="hist-total">${fmtKRW.format(total)}</td>
      <td class="${cls}">${sign}${fmtShort(gain)}</td>
      <td class="${cls}">${sign}${pct.toFixed(1)}%</td>
      <td class="hist-sub">${fmtShort(r.btc_total_krw)}</td>
      <td class="hist-sub">${fmtShort(r.eth_total_krw)}</td>
      <td class="hist-sub">${fmtShort(r.us_total_krw)}</td>
      <td class="hist-sub">${fmtShort(r.korean_total_krw)}</td>
      <td class="hist-sub">${fmtShort(r.krw_total_krw)}</td>
    </tr>`;
  }).join("");
}

function renderHistoryTab() {
  const S = STRINGS[lang];
  const seedEl = document.getElementById("seed-display");
  if (seedEl) seedEl.textContent = fmtKRW.format(seedFund);
  if (!weeklyHistData.length) { fetchWeeklyHistory(); return; }
  renderHistoryChart(weeklyHistData);
  renderHistoryTable(weeklyHistData, S);
  // Pre-open notes for history tab and fetch if needed
  if (!notesCache["history"]) fetchTabNotes("history");
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
    renderKoreanStocksChart();
  } catch (err) { console.error("US history fetch failed:", err); }
}

function renderUSStocksChart() {
  const canvas = document.getElementById("us-stocks-chart");
  const empty  = document.getElementById("us-chart-empty");
  if (!canvas) return;
  const S = STRINGS[lang];
  const tickers = [...new Set(holdings.filter(h => isUSStock(h.asset_type)).map(h => h.asset_type))];
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

// ── Korean Stocks History Chart ───────────────────────────────
const KOSPI_COLORS = { "005930.KS": "#ff6b6b", "000660.KS": "#79c0ff" };

function renderKoreanStocksChart() {
  const canvas = document.getElementById("korean-stocks-chart");
  const empty  = document.getElementById("korean-chart-empty");
  if (!canvas) return;
  const S = STRINGS[lang];
  const tickers = [...new Set(holdings.filter(h => isKorean(h.asset_type)).map(h => h.asset_type))];
  if (!tickers.length || !Object.keys(usHistoryData).length) {
    canvas.classList.add("hidden"); empty.classList.remove("hidden"); empty.textContent = S.empty_korean_chart; return;
  }
  const allDates = [...new Set(tickers.flatMap(t => Object.keys(usHistoryData[t] || {})))].sort();
  if (!allDates.length) { canvas.classList.add("hidden"); empty.classList.remove("hidden"); return; }
  canvas.classList.remove("hidden"); empty.classList.add("hidden");

  const datasets = tickers.map(t => {
    const prices = usHistoryData[t] || {};
    const vals   = allDates.map(d => prices[d] ?? null);
    const first  = vals.find(v => v != null) || 1;
    return { label: KOSPI_BADGE[t] || t,
      data: vals.map(v => v != null ? parseFloat((v / first * 100).toFixed(2)) : null),
      borderColor: KOSPI_COLORS[t] || "#888", backgroundColor: "transparent", borderWidth: 1.5,
      pointRadius: 0, pointHoverRadius: 4, fill: false, tension: 0.3, spanGaps: false };
  });

  if (koreanStocksChart) {
    koreanStocksChart.data.labels = allDates;
    koreanStocksChart.data.datasets = datasets;
    koreanStocksChart.update("none");
    return;
  }
  koreanStocksChart = new Chart(canvas.getContext("2d"), {
    type: "line", data: { labels: allDates, datasets },
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

  const usH   = holdings.filter(h => isUSStock(h.asset_type));
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
  if (!Object.keys(usHistoryData).length) fetchUSHistory(); else renderKoreanStocksChart();

  const kH    = holdings.filter(h => isKorean(h.asset_type));
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
    const asset_type = typeEl ? typeEl.value.trim().toUpperCase() : fixedType;
    const amount     = parseFloat(amountEl?.value);
    if (!label || !asset_type || isNaN(amount) || amount < 0) { alert("Enter a label, ticker, and valid amount."); return; }
    const res = await fetch("/api/holdings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label, asset_type, amount }) });
    if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error || "Failed to add holding."); return; }
    form?.classList.add("hidden");
    if (labelEl)  labelEl.value  = "";
    if (amountEl) amountEl.value = "";
    if (typeEl)   typeEl.value   = "";
    // Reset history cache so new ticker gets fetched
    usHistoryData = {};
    await Promise.all([fetchHoldings(), fetchHistory(), fetchUSHistory()]);
  });
}
wireAddForm("us");
wireAddForm("korean");
wireAddForm("crypto");
wireAddForm("krw", "KRW");

// ── Seed fund editing ─────────────────────────────────────────
document.getElementById("seed-edit-btn")?.addEventListener("click", () => {
  const form = document.getElementById("seed-edit-form");
  const inp  = document.getElementById("seed-inp");
  if (inp) inp.value = seedFund;
  form?.classList.toggle("hidden");
});
document.getElementById("seed-save-btn")?.addEventListener("click", () => {
  const v = parseFloat(document.getElementById("seed-inp")?.value);
  if (!isNaN(v) && v >= 0) {
    seedFund = v;
    localStorage.setItem("seedFund", String(v));
    document.getElementById("seed-edit-form")?.classList.add("hidden");
    renderActiveTab();
  }
});
document.getElementById("seed-cancel-btn")?.addEventListener("click", () => {
  document.getElementById("seed-edit-form")?.classList.add("hidden");
});
document.getElementById("fix-anomaly-btn")?.addEventListener("click", runAnomalyFix);

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

// ── Notes (per-tab cumulative journal) ───────────────────────
const NOTE_TABS = ["total","us","korean","crypto","krw","history","retirement"];

function setupNotesSections() {
  NOTE_TABS.forEach(tabId => {
    const panel = document.getElementById(`tab-${tabId}`);
    if (!panel) return;
    const sec = document.createElement("div");
    sec.id        = `notes-sec-${tabId}`;
    sec.className = "notes-section";
    sec.innerHTML = `
      <div class="notes-header-row" data-notes-toggle="${tabId}">
        <span class="notes-icon">📝</span>
        <span class="notes-title" data-i18n="h2_notes">Notes</span>
        <span class="notes-count" id="notes-count-${tabId}"></span>
        <span class="notes-chevron" id="notes-chev-${tabId}">▸</span>
      </div>
      <div class="notes-body hidden" id="notes-body-${tabId}">
        <div class="notes-list" id="notes-list-${tabId}"></div>
        <div class="notes-add-row">
          <textarea id="notes-inp-${tabId}" class="notes-input" rows="2"
            placeholder="Write a note…" data-i18n-placeholder="ph_note"></textarea>
          <button class="btn-primary notes-save" data-tab="${tabId}"
            data-i18n="btn_note_add">Add Note</button>
        </div>
      </div>`;
    panel.appendChild(sec);

    sec.querySelector(`[data-notes-toggle]`).addEventListener("click", () => {
      const body = document.getElementById(`notes-body-${tabId}`);
      const chev = document.getElementById(`notes-chev-${tabId}`);
      const open = body.classList.toggle("hidden");
      chev.textContent = open ? "▸" : "▾";
      if (!open && !notesCache[tabId]) fetchTabNotes(tabId);
    });

    sec.querySelector(".notes-save").addEventListener("click", async () => {
      const inp = document.getElementById(`notes-inp-${tabId}`);
      const content = inp?.value.trim();
      if (!content) return;
      if (!isAuthenticated) { showAuthModal(async () => { isAuthenticated = true; await saveNote(tabId, content, inp); }); return; }
      await saveNote(tabId, content, inp);
    });
  });
}

async function saveNote(tabId, content, inp) {
  const res = await fetch("/api/notes", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tab: tabId, content }),
  });
  if (res.ok) {
    inp.value = "";
    delete notesCache[tabId];
    await fetchTabNotes(tabId);
  }
}

async function fetchTabNotes(tabId) {
  try {
    const res = await fetch(`/api/notes?tab=${tabId}`);
    notesCache[tabId] = await res.json();
    renderTabNotes(tabId);
  } catch (err) { console.error("Notes fetch failed:", err); }
}

function renderTabNotes(tabId) {
  const S      = STRINGS[lang];
  const list   = document.getElementById(`notes-list-${tabId}`);
  const countEl = document.getElementById(`notes-count-${tabId}`);
  if (!list) return;
  const notes = notesCache[tabId] || [];
  if (countEl) countEl.textContent = notes.length ? `(${notes.length})` : "";
  if (!notes.length) {
    list.innerHTML = `<div class="notes-empty">${S.notes_empty}</div>`;
    return;
  }
  list.innerHTML = notes.map(n => {
    const dt  = new Date(n.created_at);
    const ts  = dt.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { year:"numeric", month:"short", day:"numeric" })
              + " " + dt.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
    return `<div class="note-item" data-note-id="${n.id}">
      <div class="note-meta">
        <span class="note-ts">${ts}</span>
        <div class="note-actions">
          <button class="note-edit btn-note-act" data-id="${n.id}" data-tab="${tabId}" title="Edit">✎</button>
          <button class="note-del  btn-note-act btn-del" data-id="${n.id}" data-tab="${tabId}" title="Delete">✕</button>
        </div>
      </div>
      <div class="note-content" id="note-content-${n.id}">${escHtml(n.content)}</div>
      <div class="note-edit-form hidden" id="note-edit-form-${n.id}">
        <textarea class="note-edit-inp" id="note-edit-inp-${n.id}" rows="3">${escHtml(n.content)}</textarea>
        <div class="note-edit-btns">
          <button class="note-save-edit btn-primary" data-id="${n.id}" data-tab="${tabId}" style="font-size:0.75rem;padding:3px 10px">Save</button>
          <button class="note-cancel-edit btn-secondary" data-id="${n.id}" style="font-size:0.75rem;padding:3px 10px">Cancel</button>
        </div>
      </div>
    </div>`;
  }).join("");

  list.querySelectorAll(".note-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      const nid = +btn.dataset.id;
      const doEdit = () => {
        document.getElementById(`note-content-${nid}`)?.classList.add("hidden");
        document.getElementById(`note-edit-form-${nid}`)?.classList.remove("hidden");
        document.getElementById(`note-edit-inp-${nid}`)?.focus();
      };
      if (!isAuthenticated) { showAuthModal(() => { isAuthenticated = true; doEdit(); }); return; }
      doEdit();
    });
  });

  list.querySelectorAll(".note-cancel-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      const nid = +btn.dataset.id;
      document.getElementById(`note-content-${nid}`)?.classList.remove("hidden");
      document.getElementById(`note-edit-form-${nid}`)?.classList.add("hidden");
    });
  });

  list.querySelectorAll(".note-save-edit").forEach(btn => {
    btn.addEventListener("click", async () => {
      const nid = +btn.dataset.id, tab = btn.dataset.tab;
      const inp = document.getElementById(`note-edit-inp-${nid}`);
      const content = inp?.value.trim();
      if (!content) return;
      btn.disabled = true; btn.textContent = "…";
      await fetch(`/api/notes/${nid}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      delete notesCache[tab];
      await fetchTabNotes(tab);
    });
  });

  list.querySelectorAll(".note-del").forEach(btn => {
    btn.addEventListener("click", async () => {
      const nid = +btn.dataset.id, tab = btn.dataset.tab;
      if (!isAuthenticated) { showAuthModal(async () => { isAuthenticated = true; await deleteNote(nid, tab); }); return; }
      await deleteNote(nid, tab);
    });
  });
}

async function deleteNote(nid, tabId) {
  await fetch(`/api/notes/${nid}`, { method: "DELETE" });
  delete notesCache[tabId];
  await fetchTabNotes(tabId);
}

// ── Data Diagnostics (manual snapshot inspection + patch) ────
let diagRows     = [];
let diagPatchRow = null;

document.getElementById("diagnostics-toggle")?.addEventListener("click", () => {
  const body  = document.getElementById("diagnostics-body");
  const arrow = document.getElementById("diagnostics-arrow");
  if (!body) return;
  const hidden = body.style.display === "none";
  body.style.display = hidden ? "" : "none";
  if (arrow) arrow.textContent = hidden ? "▼" : "▶";
});

document.getElementById("diag-load-btn")?.addEventListener("click", () => {
  const date = document.getElementById("diag-date")?.value || "2026-06-19";
  const days = parseInt(document.getElementById("diag-days")?.value || "14");
  loadDiagnostics(date, days);
});

document.getElementById("diag-all-btn")?.addEventListener("click", loadAllDiagnostics);

document.getElementById("diag-patch-cancel")?.addEventListener("click", () => {
  document.getElementById("diag-patch-form")?.classList.add("hidden");
  diagPatchRow = null;
});

document.getElementById("diag-patch-save")?.addEventListener("click", saveDiagPatch);

async function loadAllDiagnostics() {
  const status = document.getElementById("diag-status");
  if (status) status.textContent = "Loading all snapshots…";
  try {
    const res = await fetch("/api/admin/snapshots?days=365");
    diagRows  = await res.json();
    if (status) {
      const anom = diagRows.filter((r, i) =>
        ["btc_price_krw","btc_total_krw","total_krw"].some(f => detectDiagAnomaly(diagRows, i, f))
      ).length;
      status.textContent = `${diagRows.length} total rows · ${anom} anomalous (red)`;
    }
    renderDiagTable();
  } catch (err) {
    if (status) status.textContent = "Error: " + err.message;
  }
}

async function loadDiagnostics(date, days) {
  const status = document.getElementById("diag-status");
  if (status) status.textContent = "Loading…";
  try {
    const url = date
      ? `/api/admin/snapshots?around=${encodeURIComponent(date)}&days=${days}`
      : `/api/admin/snapshots?days=365`;
    const res = await fetch(url);
    diagRows  = await res.json();
    if (status) status.textContent = `${diagRows.length} row(s) loaded`;
    renderDiagTable();
  } catch (err) {
    if (status) status.textContent = "Error: " + err.message;
  }
}

function detectDiagAnomaly(rows, i, field) {
  const vals = rows.map(r => r[field] || 0).filter(v => v > 0);
  const v    = rows[i][field] || 0;
  if (!v || vals.length < 3) return false;
  const sorted = [...vals].sort((a, b) => a - b);
  const med    = sorted[Math.floor(sorted.length / 2)];
  return med > 0 && (v / med > 1.5 || v / med < 0.667);
}

function renderDiagTable() {
  const tbody = document.getElementById("diag-tbody");
  const table = document.getElementById("diag-table");
  if (!tbody || !table) return;
  table.style.display = diagRows.length ? "" : "none";
  tbody.innerHTML = "";

  const FIELDS = [
    ["btc_price_krw",    "BTC Price"],
    ["btc_total_krw",    "BTC Total"],
    ["eth_total_krw",    "ETH Total"],
    ["us_total_krw",     "US Total"],
    ["korean_total_krw", "KR Total"],
    ["krw_total_krw",    "KRW"],
    ["total_krw",        "Total"],
  ];

  diagRows.forEach((row, i) => {
    const anomalyCols = FIELDS.filter(([f]) => detectDiagAnomaly(diagRows, i, f)).map(([f]) => f);
    const tr = document.createElement("tr");
    if (anomalyCols.length) tr.classList.add("diag-anomaly");

    const dateTd = document.createElement("td");
    dateTd.textContent = row.date;
    dateTd.style.fontWeight = "600";
    tr.appendChild(dateTd);

    FIELDS.forEach(([field]) => {
      const td  = document.createElement("td");
      const val = row[field];
      td.textContent = val != null ? fmtShort(val) : "—";
      if (anomalyCols.includes(field)) {
        td.style.color  = "var(--coral)";
        td.style.fontWeight = "700";
        td.title = `Anomaly detected (value: ${Math.round(val).toLocaleString()})`;
      }
      tr.appendChild(td);
    });

    const actTd = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.className   = "diag-edit-btn";
    editBtn.textContent = "✎ Edit";
    editBtn.addEventListener("click", () => openDiagPatch(row));
    actTd.appendChild(editBtn);
    tr.appendChild(actTd);

    tbody.appendChild(tr);
  });
}

function openDiagPatch(row) {
  diagPatchRow = row;
  const form   = document.getElementById("diag-patch-form");
  const label  = document.getElementById("diag-patch-date-label");
  const fields = document.getElementById("diag-patch-fields");
  if (!form || !fields) return;

  if (label) label.textContent = `Editing ${row.date}`;
  fields.innerHTML = "";

  const PATCH_FIELDS = [
    ["btc_price_krw",    "BTC Price (₩)"],
    ["btc_total_krw",    "BTC Total (₩)"],
    ["eth_total_krw",    "ETH Total (₩)"],
    ["us_total_krw",     "US Total (₩)"],
    ["korean_total_krw", "KR Total (₩)"],
    ["krw_total_krw",    "KRW (₩)"],
    ["total_krw",        "Grand Total (₩)"],
  ];

  PATCH_FIELDS.forEach(([field, lbl]) => {
    const wrap = document.createElement("label");
    wrap.className = "diag-patch-label";
    wrap.innerHTML = `<span style="font-size:0.7rem;opacity:0.7">${lbl}</span>`;
    const inp = document.createElement("input");
    inp.type  = "number";
    inp.id    = `diag-field-${field}`;
    inp.value = row[field] != null ? Math.round(row[field]) : "";
    inp.placeholder = lbl;
    wrap.appendChild(inp);
    fields.appendChild(wrap);
  });

  form.classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function saveDiagPatch() {
  if (!diagPatchRow) return;
  const pw = document.getElementById("diag-patch-pw")?.value || "";
  if (!pw) { alert("Enter admin password first."); return; }

  const PATCH_FIELDS = ["btc_price_krw","btc_total_krw","eth_total_krw",
                        "us_total_krw","korean_total_krw","krw_total_krw","total_krw"];
  const payload = { date: diagPatchRow.date, password: pw };
  PATCH_FIELDS.forEach(f => {
    const inp = document.getElementById(`diag-field-${f}`);
    if (inp && inp.value !== "") payload[f] = parseFloat(inp.value);
  });

  const saveBtn = document.getElementById("diag-patch-save");
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving…"; }

  try {
    const res  = await fetch("/api/admin/patch-snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { alert("Error: " + (data.error || res.status)); return; }
    alert(`Saved! Updated fields: ${data.updated.join(", ")}`);
    document.getElementById("diag-patch-form")?.classList.add("hidden");
    diagPatchRow = null;
    // Reload diagnostic view and refresh history
    const date = document.getElementById("diag-date")?.value || "2026-06-19";
    const days = parseInt(document.getElementById("diag-days")?.value || "14");
    await loadDiagnostics(date, days);
    weeklyHistData = [];
    historyData    = [];
    await Promise.all([fetchHistory(), fetchWeeklyHistory()]);
    renderActiveTab();
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save"; }
  }
}

// ── Anomaly fix (History tab admin tool) ─────────────────────
async function runAnomalyFix() {
  const btn = document.getElementById("fix-anomaly-btn");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Scanning…"; }
  try {
    const diagRes = await fetch("/api/admin/diagnose-anomalies");
    const diag    = await diagRes.json();
    if (!diag.anomalies.length) {
      alert("No anomalies detected in BTC price or portfolio total history.");
      if (btn) { btn.disabled = false; btn.textContent = STRINGS[lang].btn_fix_anomalies; }
      return;
    }
    const msg = diag.anomalies.map(a =>
      `${a.date} [${a.field}]: ${fmtShort(a.value)} (×${a.ratio} vs median ${fmtShort(a.median_neighbors)})`
    ).join("\n");
    if (!confirm(`Found ${diag.anomalies.length} anomaly(ies):\n\n${msg}\n\nApply linear interpolation fix?`)) {
      if (btn) { btn.disabled = false; btn.textContent = STRINGS[lang].btn_fix_anomalies; }
      return;
    }
    if (btn) btn.textContent = "⏳ Fixing…";
    const fixRes = await fetch("/api/admin/fix-anomalies", { method: "POST" });
    const fix    = await fixRes.json();
    const fixMsg = fix.details.map(f =>
      `${f.date} [${f.field}]: ${fmtShort(f.old)} → ${fmtShort(f.new)} (×${f.ratio})`
    ).join("\n");
    alert(`Fixed ${fix.fixed} row(s):\n\n${fixMsg}`);
    // Refresh history data
    weeklyHistData = [];
    historyData    = [];
    await Promise.all([fetchHistory(), fetchWeeklyHistory()]);
    renderActiveTab();
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = STRINGS[lang].btn_fix_anomalies; }
  }
}

// ── Init ──────────────────────────────────────────────────────
(async () => {
  loadRetirementParams();
  setupNotesSections();
  await fetchCryptoPrices();
  await Promise.all([fetchHoldings(), fetchHistory(), fetchStockPrices()]);
  await checkAndBackfill();
  fetchWeeklyHistory();
  setInterval(fetchStockPrices, 300_000);
})();
