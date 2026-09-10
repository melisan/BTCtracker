"use strict";
(() => {
  const $ = id => document.getElementById(id);
  let setupToken = "";
  $("start-setup").addEventListener("click",()=>{$("owner-form").hidden=false;$("start-setup").hidden=true;});
  $("owner-form").addEventListener("submit",async event=>{
    event.preventDefault();const button=event.submitter;button.disabled=true;
    setupToken=$("owner-code").value;$("owner-code").value="";
    try{
      await api("setup-access","POST",{});
      $("owner-form").hidden=true;$("unlock-form").hidden=true;$("setup-form").hidden=false;
      message("소유자 확인을 완료했습니다. 사용할 비밀번호를 정해 주세요.");
    }catch(error){setupToken="";message(error.message,true);}
    finally{button.disabled=false;}
  });
  $("setup-form").addEventListener("submit",async event=>{
    event.preventDefault();
    const password=$("new-password").value;
    if(password!==$("confirm-password").value){message("비밀번호가 일치하지 않습니다.",true);return;}
    const button=event.submitter; button.disabled=true;
    try {
      await api("setup","POST",{password}); setupToken="";
      $("setup-form").hidden=true; $("unlock-form").hidden=false;
      message("비밀번호를 설정했습니다. 설정한 비밀번호로 열어 주세요.");
    } catch(error){message(error.message,true);}
    finally {$("new-password").value="";$("confirm-password").value="";button.disabled=false;}
  });
  const groups = {total:"전체자산",bonds:"현재 자산 현황",movement:"자금이동대상"};
  const fields = ["category","name","description","account","amount","interest","notes","maturity"];
  const labels = ["항목","이름","내용","계좌번호","원본총액 (원)","이자 (원)","내용(비고)","만기일"];
  let data = null, token = "", dirty = false, saving = false, timer = null, deadline = 0, generation = 0;
  const editingSections = new Set();
  function applyEditState(){
    document.querySelectorAll(".asset-section").forEach(section=>{
      const editing=editingSections.has(section.id);
      section.querySelectorAll("input,select,textarea,button:not(.section-edit):not(.section-save-button)").forEach(el=>el.disabled=saving||!editing);
      section.querySelectorAll("[data-source-linked]").forEach(el=>el.disabled=true);
      const edit=section.querySelector(".section-edit"),save=section.querySelector(".section-save-button");
      if(edit){edit.disabled=saving||editing;edit.textContent=editing?"수정 중":"수정";}
      if(save)save.disabled=saving||!editing;
    });
    $("save").disabled=saving;
  }
  const money = n => new Intl.NumberFormat("ko-KR",{maximumFractionDigits:2}).format(n)+"원";
  const yearNow = () => Number(new Intl.DateTimeFormat("en",{timeZone:"Asia/Seoul",year:"numeric"}).format(new Date()));
  const todayKorea = () => {const parts=new Intl.DateTimeFormat("en",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());return ["year","month","day"].map(type=>parts.find(p=>p.type===type).value).join("-");};
  const bondCompleted = row => Boolean(row.maturity && row.maturity<todayKorea());
  const bondWaiting = row => Boolean(row.maturity && row.maturity>todayKorea());
  const bondRows = () => data.accounts.filter(r=>r.group==="total"&&r.category==="예적금");
  const consumedAsset = row => row.group==="total" && row.category==="예적금" && Boolean(row.maturity && row.maturity<"2026-06-01");
  let renderedDay="";
  const sum = (rows,field="amount") => rows.reduce((n,r) => n+(r[field] ?? 0),0);
  function message(text,error=false) { $("message").textContent=text; $("message").classList.toggle("error",error); }
  function syncMovement(){
    if(!data)return;
    data.accounts.filter(r=>r.group==="movement"&&r.source_id).forEach(row=>{
      const source=data.accounts.find(r=>r.group==="total"&&r.id===row.source_id);if(!source)return;
      fields.forEach(field=>{row[field]=source[field];});
      document.getElementById(`asset-row-${row.id}`)?.querySelectorAll("[data-source-linked]").forEach(control=>{
        const field=control.dataset.sourceLinked;control.value=["amount","interest"].includes(field)?(row[field]==null?"":new Intl.NumberFormat("ko-KR",{maximumFractionDigits:20}).format(row[field])):row[field]??"";
        if(field==="name")applyNameColor(control,control.value);
      });
    });
    bondRows().forEach(row=>document.getElementById(`bond-view-${row.id}`)?.querySelectorAll("[data-source-linked]").forEach(control=>{
      const field=control.dataset.sourceLinked;control.value=["amount","interest"].includes(field)?(row[field]==null?"":new Intl.NumberFormat("ko-KR",{maximumFractionDigits:20}).format(row[field])):row[field]??"";
      if(field==="name")applyNameColor(control,control.value);
    }));
  }
  function changed() { dirty=true; syncMovement();totals(); document.querySelectorAll(".section-save-status").forEach(el=>el.textContent="");message("수정한 내용이 있습니다. 변경사항을 저장해 주세요."); }
  async function api(path,method="GET",body) {
    const response=await fetch(`/asset-status/${path}`,{method,credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json","X-Asset-Request":"1","X-Asset-Token":token,"X-Asset-Setup":setupToken},
      body:body===undefined?undefined:JSON.stringify(body)});
    const result=await response.json();
    if(!response.ok) throw new Error(result.error || "요청을 완료하지 못했습니다.");
    return result;
  }
  function clear() {
    closePrintPreview();
    generation++; data=null; token=""; dirty=false; clearInterval(timer); timer=null;
    editingSections.clear();
    document.querySelectorAll(".print-value").forEach(el=>el.remove());
    document.querySelectorAll(".sensitive-table").forEach(el=>el.replaceChildren());
    document.querySelectorAll("[data-sensitive]").forEach(el=>el.textContent="");
    document.querySelectorAll("[data-document-field]").forEach(el=>el.value="");
    $("updated").textContent=""; $("password").value="";
    ["owner-code","new-password","confirm-password","workbook-file","blue-name","green-name"].forEach(id=>$(id).value="");
    $("workspace").hidden=true; $("locked").hidden=false;
  }
  async function lock(automatic=false) {
    if(!automatic && dirty && !confirm("저장하지 않은 수정 내용이 있습니다. 내용을 버리고 잠글까요?")) return;
    clear(); message(automatic?"열람 시간이 끝나 잠겼습니다. 비밀번호를 다시 입력해 주세요.":"잠겼습니다.");
    try { await api("lock","POST",{}); } catch { /* Memory is cleared even without a network. */ }
  }
  function applyNameColor(input,value) {
    input.classList.remove("name-blue","name-green");
    const color=data?.name_colors?.[String(value).trim()];
    if(color==="blue" || color==="green") input.classList.add(`name-${color}`);
  }
  function totals() {
    if(!data) return;
    const total=data.accounts.filter(r=>r.group==="total"), deposits=total.filter(r=>r.category==="예적금");
    const overall=sum(total)+sum(data.other_assets||[]),consumed=sum(total.filter(consumedAsset)),reserve=data.held_reserve_amount||0;
    $("overall-total").textContent=money(overall);$("held-total").textContent=money(overall-consumed-reserve);
    document.querySelectorAll("[data-asset-subtotal]").forEach(el=>el.textContent=`원본총액 ${money(el.dataset.assetSubtotal==="consumed"?consumed:overall-consumed)}${el.dataset.assetSubtotal==="held"?" (임시보류 차감 전)":""}`);
    $("total").textContent=money(sum(deposits)); $("interest-total").textContent=money(sum(deposits,"interest"));
    const year=yearNow(); $("year-label").textContent=`${year}년 만기 예·적금`;
    $("due-total").textContent=`${deposits.filter(r=>r.maturity && Number(r.maturity.slice(0,4))===year).length}건`;
    let available=0;
    ["bonds","movement"].forEach(group=>{
      const rows=group==="bonds"?bondRows():data.accounts.filter(r=>r.group===group), principal=sum(rows), interest=sum(rows,"interest");
      $(`${group}-principal`).textContent=money(principal);
      if(group==="bonds") {
        $("bonds-interest").textContent=money(interest);$("bonds-combined").textContent=money(principal+interest);
        available=principal+interest;
        document.querySelectorAll("[data-bond-status-total]").forEach(el=>{
          const subset=rows.filter(el.dataset.bondStatusTotal==="completed"?bondCompleted:bondWaiting);
          const principal=sum(subset),interest=sum(subset,"interest");
          el.textContent=`소계 ${money(principal+interest)} (이자+원금)`;
        });
        document.querySelectorAll("[data-bond-year-total]").forEach(el=>{
          const subset=rows.filter(r=>Number(r.maturity?.slice(0,4))===Number(el.dataset.bondYearTotal)&&bondWaiting(r));
          el.textContent=`원본총액 ${money(sum(subset))} · 이자 ${money(sum(subset,"interest"))}`;
        });
      }
    });
    const needed=sum(data.future);
    $("future-total").textContent=money(needed); $("future-available").textContent=money(available);
    $("future-balance").textContent=money(available-needed); const annualExpenses=sum(data.expenses);
    $("expenses-total").textContent=money(annualExpenses);
    $("expenses-five-year").textContent=money(annualExpenses*5);
    $("expenses-ten-year").textContent=money(annualExpenses*10);
    data.accounts.forEach(row=>{
      const due=!!row.maturity && Number(row.maturity.slice(0,4))===year;
      [`asset-row-${row.id}`,`bond-view-${row.id}`].forEach(id=>{const tr=document.getElementById(id);if(!tr)return;tr.classList.toggle("due",due);const mark=tr.querySelector(".due-mark");if(mark)mark.hidden=!due;});
    });
  }
  function makeInput(row,field,label,options=null) {
    const numeric=["amount","interest","year"].includes(field);
    const formattedMoney=field==="amount"||field==="interest";
    const input=document.createElement(options?"select":["description","notes","review_notes"].includes(field)?"textarea":"input");
    input.setAttribute("aria-label",label); input.autocomplete="off"; input.spellcheck=false;
    if(options) options.forEach(value=>{const option=document.createElement("option");option.value=value;option.textContent=field==="year"?`${value}년`:value;input.append(option);});
    else if(input.tagName==="TEXTAREA") input.rows=2;
    else {input.type=field==="maturity"?"date":numeric&&!formattedMoney?"number":"text";if(numeric) input.step="any";if(formattedMoney){input.inputMode="decimal";input.classList.add("money-input");}}
    const formatMoney=()=>{input.value=row[field]===null||row[field]===undefined?"":new Intl.NumberFormat("ko-KR",{maximumFractionDigits:20}).format(row[field]);};
    if(formattedMoney)formatMoney();else input.value=row[field]??"";
    if(field==="name") applyNameColor(input,input.value);
    input.addEventListener("input",()=>{
      const raw=formattedMoney?input.value.replaceAll(",","").trim():input.value;
      if(numeric&&raw!==""&&(!/^-?(?:\d+\.?\d*|\.\d+)$/.test(raw)||!Number.isFinite(Number(raw)))){dirty=true;input.setCustomValidity("올바른 숫자를 입력해 주세요.");return;}
      input.setCustomValidity("");row[field]=numeric?(raw===""?null:Number(raw)):input.value;
      if(field==="name") applyNameColor(input,input.value);
      changed(); if(field==="year") render();
    });
    if(formattedMoney){input.addEventListener("focus",()=>input.select());input.addEventListener("blur",()=>{if(input.validity.valid)formatMoney();});}
    if((field==="maturity" && ["bonds","total"].includes(row.group)) || (field==="category" && row.group==="total"))input.addEventListener("change",render);
    return input;
  }
  function buildTable(headers,compact=false) {
    const wrap=document.createElement("div");wrap.className="table-wrap";
    const table=document.createElement("table");if(compact)table.className="compact-table";
    const head=document.createElement("thead"),tr=document.createElement("tr"),body=document.createElement("tbody");
    headers.forEach(label=>{const th=document.createElement("th");th.textContent=label;tr.append(th);});
    head.append(tr);table.append(head,body);wrap.append(table);return {wrap,body};
  }
  function accountTable(group,rows,prefix) {
    const showDestination=(group==="total"&&prefix==="이미 소비한 자산")||(group==="bonds"&&prefix==="이전완료");
    const destinationLabel=group==="bonds"?"이전처":"이동처";
    const fs=group==="movement"?[...fields,"review_notes"]:showDestination?[...fields,"destination"]:fields;
    const {wrap,body}=buildTable(group==="movement"?[...labels,"이동 검토 메모","관리"]:showDestination?[...labels,destinationLabel]:labels);
    const years=[...new Set([2025,2026,yearNow(),yearNow()+1,...data.accounts.filter(r=>r.group==="bonds").map(r=>r.year)])].sort();
    rows.forEach((row,index)=>{
      const tr=document.createElement("tr");tr.id=group==="bonds"?`bond-view-${row.id}`:`asset-row-${row.id}`;
      fs.forEach(field=>{
        const td=document.createElement("td"),name=field==="year"?"연도":field==="destination"?destinationLabel:field==="review_notes"?"이동 검토 메모":labels[fields.indexOf(field)].replace(" (원)","");
        const options=field==="year"?years:field==="category" && group==="total"?["예적금","코인","주식","금"]:null;
        const control=makeInput(row,field,`${prefix} ${index+1}행 ${name}`,options);
        if((group==="bonds"&&field!=="destination")||(group==="movement"&&row.source_id&&field!=="review_notes")){control.dataset.sourceLinked=field;control.title="전체자산에서 수정하면 함께 갱신됩니다.";}
        td.append(control);
        if(field==="maturity"){const mark=document.createElement("span");mark.className="due-mark";mark.textContent="올해 만기";td.append(mark);}
        tr.append(td);
      });
      if(group==="movement"){
        const td=document.createElement("td"),label=document.createElement("span"),remove=document.createElement("button");label.textContent=row.source_id?"보유자산 연결":"직접 입력";remove.type="button";remove.className="secondary";remove.textContent="대상 해제";
        remove.addEventListener("click",()=>{if(!confirm("이동대상 목록에서 해제할까요? 보유자산은 유지됩니다."))return;data.accounts=data.accounts.filter(r=>r.id!==row.id);dirty=true;render();message("이동대상에서 해제했습니다. 저장해 주세요.");});td.append(label,remove);tr.append(td);
      }
      body.append(tr);
    });
    if(!rows.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=fs.length+(group==="movement"?1:0);td.textContent="등록된 항목이 없습니다. 항목을 추가해 주세요.";tr.append(td);body.append(tr);}
    return wrap;
  }
  function addAccount(group,year=null) {
    if(!data || saving)return;
    data.accounts.push({id:crypto.randomUUID(),group,year:group==="bonds"?(year??yearNow()):null,in_total:group==="total",category:"예적금",name:"",description:"",account:"",amount:null,interest:null,notes:"",maturity:""});
    dirty=true;render();message("새 항목을 입력한 뒤 저장해 주세요.");
  }
  function render() {
    syncMovement();
    renderedDay=todayKorea();
    $("initial-import").hidden=Boolean(data.revision);
    const owned=data.accounts.filter(r=>r.group==="total"),ownedTarget=$("total-accounts");ownedTarget.replaceChildren();
    [{title:"이미 소비한 자산 (2026년 6월 이전 채권 이동)",key:"consumed",prefix:"이미 소비한 자산",rows:owned.filter(consumedAsset)},
      {title:"보유자산",key:"held",prefix:"보유자산",rows:owned.filter(r=>!consumedAsset(r))}].forEach(group=>{
      const heading=document.createElement("h3"),subtotal=document.createElement("p");heading.textContent=group.title;
      if(group.key==="held"){const small=document.createElement("small");small.textContent=" (자산현황)";heading.append(small);}
      subtotal.className="hint";subtotal.dataset.assetSubtotal=group.key;subtotal.textContent=`원본총액 ${money(sum(group.rows))}`;
      ownedTarget.append(heading,subtotal,accountTable("total",group.rows,group.prefix));
    });
    const bonds=$("bonds-accounts");bonds.replaceChildren();
    const completedTitle=document.createElement("h3"),waitingTitle=document.createElement("h3"),rule=document.createElement("p");
    completedTitle.textContent="1. 이전완료";waitingTitle.textContent="2. 이전대기";
    rule.className="hint";rule.textContent=`${renderedDay} 기준, 지난 만기일은 이전완료, 오늘 이후 만기일은 이전대기로 구분합니다. 동일 항목은 중복 표시하지 않습니다.`;
    const completedSubtotal=document.createElement("p"),waitingSubtotal=document.createElement("p");
    completedSubtotal.className=waitingSubtotal.className="bond-status-subtotal";
    completedSubtotal.dataset.bondStatusTotal="completed";waitingSubtotal.dataset.bondStatusTotal="waiting";
    bonds.append(completedTitle,completedSubtotal,rule,accountTable("bonds",bondRows().filter(bondCompleted),"이전완료"),waitingTitle,waitingSubtotal);
    const pendingRows=bondRows().filter(bondWaiting).sort((a,b)=>a.maturity.localeCompare(b.maturity));
    const years=[...new Set(pendingRows.map(r=>Number(r.maturity.slice(0,4))))].sort();
    years.forEach(year=>{
      const section=document.createElement("section"),heading=document.createElement("div"),title=document.createElement("h3"),subtotal=document.createElement("p");
      heading.className="heading";title.textContent=`${year}년`;heading.append(title);subtotal.className="hint";subtotal.dataset.bondYearTotal=year;
      section.append(heading,subtotal,accountTable("bonds",pendingRows.filter(r=>Number(r.maturity.slice(0,4))===year),`이전대기 ${year}년`));bonds.append(section);
    });
    if(!pendingRows.length){const empty=document.createElement("p");empty.textContent="오늘 이후 만기인 이전대기 항목이 없습니다.";bonds.append(empty);}
    const dateCheck=bondRows().filter(r=>!bondCompleted(r)&&!bondWaiting(r));
    if(dateCheck.length){const title=document.createElement("h3");title.textContent="날짜 확인 필요 (오늘 만기·만기일 미입력)";bonds.append(title,accountTable("bonds",dateCheck,"날짜 확인 필요"));}
    $("movement-accounts").replaceChildren(accountTable("movement",data.accounts.filter(r=>r.group==="movement"),"자금이동대상"));
    const sourcePicker=$("movement-source");sourcePicker.replaceChildren();const placeholder=document.createElement("option");placeholder.value="";placeholder.textContent="보유자산을 선택하세요";sourcePicker.append(placeholder);
    const selectedSources=new Set(data.accounts.filter(r=>r.group==="movement").map(r=>r.source_id));
    data.accounts.filter(r=>r.group==="total"&&!selectedSources.has(r.id)).forEach(row=>{const option=document.createElement("option");option.value=row.id;option.textContent=[row.category,row.name,row.description,money(row.amount||0)].filter(Boolean).join(" · ");sourcePicker.append(option);});
    ["future","expenses"].forEach(collection=>{
      const columnLabels=collection==="expenses"?["항목","금액총액","내용"]:collection==="movement"?["항목","금액","내용"]:["항목","금액 (원)","내용(비고)"];
      const {wrap,body}=buildTable(columnLabels,true);
      const rows=collection==="movement"?data.accounts.filter(r=>r.group==="movement"):data[collection];
      rows.forEach((row,index)=>{
        const tr=document.createElement("tr");["description","amount","notes"].forEach((field,column)=>{
          const title=collection==="future"?"미래충족금액":collection==="movement"?"자금이동대상":"소모비용";
          const td=document.createElement("td");td.append(makeInput(row,field,`${title} ${index+1}행 ${columnLabels[column]}`));tr.append(td);
        });body.append(tr);
      });$(collection==="movement"?"movement-accounts":`${collection}-rows`).replaceChildren(wrap);
    });
    document.querySelectorAll("[data-document-field]").forEach(input=>input.value=data[input.dataset.documentField]??(input.dataset.documentField==="held_reserve_amount"?0:""));
    $("updated").textContent=data.updated_at?`최근 저장 ${new Date(data.updated_at).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}`:"아직 등록된 내용이 없습니다.";
    totals();
    applyEditState();
  }
  $("unlock-form").addEventListener("submit",async event=>{
    event.preventDefault();const button=event.currentTarget.querySelector("button");button.disabled=true;const current=++generation;
    try{
      const auth=await api("unlock","POST",{password:$("password").value});$("password").value="";if(current!==generation)return;
      token=auth.token;const result=await api("records");if(current!==generation)return;
      data=result.document||{accounts:[],other_assets:[],future:[],expenses:[],other:"",total_scope:"c1",name_colors:{}};
      let linkedExisting=false;const used=new Set(data.accounts.filter(r=>r.source_id).map(r=>r.source_id));
      data.accounts.filter(r=>r.group==="movement"&&!r.source_id&&r.account&&r.name).forEach(row=>{
        const matches=data.accounts.filter(source=>source.group==="total"&&["category","name","account","description","maturity"].every(field=>(source[field]||"")===(row[field]||"")));
        if(matches.length===1&&!used.has(matches[0].id)){row.source_id=matches[0].id;used.add(row.source_id);if(row.notes!==matches[0].notes)row.review_notes=row.review_notes||row.notes;linkedExisting=true;}
      });
      if(linkedExisting)dirty=true;
      $("locked").hidden=true;$("workspace").hidden=false;render();message(linkedExisting?"원본이 일치하는 이동대상을 보유자산과 연결했습니다. 변경사항을 저장해 주세요.":"");deadline=Date.now()+auth.expires_in*1000;
      const tick=()=>{const left=Math.max(0,Math.floor((deadline-Date.now())/1000));$("remaining").textContent=`${Math.floor(left/60)}분 ${left%60}초`;if(!left)lock(true);else if(renderedDay!==todayKorea())render();else totals();};tick();timer=setInterval(tick,1000);
    }catch(error){if(current===generation)message(error.message,true);}finally{$("password").value="";button.disabled=false;}
  });
  $("workbook-form").addEventListener("submit",async event=>{
    event.preventDefault(); if(saving || !data || data.revision)return;
    const file=$("workbook-file").files[0]; if(!file)return;
    if(file.size>1000000){message("파일은 1MB 이하만 등록할 수 있습니다.",true);return;}
    const colors={}; if($("blue-name").value.trim())colors[$("blue-name").value.trim()]="blue";
    if($("green-name").value.trim())colors[$("green-name").value.trim()]="green";
    saving=true;const current=generation;const button=event.submitter;button.disabled=true;
    try {
      const response=await fetch("/asset-status/initial-workbook",{method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/octet-stream","X-Asset-Request":"1","X-Asset-Token":token,"X-Asset-Name-Colors":encodeURIComponent(JSON.stringify(colors))},body:file});
      const result=await response.json();if(!response.ok)throw new Error(result.error||"파일을 등록하지 못했습니다.");
      if(current!==generation)return;data=result.document;dirty=false;render();message("엑셀 내용을 등록했습니다. 이제 이 화면에서 수정하고 저장할 수 있습니다.");
    }catch(error){if(current===generation)message(error.message,true);}
    finally{saving=false;button.disabled=false;$("workbook-file").value="";$("blue-name").value="";$("green-name").value="";}
  });
  async function saveChanges(){
    if(saving||!data)return false;
    if(![...$("workspace").querySelectorAll(".asset-section input,.asset-section select,.asset-section textarea")].every(input=>input.reportValidity()))return false;
    saving=true;const current=generation;
    applyEditState();
    try{const result=await api("records",data.revision?"PUT":"POST",data);if(current!==generation)return false;data=result.document;dirty=false;editingSections.clear();render();message("저장했습니다.");document.querySelectorAll(".section-save-status").forEach(el=>el.textContent="모든 변경사항을 저장했습니다.");return true;}
    catch(error){if(current===generation){message(error.message,true);document.querySelectorAll(".section-save-status").forEach(el=>el.textContent=error.message);}return false;}
    finally{saving=false;applyEditState();}
  }
  $("save").addEventListener("click",saveChanges);
  $("add-bond-source").addEventListener("click",()=>{if(!data||saving)return;editingSections.add("section-total");addAccount("total");$("section-total").scrollIntoView({behavior:"smooth"});});
  $("add-movement-source").addEventListener("click",()=>{
    if(!data||saving)return;const source=data.accounts.find(r=>r.group==="total"&&r.id===$("movement-source").value);if(!source)return;
    if(data.accounts.some(r=>r.group==="movement"&&r.source_id===source.id))return;
    data.accounts.push({...source,id:crypto.randomUUID(),group:"movement",year:null,in_total:false,source_id:source.id,review_notes:""});dirty=true;render();message("보유자산과 연결해 이동대상에 추가했습니다. 저장해 주세요.");
  });
  $("download-excel").addEventListener("click",async()=>{
    if(!data||saving)return;const current=generation;
    if((dirty||!data.revision)&&!await saveChanges())return;
    if(current!==generation)return;
    const button=$("download-excel");button.disabled=true;
    try{
      const response=await fetch("/asset-status/export",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"X-Asset-Request":"1","X-Asset-Token":token}});
      if(!response.ok)throw new Error("엑셀 파일을 내려받지 못했습니다. 비밀번호와 저장 상태를 확인해 주세요.");
      const blob=await response.blob();if(current!==generation)return;
      const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`asset-status-${new Date().toISOString().slice(0,10)}.xlsx`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      message("엑셀 다운로드를 시작했습니다.");
    }catch(error){if(current===generation)message(error.message,true);}finally{button.disabled=false;}
  });
  function preparePrint(){
    document.querySelectorAll(".print-value").forEach(el=>el.remove());
    if(!data)return;
    document.querySelectorAll(".asset-section input,.asset-section textarea,.asset-section select").forEach(input=>{
      const value=document.createElement("span");value.className="print-value";
      value.textContent=input.tagName==="SELECT"?input.selectedOptions[0]?.textContent||"":input.value;
      if(input.classList.contains("name-blue"))value.classList.add("name-blue");if(input.classList.contains("name-green"))value.classList.add("name-green");
      input.after(value);
    });
  }
  window.addEventListener("beforeprint",preparePrint);
  window.addEventListener("afterprint",()=>document.querySelectorAll(".print-value").forEach(el=>el.remove()));
  function closePrintPreview(){
    $("print-preview").close();
    $("print-preview-content").replaceChildren();
    document.body.classList.remove("print-preview-open");
  }
  $("print-preview").addEventListener("close",closePrintPreview);
  $("close-print-preview").addEventListener("click",closePrintPreview);
  $("print-assets").addEventListener("click",()=>{
    if(!data)return;
    const report=$("print-preview-content");report.replaceChildren();
    $("workspace").querySelectorAll(".asset-section").forEach(section=>{
      const clone=section.cloneNode(true);
      const originals=section.querySelectorAll("input,textarea,select");
      clone.querySelectorAll("input,textarea,select").forEach((control,index)=>{
        const source=originals[index],value=document.createElement("span");
        value.className="report-value";
        value.textContent=source.tagName==="SELECT"?source.selectedOptions[0]?.textContent||"":source.value;
        ["name-blue","name-green"].forEach(name=>{if(source.classList.contains(name))value.classList.add(name);});
        control.replaceWith(value);
      });
      clone.querySelectorAll("button,.section-save,.actions,.hint,.print-value,label[for='movement-source']").forEach(el=>el.remove());
      [clone,...clone.querySelectorAll("*")].forEach(el=>{
        el.removeAttribute("id");el.removeAttribute("for");
        [...el.attributes].filter(attr=>attr.name.startsWith("data-")).forEach(attr=>el.removeAttribute(attr.name));
      });
      clone.classList.replace("asset-section","print-section");report.append(clone);
    });
    $("print-preview-note").textContent=dirty?"현재 화면의 수정 내용을 포함합니다. 앱에 보관하려면 미리보기를 닫고 변경사항을 저장해 주세요.":"현재 화면의 자산 현황입니다.";
    document.body.classList.add("print-preview-open");$("print-preview").showModal();
  });
  $("open-print-dialog").addEventListener("click",()=>{if(data)window.print();});
  $("download-print-file").addEventListener("click",()=>{
    if(!data)return;
    const style="body{font-family:system-ui,sans-serif;color:#111;margin:24px}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:10px}th,td{border:1px solid #aaa;padding:5px;vertical-align:top;overflow-wrap:anywhere}h2,h3{break-after:avoid}tr{break-inside:avoid}.report-value{display:block;white-space:pre-wrap;overflow-wrap:anywhere}.print-section{margin-bottom:28px}.summary{display:flex;gap:24px;margin:16px 0}.summary strong,.overall strong{display:block}.name-blue{color:#165bb0}.name-green{color:#147b3c}.due-mark{color:#b00000}.calculation-note,small{font-size:11px;color:#666}@page{size:A4 landscape;margin:10mm}@media print{body{margin:0}}";
    const html='<!doctype html><html lang="ko"><meta charset="utf-8"><title>자산 현황 인쇄</title><style>'+style+'</style><body><h1>자산 현황</h1>'+$("print-preview-content").innerHTML+'</body></html>';
    const url=URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download=`asset-status-print-${todayKorea()}.html`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  document.querySelectorAll(".asset-section").forEach(section=>{
    const footer=document.createElement("div"),edit=document.createElement("button"),button=document.createElement("button"),status=document.createElement("span");
    footer.className="section-save";button.type="button";button.textContent="변경사항 저장";button.className="section-save-button";
    edit.type="button";edit.className="secondary section-edit";edit.textContent="수정";
    edit.addEventListener("click",()=>{editingSections.add(section.id);status.textContent="각 항목을 수정한 뒤 저장해 주세요. 저장 시 다른 구역의 변경사항도 함께 저장됩니다.";applyEditState();});
    button.addEventListener("click",saveChanges);status.className="section-save-status";status.setAttribute("role","status");
    footer.append(edit,button,status);section.append(footer);
  });
  document.querySelectorAll(".add-account").forEach(button=>button.addEventListener("click",()=>addAccount(button.dataset.group)));
  document.querySelectorAll(".add-simple").forEach(button=>button.addEventListener("click",()=>{
    if(!data||saving)return;const collection=button.dataset.collection;
    data[collection].push({id:crypto.randomUUID(),in_total:false,description:"",amount:null,notes:""});dirty=true;render();message("새 항목을 입력한 뒤 저장해 주세요.");
  }));
  document.querySelectorAll("[data-document-field]").forEach(input=>input.addEventListener("input",()=>{
    const key=input.dataset.documentField;data[key]=input.type==="number"?(input.value===""?null:Number(input.value)):input.value;changed();
  }));
  $("lock").addEventListener("click",()=>lock());
  window.addEventListener("beforeunload",event=>{if(dirty){event.preventDefault();event.returnValue="";}});
  window.addEventListener("pagehide",()=>{setupToken="";clear();fetch("/asset-status/lock",{method:"POST",headers:{"X-Asset-Request":"1"},keepalive:true}).catch(()=>{});});
  window.addEventListener("pageshow",event=>{if(event.persisted){clear();message("비밀번호를 다시 입력해 주세요.");}});
})();
