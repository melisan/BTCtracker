"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const groups = {total:"전체자산",bonds:"이전대상채권",movement:"자금이동대상"};
  const fields = ["category","name","description","account","amount","interest","notes","maturity"];
  const labels = ["항목","이름","내용","계좌번호","원본총액 (원)","이자 (원)","내용(비고)","만기일"];
  let data = null, token = "", dirty = false, saving = false, timer = null, deadline = 0, generation = 0;
  const money = n => new Intl.NumberFormat("ko-KR",{maximumFractionDigits:2}).format(n)+"원";
  const yearNow = () => Number(new Intl.DateTimeFormat("en",{timeZone:"Asia/Seoul",year:"numeric"}).format(new Date()));
  const sum = (rows,field="amount") => rows.reduce((n,r) => n+(r[field] ?? 0),0);
  function message(text,error=false) { $("message").textContent=text; $("message").classList.toggle("error",error); }
  function changed() { dirty=true; totals(); message("수정한 내용이 있습니다. 변경사항을 저장해 주세요."); }
  async function api(path,method="GET",body) {
    const response=await fetch(`/asset-status/${path}`,{method,credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json","X-Asset-Request":"1","X-Asset-Token":token},
      body:body===undefined?undefined:JSON.stringify(body)});
    const result=await response.json();
    if(!response.ok) throw new Error(result.error || "요청을 완료하지 못했습니다.");
    return result;
  }
  function clear() {
    generation++; data=null; token=""; dirty=false; clearInterval(timer); timer=null;
    document.querySelectorAll(".sensitive-table").forEach(el=>el.replaceChildren());
    document.querySelectorAll("[data-sensitive]").forEach(el=>el.textContent="");
    document.querySelectorAll("[data-document-field]").forEach(el=>el.value="");
    $("updated").textContent=""; $("password").value="";
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
    $("overall-total").textContent=money(sum(total)+sum(data.other_assets||[]));
    $("total").textContent=money(sum(deposits)); $("interest-total").textContent=money(sum(deposits,"interest"));
    const year=yearNow(); $("year-label").textContent=`${year}년 만기 (전체자산·채권)`;
    $("due-total").textContent=`${data.accounts.filter(r=>r.group!=="movement" && r.maturity && Number(r.maturity.slice(0,4))===year).length}건`;
    let available=0;
    ["bonds","movement"].forEach(group=>{
      const rows=data.accounts.filter(r=>r.group===group), principal=sum(rows), interest=sum(rows,"interest");
      $(`${group}-principal`).textContent=money(principal);
      if(group==="bonds") {
        $("bonds-interest").textContent=money(interest);$("bonds-combined").textContent=money(principal+interest);
        available=principal+interest;
        document.querySelectorAll("[data-bond-year-total]").forEach(el=>{
          const subset=rows.filter(r=>r.year===Number(el.dataset.bondYearTotal));
          el.textContent=`원본총액 ${money(sum(subset))} · 이자 ${money(sum(subset,"interest"))}`;
        });
      }
    });
    const needed=sum(data.future);
    $("future-total").textContent=money(needed); $("future-available").textContent=money(available);
    $("future-balance").textContent=money(available-needed); $("expenses-total").textContent=money(sum(data.expenses));
    data.accounts.forEach(row=>{
      const tr=document.getElementById(`asset-row-${row.id}`); if(!tr) return;
      const due=!!row.maturity && Number(row.maturity.slice(0,4))===year;
      tr.classList.toggle("due",due); const mark=tr.querySelector(".due-mark");if(mark)mark.hidden=!due;
    });
  }
  function makeInput(row,field,label,options=null) {
    const numeric=["amount","interest","year"].includes(field);
    const input=document.createElement(options?"select":["description","notes"].includes(field)?"textarea":"input");
    input.setAttribute("aria-label",label); input.autocomplete="off"; input.spellcheck=false;
    if(options) options.forEach(value=>{const option=document.createElement("option");option.value=value;option.textContent=field==="year"?`${value}년`:value;input.append(option);});
    else if(input.tagName==="TEXTAREA") input.rows=2;
    else {input.type=field==="maturity"?"date":numeric?"number":"text";if(numeric) input.step="any";}
    input.value=row[field]??"";
    if(field==="name") applyNameColor(input,input.value);
    input.addEventListener("input",()=>{
      row[field]=numeric?(input.value===""?null:Number(input.value)):input.value;
      if(field==="name") applyNameColor(input,input.value);
      changed(); if(field==="year") render();
    });
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
    const hasYear=group==="bonds", fs=hasYear?["year",...fields]:fields;
    const {wrap,body}=buildTable(hasYear?["연도",...labels]:labels);
    const years=[...new Set([2025,2026,yearNow(),yearNow()+1,...data.accounts.filter(r=>r.group==="bonds").map(r=>r.year)])].sort();
    rows.forEach((row,index)=>{
      const tr=document.createElement("tr");tr.id=`asset-row-${row.id}`;
      fs.forEach(field=>{
        const td=document.createElement("td"),name=field==="year"?"연도":labels[fields.indexOf(field)].replace(" (원)","");
        const options=field==="year"?years:field==="category" && group==="total"?["예적금","코인","주식","금"]:null;
        td.append(makeInput(row,field,`${prefix} ${index+1}행 ${name}`,options));
        if(field==="maturity"){const mark=document.createElement("span");mark.className="due-mark";mark.textContent="올해 만기";td.append(mark);}
        tr.append(td);
      });body.append(tr);
    });
    if(!rows.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=fs.length;td.textContent="등록된 항목이 없습니다. 항목을 추가해 주세요.";tr.append(td);body.append(tr);}
    return wrap;
  }
  function addAccount(group,year=null) {
    if(!data || saving)return;
    data.accounts.push({id:crypto.randomUUID(),group,year:group==="bonds"?(year??yearNow()):null,in_total:group==="total",category:"예적금",name:"",description:"",account:"",amount:null,interest:null,notes:"",maturity:""});
    dirty=true;render();message("새 항목을 입력한 뒤 저장해 주세요.");
  }
  function render() {
    ["total"].forEach(group=>{
      const target=$(`${group}-accounts`);target.replaceChildren(accountTable(group,data.accounts.filter(r=>r.group===group),groups[group]));
    });
    const bonds=$("bonds-accounts");bonds.replaceChildren();
    const years=[...new Set([2025,2026,...data.accounts.filter(r=>r.group==="bonds").map(r=>r.year)])].sort();
    years.forEach(year=>{
      const section=document.createElement("section"),heading=document.createElement("div"),title=document.createElement("h3"),button=document.createElement("button"),subtotal=document.createElement("p");
      heading.className="heading";title.textContent=`${year}년`;button.className="secondary";button.textContent=`${year}년 항목 추가`;
      button.addEventListener("click",()=>addAccount("bonds",year));heading.append(title,button);subtotal.className="hint";subtotal.dataset.bondYearTotal=year;
      section.append(heading,subtotal,accountTable("bonds",data.accounts.filter(r=>r.group==="bonds" && r.year===year),`이전대상채권 ${year}년`));bonds.append(section);
    });
    ["movement","future","expenses"].forEach(collection=>{
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
    document.querySelectorAll("[data-document-field]").forEach(input=>input.value=data[input.dataset.documentField]??"");
    $("updated").textContent=data.updated_at?`최근 저장 ${new Date(data.updated_at).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}`:"아직 등록된 내용이 없습니다.";
    totals();
  }
  $("unlock-form").addEventListener("submit",async event=>{
    event.preventDefault();const button=event.currentTarget.querySelector("button");button.disabled=true;const current=++generation;
    try{
      const auth=await api("unlock","POST",{password:$("password").value});$("password").value="";if(current!==generation)return;
      token=auth.token;const result=await api("records");if(current!==generation)return;
      data=result.document||{accounts:[],other_assets:[],future:[],expenses:[],other:"",total_scope:"c1",name_colors:{}};
      $("locked").hidden=true;$("workspace").hidden=false;render();message("");deadline=Date.now()+auth.expires_in*1000;
      const tick=()=>{const left=Math.max(0,Math.floor((deadline-Date.now())/1000));$("remaining").textContent=`${Math.floor(left/60)}분 ${left%60}초`;if(!left)lock(true);else totals();};tick();timer=setInterval(tick,1000);
    }catch(error){if(current===generation)message(error.message,true);}finally{$("password").value="";button.disabled=false;}
  });
  $("save").addEventListener("click",async()=>{
    if(saving||!data)return;
    if(![...$("workspace").querySelectorAll("input,select,textarea")].every(input=>input.reportValidity()))return;
    saving=true;const current=generation;
    $("workspace").querySelectorAll("input,select,textarea,button:not(#lock)").forEach(input=>input.disabled=true);
    try{const result=await api("records",data.revision?"PUT":"POST",data);if(current!==generation)return;data=result.document;dirty=false;render();message("저장했습니다.");}
    catch(error){if(current===generation)message(error.message,true);}
    finally{saving=false;$("workspace").querySelectorAll("input,select,textarea,button").forEach(input=>input.disabled=false);}
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
  window.addEventListener("pagehide",()=>{clear();fetch("/asset-status/lock",{method:"POST",headers:{"X-Asset-Request":"1"},keepalive:true}).catch(()=>{});});
  window.addEventListener("pageshow",event=>{if(event.persisted){clear();message("비밀번호를 다시 입력해 주세요.");}});
})();
