import{r as p,av as H,j as e,ah as J,bn as G,U as K,A as Q,g as W,x as Y}from"./index-DTENpw-5.js";import{Q as Z}from"./AdminApp-BtZG2kal.js";const C=[{key:"id",label:"ID (ClickUp task id)"},{key:"business",label:"Business name",required:!0},{key:"owner",label:"Owner"},{key:"phone",label:"Phone"},{key:"email",label:"Email"},{key:"instagram",label:"Instagram"},{key:"facebook",label:"Facebook"},{key:"website",label:"Website"},{key:"google",label:"Google"},{key:"area",label:"Area"},{key:"industry",label:"Industry"},{key:"priority",label:"Priority"},{key:"status",label:"Status"},{key:"service_interest",label:"Service interest"},{key:"angle",label:"Angle"},{key:"notes",label:"Notes"}],ee={taskid:"id",clickupid:"id",leadid:"id",company:"business",businessname:"business",name:"business",ownername:"owner",contact:"owner",contactname:"owner",phonenumber:"phone",tel:"phone",mobile:"phone",emailaddress:"email",ig:"instagram",insta:"instagram",fb:"facebook",site:"website",url:"website",web:"website",googlemaps:"google",maps:"google",gmb:"google",googlebusiness:"google",location:"area",city:"area",region:"area",category:"industry",trade:"industry",niche:"industry",serviceinterest:"service_interest",service:"service_interest",interest:"service_interest",note:"notes",comments:"notes"},O=i=>String(i??"").replace(/^﻿/,"").trim().toLowerCase().replace(/[^a-z0-9]/g,"");function te(i){const c=i.map(O),l=new Map(C.map(r=>[O(r.key),r.key])),a={};return c.forEach((r,o)=>{const d=l.get(r)||ee[r];d&&!(d in a)&&(a[d]=o)}),a}function se(i,c){return i.map(l=>{const a={};for(const r of C){const o=c[r.key];a[r.key]=o!=null&&o>=0?String(l[o]??"").trim():""}return a}).filter(l=>Object.values(l).some(a=>a!==""))}const S=i=>Z(i),B=i=>String(i??"").trim().toLowerCase();function re(i,c){if(i.id){const r=c.find(o=>o.sourceId&&String(o.sourceId)===String(i.id).trim());if(r)return r}const l=B(i.business),a=S(i.phone);return l&&c.find(r=>B(r.business)===l&&(!a||!S(r.phone)||S(r.phone)===a))||null}function ae(i,c){let l=0,a=0,r=0,o=0;for(const d of i){if(!d.business){o++;continue}const b=re(d,c);b?b.deleted?r++:a++:l++}return{total:i.length,create:l,update:a,deleted:r,invalid:o}}const F="vz_import_mapping";function ie(i,c){try{const l=JSON.parse(localStorage.getItem(F)||"{}"),a={...c};for(const[r,o]of Object.entries(l)){const d=i.findIndex(b=>b===o);d>=0&&(a[r]=d)}return a}catch{return c}}function ce({existingLeads:i,onClose:c,onImported:l}){const[a,r]=p.useState("pick"),[o,d]=p.useState(""),[b,M]=p.useState([]),[k,D]=p.useState([]),[h,E]=p.useState({}),[f,z]=p.useState(""),[y,j]=p.useState(!1),[_,g]=p.useState(""),[v,I]=p.useState(null),P=p.useCallback((t,s)=>{if(!t.length){g("No header row found in the file.");return}M(t),D(s),E(ie(t,te(t))),g(""),r("map")},[]),w=p.useCallback(async(t,s,n)=>{j(!0),g("");try{const x=await H(()=>import("./xlsx-CkFp8p6R.js"),[]),m=x.read(t,s==="binary"?{type:"array"}:{type:"string"}),A=m.Sheets[m.SheetNames[0]];if(!A)throw new Error("The file has no sheets.");const L=x.utils.sheet_to_json(A,{header:1,blankrows:!1,defval:""}),q=(L[0]||[]).map(X=>String(X??"").replace(/^﻿/,"").trim());d(n||"pasted data"),P(q,L.slice(1))}catch(x){g(`Couldn't read that file: ${x.message||"unknown error"}`)}finally{j(!1)}},[P]),T=async t=>{var x;const s=(x=t.target.files)==null?void 0:x[0];if(!s)return;/\.(xlsx|xls)$/i.test(s.name)||/sheet|excel/i.test(s.type)?w(await s.arrayBuffer().then(m=>new Uint8Array(m)),"binary",s.name):w(await s.text(),"text",s.name)},U=()=>{if(!f.trim()){g("Paste some CSV first.");return}w(f,"text","pasted CSV")},N=a==="map"?se(k,h):[],u=a==="map"?ae(N,i):null,R=N.slice(0,10),V=(t,s)=>E(n=>({...n,[t]:s})),$=async()=>{var t;j(!0),g("");try{const s={};for(const[x,m]of Object.entries(h))m>=0&&b[m]&&(s[x]=b[m]);try{localStorage.setItem(F,JSON.stringify(s))}catch{}const n=await Y("/api/admin/leads/import",{method:"POST",body:{rows:N}});if(!n.ok)throw new Error(n.offline?"you are offline":((t=n.data)==null?void 0:t.error)||`HTTP ${n.status}`);I(n.data),r("result"),l==null||l()}catch(s){g(`Import failed: ${s.message}`)}finally{j(!1)}};return e.jsxs(J,{open:!0,onClose:c,title:"Upload spreadsheet",tall:!0,width:720,className:"li-sheet",children:[e.jsxs("div",{className:"li-panel",children:[_&&e.jsxs("div",{className:"li-error",children:[e.jsx(G,{width:15,height:15})," ",_]}),a==="pick"&&e.jsxs("div",{className:"li-body",children:[e.jsxs("label",{className:"li-drop",children:[e.jsx(K,{width:26,height:26}),e.jsx("span",{className:"li-drop-title",children:"Choose a .csv or .xlsx file"}),e.jsx("span",{className:"li-drop-sub",children:"Exported from Google Sheets or Excel"}),e.jsx("input",{type:"file",accept:".csv,.xlsx,.xls,text/csv",onChange:T,className:"li-fileinput"})]}),e.jsx("div",{className:"li-or",children:e.jsx("span",{children:"or paste CSV"})}),e.jsx("textarea",{className:"li-paste",rows:5,value:f,onChange:t=>z(t.target.value),placeholder:`business,phone,instagram
Joe Plumbing,(302) 555-1212,@joeplumb`}),e.jsx("button",{type:"button",className:"li-btn",onClick:U,disabled:y||!f.trim(),children:y?"Reading…":"Read pasted CSV"})]}),a==="map"&&e.jsxs("div",{className:"li-body",children:[e.jsxs("p",{className:"li-file",children:[o," · ",k.length," data row",k.length!==1?"s":""]}),e.jsxs("div",{className:"li-counts",children:[e.jsxs("span",{className:"li-count",children:[e.jsx("b",{children:u.total})," total"]}),e.jsxs("span",{className:"li-count li-count--new",children:[e.jsx("b",{children:u.create})," new"]}),e.jsxs("span",{className:"li-count li-count--upd",children:[e.jsx("b",{children:u.update})," update existing"]}),u.deleted>0&&e.jsxs("span",{className:"li-count li-count--del",children:[e.jsx("b",{children:u.deleted})," skip (deleted)"]}),u.invalid>0&&e.jsxs("span",{className:"li-count li-count--del",children:[e.jsx("b",{children:u.invalid})," skip (no name)"]})]}),e.jsx("p",{className:"li-seclabel",children:"Column mapping"}),e.jsx("div",{className:"li-maps",children:C.map(t=>e.jsxs("label",{className:"li-maprow",children:[e.jsxs("span",{className:"li-mapfield",children:[t.label,t.required&&e.jsx("i",{className:"li-req",children:"*"})]}),e.jsxs("select",{className:"li-select",value:h[t.key]??-1,onChange:s=>V(t.key,Number(s.target.value)),children:[e.jsx("option",{value:-1,children:"none"}),b.map((s,n)=>e.jsx("option",{value:n,children:s||`Column ${n+1}`},n))]})]},t.key))}),e.jsxs("p",{className:"li-seclabel",children:["Preview (first ",R.length,")"]}),e.jsx("div",{className:"li-tablewrap",children:e.jsxs("table",{className:"li-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Business"}),e.jsx("th",{children:"Phone"}),e.jsx("th",{children:"Priority"}),e.jsx("th",{children:"Status"}),e.jsx("th",{children:"Socials"})]})}),e.jsx("tbody",{children:R.map((t,s)=>e.jsxs("tr",{className:t.business?"":"li-tr-bad",children:[e.jsx("td",{children:t.business||e.jsx("span",{className:"li-bad",children:"missing"})}),e.jsx("td",{children:t.phone||"none"}),e.jsx("td",{children:t.priority||"warm"}),e.jsx("td",{children:t.status||"not called"}),e.jsx("td",{children:["instagram","facebook","website","google"].filter(n=>t[n]).length||"none"})]},s))})]})}),e.jsxs("div",{className:"li-actions",children:[e.jsx("button",{type:"button",className:"li-btn",onClick:()=>r("pick"),children:"Back"}),e.jsx("button",{type:"button",className:"li-btn li-btn--primary",onClick:$,disabled:y||h.business==null||h.business<0,children:y?"Importing…":e.jsxs(e.Fragment,{children:["Import ",u.total-u.invalid-u.deleted," leads ",e.jsx(Q,{width:15,height:15})]})})]}),(h.business==null||h.business<0)&&e.jsxs("p",{className:"li-hint",children:["Map the ",e.jsx("b",{children:"Business name"})," column to continue."]})]}),a==="result"&&v&&e.jsxs("div",{className:"li-body",children:[e.jsx("div",{className:"li-done",children:e.jsx(W,{width:28,height:28})}),e.jsxs("div",{className:"li-result",children:[e.jsxs("span",{className:"li-count li-count--new",children:[e.jsx("b",{children:v.created})," created"]}),e.jsxs("span",{className:"li-count li-count--upd",children:[e.jsx("b",{children:v.updated})," updated"]}),e.jsxs("span",{className:"li-count li-count--del",children:[e.jsx("b",{children:v.skipped.length})," skipped"]})]}),v.skipped.length>0&&e.jsxs("div",{className:"li-skips",children:[e.jsx("p",{className:"li-seclabel",children:"Skipped"}),v.skipped.slice(0,50).map((t,s)=>e.jsxs("p",{className:"li-skip",children:[e.jsx("b",{children:t.business}),": ",t.reason]},s))]}),e.jsxs("div",{className:"li-actions",children:[e.jsx("button",{type:"button",className:"li-btn",onClick:()=>{r("pick"),I(null),z("")},children:"Import another"}),e.jsx("button",{type:"button",className:"li-btn li-btn--primary",onClick:c,children:"Done"})]})]})]}),e.jsx("style",{children:le})]})}const le=`
  .li-panel { min-width: 0; display: flex; flex-direction: column; }
  .li-body { padding: 0; display: flex; flex-direction: column; gap: 16px; }

  .li-error {
    display: flex; align-items: center; gap: 8px; margin: 0 0 12px;
    padding: 10px 14px; border-radius: 10px; font-size: 0.83rem; font-weight: 600;
    color: var(--v-status-danger-text); background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
  }

  .li-drop {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 34px 20px; border-radius: 14px; cursor: pointer; text-align: center;
    border: 1.5px dashed var(--v-border-strong); background: var(--v-surface-1);
    color: var(--v-text-2); transition: border-color 0.15s, background 0.15s;
  }
  .li-drop:hover { border-color: rgba(212,76,67,0.55); background: rgba(212,76,67,0.06); }
  .li-drop svg { color: var(--v-red); }
  .li-drop-title { font-size: 0.95rem; font-weight: 700; color: var(--v-text); }
  .li-drop-sub { font-size: 0.78rem; color: var(--v-text-3); }
  .li-fileinput { display: none; }
  .li-or { display: flex; align-items: center; gap: 12px; color: var(--v-text-3); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
  .li-or::before, .li-or::after { content: ''; flex: 1; height: 1px; background: var(--v-border); }
  .li-paste {
    width: 100%; border-radius: 10px; padding: 12px 14px; resize: vertical; min-height: 90px;
    background: var(--v-surface-2); border: 1px solid var(--v-border-strong);
    color: var(--v-text); font-family: monospace; font-size: 0.8rem; outline: none;
  }
  .li-paste:focus { border-color: var(--v-red); }

  .li-file { font-size: 0.8rem; color: var(--v-text-3); }
  .li-counts, .li-result { display: flex; gap: 8px; flex-wrap: wrap; }
  .li-count {
    font-size: 0.78rem; color: var(--v-text-2); padding: 6px 12px; border-radius: 999px;
    background: var(--v-surface-2); border: 1px solid var(--v-border-strong);
  }
  .li-count b { color: var(--v-text); }
  .li-count--new { color: var(--v-status-booked-text); border-color: rgba(34,197,94,0.35); background: rgba(34,197,94,0.08); }
  .li-count--new b { color: var(--v-status-booked-text); }
  .li-count--upd { color: var(--v-status-progress-text); border-color: rgba(96,165,250,0.35); background: rgba(96,165,250,0.08); }
  .li-count--upd b { color: var(--v-status-progress-text); }
  .li-count--del { color: var(--v-status-danger-text); border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.07); }
  .li-count--del b { color: var(--v-status-danger-text); }

  .li-seclabel { font-size: 0.66rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.14em; color: var(--v-text-3); }
  .li-maps { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  @media (max-width: 560px) { .li-maps { grid-template-columns: 1fr; } }
  .li-maprow { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
  .li-mapfield { font-size: 0.8rem; color: var(--v-text-2); flex-shrink: 0; }
  .li-req { color: var(--v-red); font-style: normal; margin-left: 2px; }
  .li-select {
    flex: 1; min-width: 0; max-width: 58%; padding: 7px 10px; border-radius: 8px;
    background: var(--v-surface-2); border: 1px solid var(--v-border-strong);
    color: var(--v-text); font-family: inherit; font-size: 0.78rem; outline: none; cursor: pointer;
  }
  .li-select:focus { border-color: var(--v-red); }
  .li-select option { background: var(--v-surface-2); }

  .li-tablewrap { overflow-x: auto; border: 1px solid var(--v-border); border-radius: 10px; }
  .li-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
  .li-table th { text-align: left; padding: 8px 12px; color: var(--v-text-3); font-weight: 700; border-bottom: 1px solid var(--v-border); white-space: nowrap; }
  .li-table td { padding: 8px 12px; color: var(--v-text-2); border-bottom: 1px solid var(--v-surface-2); white-space: nowrap; }
  .li-table tr:last-child td { border-bottom: none; }
  .li-tr-bad { background: rgba(239,68,68,0.06); }
  .li-bad { color: var(--v-status-danger-text); }

  .li-actions { display: flex; gap: 10px; justify-content: flex-end; }
  .li-btn { min-height: var(--v-tap);
    display: inline-flex; align-items: center; gap: 7px;
    padding: 10px 16px; border-radius: 10px; cursor: pointer;
    border: 1px solid var(--v-border-strong); background: var(--v-surface-2);
    color: var(--v-text-2); font-size: 0.83rem; font-weight: 700; font-family: inherit;
    transition: background 0.15s, color 0.15s;
  }
  .li-btn:hover { background: var(--v-border-strong); color: var(--v-text); }
  .li-btn--primary { background: var(--v-red); border-color: var(--v-red); color: var(--v-text-on-red); }
  .li-btn--primary:hover { background: var(--v-red-hover); color: var(--v-text-on-red); }
  .li-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .li-hint { font-size: 0.76rem; color: var(--v-status-new-text); text-align: right; }

  .li-done {
    width: 56px; height: 56px; border-radius: 50%; margin: 6px auto 0;
    display: flex; align-items: center; justify-content: center;
    color: var(--v-status-booked-text); background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.35);
  }
  .li-result { justify-content: center; }
  .li-skips { display: flex; flex-direction: column; gap: 5px; max-height: 200px; overflow-y: auto; }
  .li-skip { font-size: 0.8rem; color: var(--v-text-3); }
  .li-skip b { color: var(--v-text-2); }
`;export{ce as L};
