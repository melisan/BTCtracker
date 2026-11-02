"use strict";
(() => {
  const root = document.getElementById("retirement-dashboard");
  let current = null, editing = false, busy = false;
  const forecastSettings = {pool:"bank", extra:0, months:36};
  const fmt = value => {
    if (value == null) return "계산 보류";
    const sign = value < 0 ? "−" : "";
    let rest = Math.round(Math.abs(value));
    const billion = Math.floor(rest / 100000000); rest %= 100000000;
    const man = Math.floor(rest / 10000); rest %= 10000;
    return sign + [billion ? `${billion.toLocaleString("ko-KR")}억` : "", man ? `${man.toLocaleString("ko-KR")}만` : "", rest ? rest.toLocaleString("ko-KR") : ""].filter(Boolean).join(" ") + (billion || man || rest ? "원" : "0원");
  };
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function button(text, action) {
    const node = el("button", text, "secondary");
    node.type = "button"; node.addEventListener("click", action); return node;
  }
  function table(headers, rows) {
    const wrap = el("div", null, "ret-table-wrap"), t = el("table", null, "ret-table");
    const head = el("thead"), tr = el("tr"), body = el("tbody");
    headers.forEach(label => tr.append(el("th", label))); head.append(tr);
    rows.forEach(values => { const row = el("tr"); values.forEach(value => { const cell = el("td"); cell.append(value instanceof Node ? value : document.createTextNode(String(value ?? "—"))); row.append(cell); }); body.append(row); });
    t.append(head, body); wrap.append(t); return wrap;
  }
  function section(id, title, hint) {
    const node = el("section", null, "ret-section"); node.id = id;
    node.append(el("h2", title)); if (hint) node.append(el("p", hint, "hint")); root.append(node); return node;
  }
  function cards(items) {
    const grid = el("div", null, "ret-cards");
    items.forEach(([label, value, detail]) => { const card = el("div", null, "ret-card"); card.append(el("span", label), el("strong", fmt(value))); if (detail) card.append(el("small", detail)); grid.append(card); }); return grid;
  }
  function accountRows(rows, plan, recovered) {
    return rows.map(row => [row.name, row.description, row.account || "—", fmt(row.amount), row.maturity || "만기 미입력", recovered ? fmt(plan.recovery_overrides[row.id] ?? row.amount + (row.interest || 0)) : fmt(row.interest || 0)]);
  }
  function careProjection(projection, summary) {
    const section = el("section", null, "ret-care-projection"); section.id="ret-projection";
    section.append(el("h2", "앞으로 얼마나 사용할 수 있는지"));
    if(!projection?.available){section.append(el("p",projection?.reason||"지출 전망을 준비 중입니다.","hint"));return section;}
    const p=projection;
    section.append(el("p", `요양원비는 고정 월액, 나머지는 ${p.history_start}부터 ${p.history_end_exclusive} 직전까지 완료된 ${p.history_months}개월 평균입니다.`, "hint"));
    section.append(cards([["고정 요양원비 · 월",p.monthly_nursing],["의료·생활 부대비용 · 월평균",p.monthly_overhead],["기본 총사용액 · 월",p.monthly_total],["기본 총사용액 · 연",p.annual_total]]));
    const history=el("details");history.append(el("summary","부대비용 월평균 산출 내역"),table(["분류","기간 실제 합계","월평균"],p.overhead_categories.map(r=>[r.label,fmt(r.total),fmt(r.monthly)])));
    history.append(el("p","요양원 정기 청구는 고정액으로 대체합니다. 정산·상환과 지원·포상은 부대비용 평균에서 제외하고, 의료·간병·의복·식비·통신·주택관리·기타 기록은 포함합니다.","hint"));
    if(p.missing_months.length)history.append(el("p",`기록이 없는 달: ${p.missing_months.join(", ")}. 달력상 기간 전체로 나누며 해당 월 기록은 0원으로 반영됩니다. 현재 진행 중인 월은 평균에서 제외합니다.`,"hint"));section.append(history);
    const controls=el("div",null,"ret-projection-controls");
    const poolLabel=el("label","사용할 자산 범위"),pool=el("select");
    p.funds.forEach(row=>{const option=el("option",row.label);option.value=row.kind;pool.append(option);});pool.value=forecastSettings.pool;poolLabel.append(pool);
    const extraLabel=el("label","월 추가 가구사용액 (원)"),extra=el("input");extra.type="number";extra.min="0";extra.max="9000000000000000";extra.step="10000";extra.value=forecastSettings.extra;extraLabel.append(extra);
    const horizonLabel=el("label","확보하려는 기간 (개월)"),horizon=el("input");horizon.type="number";horizon.min="1";horizon.max="1200";horizon.step="1";horizon.value=forecastSettings.months;horizonLabel.append(horizon);
    controls.append(poolLabel,extraLabel,horizonLabel);section.append(controls);
    const output=el("div",null,"ret-projection-output");section.append(output);
    function duration(months){const full=Math.max(0,Math.floor(months));return `약 ${full.toLocaleString("ko-KR")}개월 · ${Math.floor(full/12)}년 ${full%12}개월`;}
    function update(){
      if(!extra.validity.valid||!horizon.validity.valid)return;
      forecastSettings.pool=pool.value;forecastSettings.extra=Number(extra.value)||0;forecastSettings.months=Number(horizon.value)||36;
      const cost=p.monthly_total+forecastSettings.extra,chosen=p.funds.find(r=>r.kind===pool.value)||p.funds[1],months=forecastSettings.months;
      output.replaceChildren();
      output.append(cards([["선택 자산",chosen.amount],["추가 사용 포함 · 월",cost],["이 속도로 사용할 수 있는 기간",null]]));
      const period=output.querySelector(".ret-card:last-child strong");period.textContent=duration(Math.max(0,chosen.amount)/cost);
      const rows=el("div",null,"ret-runway-rows"),max=Math.max(...p.funds.map(r=>Math.max(0,r.amount)/cost),1);
      p.funds.forEach((row,index)=>{
        const line=el("div",null,"ret-runway-row"),head=el("div",null,"ret-flow-title");head.append(el("span",row.label),el("strong",duration(Math.max(0,row.amount)/cost)));
        const track=el("div",null,"ret-flow-track"),bar=el("div",null,`ret-flow-segment ${["flow-liquid","flow-bank","flow-btc","flow-housing"][index]}`);bar.style.width=`${Math.max(0,row.amount)/cost/max*100}%`;track.append(bar);track.setAttribute("role","img");track.setAttribute("aria-label",`${row.label}: ${fmt(row.amount)}, ${duration(Math.max(0,row.amount)/cost)}`);
        line.append(head,track);rows.append(line);
      });output.append(rows);
      const needed=cost*months,left=chosen.amount-needed,maxExtra=Math.max(0,chosen.amount/months-p.monthly_total);
      output.append(cards([[`${months}개월 동안 필요한 금액`,needed],[`${months}개월 후 예상잔액`,left],[`기본 돌봄비용 확보 후 · 월 추가 사용 여력`,maxExtra,`${months}개월에 걸쳐 나누어 쓸 경우`]]));
      if(pool.value==="bank"){
        let balance=summary.liquid_projected,previous=0;
        const start=new Date(summary.today+"T00:00:00+09:00").getTime();
        for(const event of [...p.maturities].sort((a,b)=>a.date.localeCompare(b.date))){
          const t=(new Date(event.date+"T00:00:00+09:00").getTime()-start)/(86400000*365.25/12);
          if(balance<cost*(t-previous)){output.append(el("p",`예금 만기 전 유동자금이 먼저 소진됩니다: ${duration(previous+Math.max(0,balance)/cost)}. 위 전체 예금 기간과 별개로 만기 전 필요한 현금 확보를 확인하세요.`,"ret-warning"));break;}
          balance-=cost*(t-previous);balance+=event.amount;previous=t;
        }
      }
      output.append(el("p","현재 잔액과 같은 월 지출이 유지되는 단순 전망입니다. 향후 예금이자·투자수익·물가상승은 더하지 않습니다. BTC는 기록값으로 환금화하고 보증금은 반환받아 사용할 경우의 범위를 따로 표시합니다. 이 조정은 시뮬레이션이며 저장된 자산·지출을 바꾸지 않습니다.","hint"));
    }
    [pool,extra,horizon].forEach(input=>input.addEventListener("input",update));update();return section;
  }
  function fundGraph(plan, s) {
    const figure = el("figure", null, "ret-fund-graph");
    figure.append(el("figcaption", "처음자산이 지금 어디에 있는지"));
    if (s.available_total == null || s.available_total <= 0) {
      figure.append(el("p", "가계부 연결 후 자산 흐름을 표시합니다.", "hint")); return figure;
    }
    const pct = (value, total) => {const ratio=value/total*100;return `${ratio.toLocaleString("ko-KR", {maximumFractionDigits:ratio!==0&&Math.abs(ratio)<.1?3:1})}%`;};
    function bar(items, total, name) {
      const track = el("div", null, "ret-flow-track");
      track.setAttribute("role", "img");
      track.setAttribute("aria-label", `${name}: ${items.map(r=>`${r.label} ${fmt(r.value)}`).join(", ")}`);
      items.forEach(item => {
        if (item.value <= 0) return;
        const segment = el("div", null, `ret-flow-segment ${item.color}`);
        segment.style.width = `${item.value / total * 100}%`;
        segment.title = `${item.label} · ${fmt(item.value)} · ${pct(item.value,total)}`;
        if (item.value / total >= .12) segment.append(el("span", `${item.label} ${pct(item.value,total)}`));
        track.append(segment);
      }); return track;
    }
    function legend(items, total) {
      const list = el("div", null, "ret-flow-legend");
      items.forEach(item => {
        const card = el("div", null, "ret-flow-key"), title = el("span", null, "ret-flow-key-title");
        const dot = el("i", null, item.color); dot.setAttribute("aria-hidden", "true");
        title.append(dot, document.createTextNode(item.label));
        card.append(title, el("strong", fmt(item.value)), el("small", pct(item.value,total))); list.append(card);
      }); return list;
    }
    const source = [{label:"처음자산",value:s.origin_total,color:"flow-origin"},{label:"회수 이자",value:s.interest_received,color:"flow-interest"}];
    const sourceTitle = el("div", null, "ret-flow-title"); sourceTitle.append(el("span", "출발 · 처음자산 + 회수 이자"), el("strong", fmt(s.available_total)));
    figure.append(sourceTitle, bar(source, s.available_total, "자금 원천"));
    figure.append(el("p", `고정 원본 ${fmt(s.origin_total)} + 회수 이자 ${fmt(s.interest_received)}`, "ret-flow-source-note"));
    const allocation = [{label:"현재 보유",value:s.holdings_total,color:"flow-held"},{label:"지급·이전",value:s.paid_total,color:"flow-paid"},{label:"미대사 차액",value:s.gap,color:"flow-gap"}];
    const balanced = allocation.every(r=>r.value>=0) && s.interest_received>=0;
    const nowTitle = el("div", null, "ret-flow-title"); nowTitle.append(el("span", "현재 · 남은 자산과 사용된 자금")); figure.append(nowTitle);
    if (balanced) figure.append(bar(allocation,s.available_total,"현재 자금 배분"));
    else figure.append(el("p","음수 잔액 또는 대사 초과가 있어 비율 그래프를 보류합니다. 아래 금액을 확인해 주세요.","ret-warning"));
    figure.append(legend(allocation,s.available_total));
    figure.append(el("p", "두 막대는 같은 금액 척도입니다. 지급·이전에는 자동차·생활비·가구로 이전한 금액이 포함됩니다. 작은 미대사 차액은 실제 비율대로 표시합니다.", "hint"));
    const snapshot = kind => plan.holdings.filter(r=>r.kind===kind).reduce((n,r)=>n+r.amount,0);
    const held = [{label:"은행 예치금",value:s.bank_total,color:"flow-bank"},{label:"주택 보증금",value:snapshot("housing"),color:"flow-housing"},{label:"BTC 기록값",value:snapshot("btc"),color:"flow-btc"},{label:"유동자금",value:s.liquid_projected,color:"flow-liquid"}];
    const other = snapshot("other");if(other)held.push({label:"기타 보유",value:other,color:"flow-origin"});
    const detail = el("details", null, "ret-flow-details"); detail.open = true;
    detail.append(el("summary", "남아 있는 자산의 구성"));
    if(s.holdings_total>0&&held.every(r=>r.value>=0))detail.append(bar(held,s.holdings_total,"현재 보유자산 구성"));
    detail.append(legend(held,s.holdings_total||1));figure.append(detail);return figure;
  }
  async function get(path) {
    const response = await fetch(`/asset-status/${path}`, {cache: "no-store"});
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "자료를 불러오지 못했습니다."); return result;
  }
  async function refresh() {
    if (editing || busy || document.activeElement?.closest(".ret-projection-controls")) return;
    busy = true;
    try { current = await get("retirement-summary"); render(); }
    catch (error) { if (!current) root.replaceChildren(el("p", error.message, "ret-warning")); else root.prepend(el("p", `갱신 실패: ${error.message}`, "ret-warning")); }
    finally { busy = false; }
  }
  function render() {
    root.replaceChildren();
    if (!current.initialized) { root.append(el("h1", "은퇴자산 현황"), el("p", "원본 자료를 보존하면서 은퇴자산 대사를 준비 중입니다.")); return; }
    const {plan, summary: s, ledger} = current;
    const heading = el("div", null, "heading"); heading.append(el("h1", "부모님 은퇴자산 현황"), button("가계부 새로고침", refresh)); root.append(heading);
    root.append(el("p", `만기 분류 기준: ${s.today} · 가계부 마지막 조회: ${ledger.fetched_at ? new Date(ledger.fetched_at).toLocaleString("ko-KR") : "연결 안 됨"}`, "hint"));
    if (ledger.stale) root.append(el("p", ledger.error, "ret-warning"));
    root.append(cards([["처음자산 · 고정 원본", s.origin_total], ["현재 보유자산 · 계산잔액", s.holdings_total, "보증금·BTC·예금·유동자금 포함"], ["지급·이전 누계", s.paid_total, "주요 지급 + 가계부 홍천지출"], ["미대사 차액", s.gap, "대사 가정에 따른 잔여 차액"]]));
    root.append(el("p", "처음자산 + 회수 이자 = 현재 보유자산 + 지급·이전 누계 + 미대사 차액", "ret-equation"));
    root.append(fundGraph(plan,s));
    root.append(careProjection(current.projection,s));
    const nav = el("div", null, "section-links");
    [["ret-projection", "사용기간 전망"], ["ret-origin", "원본·회수 계좌"], ["ret-holdings", "현재 보유"], ["ret-major", "주요 지급·이전"], ["ret-spending", "홍천지출 누계"]].forEach(([id, name]) => {const a = el("a", name); a.href = `#${id}`; nav.append(a);}); root.append(nav);

    const origin = section("ret-origin", "처음자산과 계좌 회수", "원본은 고정 보존합니다. 한국 날짜 기준 만기일에 자동으로 ‘회수’로 분류하며, 만기는 소비를 뜻하지 않습니다. 실제 입금 확인이 아니라 만기 기준 분류입니다.");
    origin.append(cards([["회수된 예금 · 원금과 이자", s.recovered_total], ["예치 중인 원금", s.bank_total], ["회수 이자", s.interest_received, "확인된 회수금 우선 · 나머지는 원본 기재 이자"]]));
    origin.append(el("h3", "예치 중인 원본 계좌"), table(["명의", "예금", "계좌", "원금", "만기", "기재 이자"], accountRows(s.holding_accounts, plan, false)));
    origin.append(el("h3", "회수된 원본 계좌"), table(["명의", "예금", "원본 계좌", "원금", "회수 분류일", "회수 원리금"], accountRows(s.recovered_accounts, plan, true)));
    const originalDetails = el("details"); originalDetails.append(el("summary", "전체 원본 계좌 · 처음 금액 보기"), table(["명의", "항목", "계좌", "원본 금액", "만기", "기재 이자"], accountRows(plan.origin.accounts, plan, false))); origin.append(originalDetails);

    const holdings = section("ret-holdings", "현재 보유자산", `확인된 보유금액 기준일: ${plan.holdings_as_of || plan.baseline.date}. BTC는 기록값이며 실시간 시세가 아닙니다. 주택 보증금은 소비가 아니라 보유자산입니다.`);
    holdings.append(button("보유금액 수정", () => editor("holdings")));
    const names = {btc: "BTC · 기록값", housing: "주택 보증금", liquid: "유동 계좌", other: "기타 보유"};
    holdings.append(table(["보유 항목", "분류", "확인 금액", "내용"], plan.holdings.map(r => [r.label, names[r.kind], fmt(r.amount), r.note || "—"])));
    holdings.append(cards([["은행에 남은 예치금", s.bank_total], ["현재 유동자금 · 계산잔액", s.liquid_projected], ["보유자산 합계", s.holdings_total]]));
    holdings.append(el("p", `유동자금 계산: 확인 잔액 − 기준일 이후 가계부 지출 증감 ${fmt(s.ledger_change)} + 이후 만기 회수 ${fmt(s.newly_recovered)}. 개별 계좌 금액은 확인 시점의 잔액이며, 합산 계산잔액에만 후속 변동을 반영합니다.`, "hint"));

    const major = section("ret-major", "과거 주요 지급 · 가구 이전", "주요 지급과 가계부 홍천지출은 별도로 집계합니다. 보증금은 이 표에 중복 포함하지 않습니다.");
    major.append(button("주요 지급 수정", () => editor("major")), table(["항목", "금액", "근거 · 대사 가정"], plan.major.map(r => [r.label, fmt(r.amount), r.note || "—"])), cards([["주요 지급·이전 합계", s.major_total]]));
    major.append(el("p", plan.assumption_note || "", "ret-warning"));

    const spend = section("ret-spending", "가계부 연동 · 홍천지출 실제 누계", "가계부의 홍천지출 유형 및 홍천 분류 항목을 자동 반영합니다. 예산이나 미래 예상비용이 아닌 기록된 지급액입니다. 메모 기반 분류이며 원문을 함께 제공합니다.");
    const link = el("a", "가계부 거래 내역 열기"); link.href = "https://harmonious-love-production-a253.up.railway.app/transactions"; link.target = "_blank"; link.rel = "noopener noreferrer"; spend.append(link);
    if (!ledger.rows) {spend.append(el("p", ledger.error, "ret-warning")); return;}
    const rows = ledger.rows.filter(r => r.date <= s.today), groups = new Map();
    rows.forEach(row => {const list = groups.get(row.spending_category) || []; list.push(row); groups.set(row.spending_category, list);});
    spend.append(cards([["홍천지출 누계", s.minor_total, `전체 ${rows.length}건 · 정산·상환 포함`]]));
    spend.append(table(["분류", "건수", "실제 누계"], [...groups].map(([name, list]) => [name, `${list.length}건`, fmt(list.reduce((n,r)=>n+Math.abs(r.amount),0))])));
    for (const [name, list] of groups) {
      const details = el("details", null, "ret-ledger-group"); details.append(el("summary", `${name} · ${list.length}건 · ${fmt(list.reduce((n,r)=>n+Math.abs(r.amount),0))}`));
      details.append(table(["날짜", "실제 지급액", "메모 원문", "결제수단", "거래 ID"], list.map(r => [r.date, fmt(Math.abs(r.amount)), r.memo || "메모 없음", r.payment_method || "—", r.id]))); spend.append(details);
    }
    const months = new Map(); rows.forEach(r => {const key=r.date.slice(0,7); months.set(key,(months.get(key)||0)+Math.abs(r.amount));});
    const monthly = el("details"); monthly.append(el("summary", "월별 홍천지출 누계"), table(["월", "지급액"], [...months].sort().map(([m,v])=>[m,fmt(v)]))); spend.append(monthly);
  }
  function editor(field) {
    if (editing) return;
    editing = true;
    const dialog = el("dialog", null, "ret-editor"), form = el("form");
    form.append(el("h2", field === "holdings" ? "보유금액 수정" : "주요 지급 수정"));
    form.append(el("p", field === "holdings" ? "각 계좌의 오늘 실제 잔액과 현재 보유금액을 확인하여 입력하세요. 저장하면 오늘까지의 가계부 지급내역을 반영한 새 잔액 기준으로 삼고, 이후 지출부터 계산잔액에 차감합니다." : "주요 지급금액을 수정합니다. 가계부 홍천지출에 이미 들어간 거래는 여기에 다시 더하지 마세요.", "hint"));
    const items = structuredClone(current.plan[field]);
    items.forEach(row => {
      const label = el("label", row.label), input = el("input"); input.type="number";input.min="0";input.max="9000000000000000";input.step="1";input.required=true;input.value=row.amount;
      input.addEventListener("input",()=>{row.amount=Number(input.value);});label.append(input);form.append(label);
    });
    const status=el("p",null,"ret-warning"), save=el("button","저장"), cancel=button("취소",()=>dialog.close());save.type="submit";
    form.append(status,save,cancel);dialog.append(form);root.append(dialog);
    dialog.addEventListener("close",()=>{editing=false;dialog.remove();});
    form.addEventListener("submit",async event=>{
      event.preventDefault();save.disabled=true;cancel.disabled=true;
      try {
        const {document: doc} = await get("records");
        if (JSON.stringify(doc.retirement) !== JSON.stringify(current.plan)) throw new Error("다른 화면에서 자료가 변경됐습니다. 취소 후 새로고침해 주세요.");
        doc.retirement[field]=items;
        if(field === "holdings") {
          const latest = await get("retirement-summary");
          if(latest.ledger.stale || latest.summary.minor_total == null) throw new Error("가계부 최신 자료를 확인한 후 잔액을 저장해 주세요.");
          doc.retirement.holdings_ledger_total=latest.summary.minor_total;
          doc.retirement.holdings_recovered_total=latest.summary.recovered_total;
          doc.retirement.holdings_as_of=latest.summary.today;
        }
        const response=await fetch("/asset-status/records",{method:"PUT",headers:{"Content-Type":"application/json","X-Asset-Request":"1"},body:JSON.stringify(doc)});
        const result=await response.json();if(!response.ok)throw new Error(result.error||"저장하지 못했습니다.");
        dialog.close();await refresh();
      }catch(error){status.textContent=error.message;save.disabled=false;cancel.disabled=false;}
    });dialog.showModal();
  }
  refresh();
  setInterval(()=>{if(!document.hidden)refresh();},60000);
  window.addEventListener("pageshow",event=>{if(event.persisted)refresh();});
})();
