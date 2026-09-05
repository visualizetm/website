import{j as e,_ as I,r as m,W as E,A as C,i as L,L as $,n as B,G as P,e as D,k as F,p as H,g as A}from"./index-B9Tcr1Fm.js";import{A as O}from"./ArrowLeft-BpBtEC7T.js";import{C as M}from"./CreditCard02-Bxbi57nD.js";import{L as Y}from"./LayersTwo01-CGLkxvIb.js";var _=function(i){return e.jsx("svg",I({xmlns:"http://www.w3.org/2000/svg",width:24,height:24,fill:"none",viewBox:"0 0 24 24"},i,{children:e.jsx("path",{stroke:"currentColor",strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"m18 13-1.2996-6.4982c-.0726-.363-.1089-.5445-.1972-.6923a1 1 0 0 0-.3124-.3249c-.1442-.094-.3241-.1375-.6839-.2243L2 2m0 0 3.2603 13.5069c.0868.3598.1303.5397.2243.6839a1 1 0 0 0 .325.3124c.1477.0883.3292.1246.6922.1972L13 18M2 2l7.586 7.586m6.5454 11.2826 4.7372-4.7372c.396-.396.5941-.5941.6682-.8224a1 1 0 0 0 0-.618c-.0741-.2283-.2722-.4264-.6682-.8224l-.7372-.7372c-.396-.396-.5941-.5941-.8224-.6682a1 1 0 0 0-.618 0c-.2283.0741-.4264.2722-.8224.6682l-4.7372 4.7372c-.396.396-.5941.5941-.6682.8224a1 1 0 0 0 0 .618c.0741.2283.2722.4264.6682.8224l.7372.7372c.396.396.5941.5941.8224.6682a1 1 0 0 0 .618 0c.2283-.0741.4264-.2722.8224-.6682M13 11c0 1.1046-.8954 2-2 2s-2-.8954-2-2 .8954-2 2-2 2 .8954 2 2"})}))},T=function(i){return e.jsx("svg",I({xmlns:"http://www.w3.org/2000/svg",width:24,height:24,fill:"none",viewBox:"0 0 24 24"},i,{children:e.jsx("path",{stroke:"currentColor",strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M15 16.5V19c0 .9319 0 1.3978-.1522 1.7654-.203.49-.5924.8794-1.0824 1.0824C13.3978 22 12.9319 22 12 22s-1.3978 0-1.7654-.1522a2 2 0 0 1-1.0824-1.0824C9 20.3978 9 19.9319 9 19v-2.5m6 0c2.6489-1.1573 4.5-3.9245 4.5-7C19.5 5.3579 16.1421 2 12 2S4.5 5.3579 4.5 9.5c0 3.0755 1.8511 5.8427 4.5 7m6 0H9"})}))};const G="",J={projectType:"",fullName:"",businessName:"",businessDesc:"",industry:"",location:"",timeInBusiness:"",servicesNeeded:[],whyNow:"",pagesNeeded:[],brandFeel:[],colorPrefs:"",brandsAdmired:"",idealCustomer:"",competitors:"",assetsHave:[],existingLinks:"",photosReady:"",email:"",phone:"",bestContact:"",timeline:"",budget:"",additionalInfo:""},V=[{v:"Logo Design",icon:_,desc:"A professional logo built for your brand"},{v:"Full Brand Identity",icon:B,desc:"Logo + colors + typography + brand guidelines"},{v:"Website Design & Development",icon:P,desc:"A custom site built and launched"},{v:"Google Business Setup",icon:D,desc:"Claimed, optimized, ready to rank locally"},{v:"Business Cards",icon:M,desc:"Design and/or printing"},{v:"Custom Stickers / Vinyl",icon:F,desc:"Die-cut stickers, window vinyl, handle stickers"},{v:"Not sure, I need advice",icon:T,desc:"Help me figure out where to start"}],K=[{v:"Brand",icon:B,desc:"Logo, identity, and brand systems"},{v:"Website",icon:P,desc:"A site that turns visitors into customers"},{v:"Both",icon:Y,desc:"Brand and website, built together"},{v:"Other",icon:T,desc:"Print, bulk products, or something else"}],v=[{id:"type",title:"What are we building?",sub:"This routes your brief to the right process."},{id:"business",title:"Your Business",sub:"Tell us who you are and what you do."},{id:"scope",title:"Project Scope",sub:"What are you building or improving?"},{id:"direction",title:"Brand Direction",sub:"Your visual identity and who you're speaking to."},{id:"assets",title:"What You Already Have",sub:"We'll work with what exists and fill in the gaps."},{id:"contact",title:"Contact & Timeline",sub:"How to reach you and when you need this done."}];function n({label:s,required:i,desc:r,error:l,id:d,children:u}){return e.jsxs("div",{className:`st-field${l?" st-field--err":""}`,id:d,children:[s&&e.jsxs("p",{className:"st-label",children:[s,i&&e.jsx("span",{className:"st-req","aria-label":"required",children:"*"})]}),r&&e.jsx("p",{className:"st-desc",children:r}),u,l&&e.jsx("p",{className:"st-err-msg",role:"alert",children:l})]})}function y({name:s,value:i,onChange:r,opts:l}){return e.jsx("div",{className:"st-radio-group",role:"radiogroup",children:l.map(d=>e.jsxs("label",{className:`st-radio${i===d.v?" is-sel":""}`,children:[e.jsx("input",{type:"radio",name:s,value:d.v,checked:i===d.v,onChange:()=>r(d.v)}),e.jsx("span",{className:"st-radio-dot"}),e.jsx("span",{className:"st-radio-txt",children:d.label}),d.note&&e.jsx("span",{className:"st-radio-note",children:d.note})]},d.v))})}function S({value:s,onChange:i,opts:r,multi:l=!1,max:d,name:u="st-icards"}){const a=c=>l?s.includes(c):s===c,p=c=>{if(!l)return i(c);if(s.includes(c))return i(s.filter(g=>g!==c));d!=null&&s.length>=d||i([...s,c])};return e.jsx("div",{className:"st-cards",children:r.map(c=>{const g=c.icon,b=a(c.v);return e.jsxs("label",{className:`st-icard${b?" is-sel":""}`,children:[e.jsx("input",{type:l?"checkbox":"radio",checked:b,onChange:()=>p(c.v),name:l?void 0:u}),e.jsx("span",{className:"st-icard-icon","aria-hidden":"true",children:e.jsx(g,{width:20,height:20})}),e.jsxs("span",{className:"st-icard-body",children:[e.jsx("span",{className:"st-icard-lbl",children:c.v}),c.desc&&e.jsx("span",{className:"st-icard-desc",children:c.desc})]}),e.jsx("span",{className:"st-icard-mark","aria-hidden":"true",children:b&&e.jsx(A,{width:13,height:13})})]},c.v)})})}function w({value:s,onChange:i,opts:r,max:l,layout:d="stack"}){const u=a=>{if(s.includes(a))return i(s.filter(p=>p!==a));l!=null&&s.length>=l||i([...s,a])};return e.jsx("div",{className:`st-checks st-checks--${d}`,children:r.map(a=>{const p=s.includes(a.v),c=!p&&l!=null&&s.length>=l;return e.jsxs("label",{className:`st-check${p?" is-sel":""}${c?" is-dis":""}`,children:[e.jsx("input",{type:"checkbox",checked:p,onChange:()=>u(a.v),disabled:c}),e.jsx("span",{className:"st-check-box",children:p&&e.jsx(A,{width:10,height:10})}),e.jsxs("span",{className:"st-check-body",children:[e.jsx("span",{className:"st-check-lbl",children:a.label}),a.desc&&e.jsx("span",{className:"st-check-desc",children:a.desc})]})]},a.v)})})}function U(s,i){const r={};return s==="type"&&(i.projectType||(r.projectType="Pick one to continue")),s==="business"&&(i.fullName.trim()||(r.fullName="Required"),i.businessName.trim()||(r.businessName="Required"),i.businessDesc.trim()||(r.businessDesc="Required"),i.industry||(r.industry="Select an industry"),i.location.trim()||(r.location="Required"),i.timeInBusiness||(r.timeInBusiness="Select one")),s==="scope"&&(i.servicesNeeded.length||(r.servicesNeeded="Select at least one"),i.whyNow.trim()||(r.whyNow="Required")),s==="direction"&&(i.brandFeel.length||(r.brandFeel="Select at least one feeling"),i.brandsAdmired.trim()||(r.brandsAdmired="Required"),i.idealCustomer.trim()||(r.idealCustomer="Required")),s==="assets"&&(i.assetsHave.length||(r.assetsHave="Select at least one"),i.photosReady||(r.photosReady="Select one")),s==="contact"&&((!i.email.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email))&&(r.email="Valid email required"),i.bestContact||(r.bestContact="Select one"),i.timeline||(r.timeline="Select one"),i.budget||(r.budget="Select one")),r}function se(){const[s,i]=m.useState(J),[r,l]=m.useState("intro"),[d,u]=m.useState("fwd"),[a,p]=m.useState({}),[c,g]=m.useState(!1),b=m.useRef(null);m.useEffect(()=>{document.title="Start a Project, Visualize"},[]),m.useEffect(()=>{typeof r=="number"&&b.current&&(b.current.focus(),window.scrollTo({top:0,behavior:"auto"}))},[r]);const o=(t,x)=>{i(f=>({...f,[t]:x})),a[t]&&p(f=>({...f,[t]:""}))},k=()=>{var x;const t=U(v[r].id,s);if(Object.keys(t).length){p(t);const f=Object.keys(t)[0];return(x=document.getElementById(`f-${f}`))==null||x.scrollIntoView({behavior:"smooth",block:"center"}),!1}return p({}),!0},W=()=>{k()&&(u("fwd"),l(r+1))},q=()=>{p({}),u("back"),l(r===0?"intro":r-1)},z=async()=>{if(!k())return;g(!0);const t={"Project Type":s.projectType,"Full Name":s.fullName,"Business Name":s.businessName,"Business Description":s.businessDesc,Industry:s.industry,Location:s.location,"Time in Business":s.timeInBusiness,"Services Needed":s.servicesNeeded.join(", "),"Why Now":s.whyNow,"Website Pages":s.pagesNeeded.length?s.pagesNeeded.join(", "):", ","Brand Feel":s.brandFeel.join(", "),"Color Preferences":s.colorPrefs||"n/a","Brands Admired":s.brandsAdmired,"Ideal Customer":s.idealCustomer,Competitors:s.competitors||"n/a","Current Assets":s.assetsHave.join(", "),"Existing Links":s.existingLinks||"n/a","Photos Ready":s.photosReady,Phone:s.phone||"n/a","Best Contact":s.bestContact,Timeline:s.timeline,Budget:s.budget,"Additional Info":s.additionalInfo||"n/a"};try{if(!(await fetch("/api/submissions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"start",projectType:s.projectType,name:s.fullName,business:s.businessName,email:s.email,phone:s.phone,fields:t})})).ok)throw new Error("api");l("done")}catch{try{if(!(await(await fetch("https://api.web3forms.com/submit",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({access_key:G,subject:`New ${s.projectType} Project Brief, ${s.fullName} / ${s.businessName}`,from_name:s.fullName,email:s.email,...t})})).json()).success)throw new Error("backup");l("done")}catch{p({_submit:"Something went wrong. Email us directly at contact@visualizeclients.com."})}}finally{g(!1)}};if(r==="intro")return e.jsxs("div",{className:"st-shell",children:[e.jsx("section",{className:"st-intro grid-texture",children:e.jsxs("div",{className:"st-intro-inner",children:[e.jsx(E,{size:18,className:"st-intro-mark"}),e.jsxs("h1",{className:"st-intro-title display",children:["Let's build",e.jsx("br",{}),"something",e.jsx("br",{}),e.jsx("span",{className:"st-intro-red",children:"you're proud of."})]}),e.jsx("p",{className:"st-intro-sub",children:"Six short steps, about 10 minutes. The more detail you give, the faster we can move."}),e.jsxs("button",{type:"button",className:"btn btn-primary st-begin-btn",onClick:()=>{u("fwd"),l(0)},children:["Begin Form ",e.jsx(C,{width:17,height:17})]})]})}),e.jsx("style",{children:j})]});if(r==="done")return e.jsxs("div",{className:"st-shell",children:[e.jsx("section",{className:"st-success",children:e.jsxs("div",{className:"st-success-inner st-anim-fwd",children:[e.jsx("span",{className:"st-success-icon",children:e.jsx(L,{width:56,height:56})}),e.jsx("h1",{className:"st-success-title display",children:"We got it."}),e.jsx("p",{className:"st-success-body",children:"Here's exactly what happens next:"}),e.jsxs("ol",{className:"st-success-steps",children:[e.jsxs("li",{children:[e.jsx("strong",{children:"Within 24 hours"}),", Rob reads your brief and replies to ",s.email," to schedule your kickoff call."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Kickoff call"}),", 20–30 minutes to align on scope, timeline, and your quote."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Build begins"}),", a clear timeline and one point of contact the whole way."]})]}),e.jsx("p",{className:"st-success-sub",children:"Nothing else is needed from you right now."}),e.jsx($,{to:"/",className:"btn btn-secondary st-success-btn",children:"Back to Home"})]})}),e.jsx("style",{children:j})]});const h=v[r],R=(r+1)/v.length*100,N=r===v.length-1;return e.jsxs("div",{className:"st-shell",children:[e.jsxs("div",{className:"st-progress",role:"status","aria-live":"polite",children:[e.jsxs("div",{className:"wrap st-progress-inner",children:[e.jsxs("span",{className:"st-progress-label",children:["Step ",r+1," of ",v.length]}),e.jsx("span",{className:"st-progress-title",children:h.title})]}),e.jsx("div",{className:"st-progress-track",children:e.jsx("div",{className:"st-progress-fill",style:{width:`${R}%`}})})]}),e.jsx("form",{className:"wrap st-form",onSubmit:t=>{t.preventDefault(),N?z():W()},noValidate:!0,children:e.jsxs("div",{className:`st-step ${d==="fwd"?"st-anim-fwd":"st-anim-back"}`,children:[e.jsxs("header",{className:"st-step-head",children:[e.jsx("h2",{className:"st-step-title",tabIndex:-1,ref:b,children:h.title}),e.jsx("p",{className:"st-step-sub",children:h.sub})]}),h.id==="type"&&e.jsx(n,{id:"f-projectType",error:a.projectType,children:e.jsx(S,{value:s.projectType,onChange:t=>o("projectType",t),opts:K,name:"projectType"})}),h.id==="business"&&e.jsxs("div",{className:"st-fields",children:[e.jsxs("div",{className:"st-row2",children:[e.jsx(n,{label:"Full Name",required:!0,id:"f-fullName",error:a.fullName,children:e.jsx("input",{className:"st-input",type:"text",placeholder:"e.g. Carlos Mendez",value:s.fullName,onChange:t=>o("fullName",t.target.value),autoComplete:"name"})}),e.jsx(n,{label:"Business Name",required:!0,id:"f-businessName",error:a.businessName,children:e.jsx("input",{className:"st-input",type:"text",placeholder:"e.g. Sopes Detailing",value:s.businessName,onChange:t=>o("businessName",t.target.value)})})]}),e.jsx(n,{label:"What does your business do and who do you serve?",required:!0,desc:"Write it how you'd explain it at a networking event.",id:"f-businessDesc",error:a.businessDesc,children:e.jsx("textarea",{className:"st-textarea",rows:4,placeholder:"e.g. I run a mobile auto detailing service in Wilmington, DE. I serve car enthusiasts who want showroom results without going to a shop.",value:s.businessDesc,onChange:t=>o("businessDesc",t.target.value)})}),e.jsxs("div",{className:"st-row2",children:[e.jsx(n,{label:"Industry",required:!0,id:"f-industry",error:a.industry,children:e.jsxs("select",{className:"st-select",value:s.industry,onChange:t=>o("industry",t.target.value),children:[e.jsx("option",{value:"",children:"Select an industry…"}),["Food & Beverage","Health & Wellness","Automotive","Beauty & Personal Care","Home Services / Trades","Photography / Creative","Real Estate","Retail / E-commerce","Professional Services","Other"].map(t=>e.jsx("option",{value:t,children:t},t))]})}),e.jsx(n,{label:"Where are you based?",required:!0,id:"f-location",error:a.location,children:e.jsx("input",{className:"st-input",type:"text",placeholder:"e.g. Wilmington, DE",value:s.location,onChange:t=>o("location",t.target.value)})})]}),e.jsx(n,{label:"How long have you been in business?",required:!0,id:"f-timeInBusiness",error:a.timeInBusiness,children:e.jsx(y,{name:"timeInBusiness",value:s.timeInBusiness,onChange:t=>o("timeInBusiness",t),opts:[{v:"Just starting out",label:"Just starting out"},{v:"Less than 1 year",label:"Less than 1 year"},{v:"1–3 years",label:"1–3 years"},{v:"3+ years",label:"3+ years"}]})})]}),h.id==="scope"&&e.jsxs("div",{className:"st-fields",children:[e.jsx(n,{label:"What do you need?",required:!0,desc:"Select all that apply.",id:"f-servicesNeeded",error:a.servicesNeeded,children:e.jsx(S,{multi:!0,value:s.servicesNeeded,onChange:t=>o("servicesNeeded",t),opts:V})}),e.jsx(n,{label:"Why now? What's pushing you to invest in your brand?",required:!0,desc:"This helps us understand what problem we're actually solving.",id:"f-whyNow",error:a.whyNow,children:e.jsx("textarea",{className:"st-textarea",rows:4,placeholder:"e.g. I've been running off my personal Instagram for 8 months and keep losing clients to competitors who look more established.",value:s.whyNow,onChange:t=>o("whyNow",t.target.value)})}),e.jsx(n,{label:"If you need a website, what pages do you think you need?",desc:"Optional, check all that apply. Skip if no website needed.",id:"f-pagesNeeded",children:e.jsx(w,{value:s.pagesNeeded,onChange:t=>o("pagesNeeded",t),layout:"grid",opts:["Home / Landing Page","About / Our Story","Services / Menu","Portfolio / Gallery","Contact / Book Now","Online Store","Booking / Scheduling","Blog","Not sure"].map(t=>({v:t,label:t}))})})]}),h.id==="direction"&&e.jsxs("div",{className:"st-fields",children:[e.jsx(n,{label:"How do you want people to feel when they see your brand?",required:!0,desc:"Pick up to 5.",id:"f-brandFeel",error:a.brandFeel,children:e.jsx(w,{value:s.brandFeel,onChange:t=>o("brandFeel",t),layout:"pills",max:5,opts:["Trustworthy","Bold & Confident","Luxurious","Friendly & Approachable","Clean & Minimal","Energetic & Exciting","Professional & Polished","Raw & Authentic","Playful & Fun","Edgy & Streetwear","Warm & Inviting","Premium & Exclusive"].map(t=>({v:t,label:t}))})}),e.jsx(n,{label:"Color preferences? Anything you absolutely don't want?",desc:"No need for hex codes. Just tell us what you're drawn to.",id:"f-colorPrefs",children:e.jsx("textarea",{className:"st-textarea",rows:3,placeholder:"e.g. I like dark colors, black, navy. No bright or neon.",value:s.colorPrefs,onChange:t=>o("colorPrefs",t.target.value)})}),e.jsx(n,{label:"Name 1–3 brands whose look you admire and what you like about them.",required:!0,desc:"Doesn't have to be your industry. Just visual styles you respect.",id:"f-brandsAdmired",error:a.brandsAdmired,children:e.jsx("textarea",{className:"st-textarea",rows:3,placeholder:"e.g. I like how Supreme keeps it clean and minimal but feels exclusive.",value:s.brandsAdmired,onChange:t=>o("brandsAdmired",t.target.value)})}),e.jsx(n,{label:"Who is your ideal customer? Describe them like a real person.",required:!0,desc:"Age, lifestyle, how they find businesses like yours. Specific beats vague.",id:"f-idealCustomer",error:a.idealCustomer,children:e.jsx("textarea",{className:"st-textarea",rows:4,placeholder:"e.g. Guy in his late 20s to 40s who takes pride in his car, has disposable income, follows car culture on Instagram.",value:s.idealCustomer,onChange:t=>o("idealCustomer",t.target.value)})}),e.jsx(n,{label:"Who are your main competitors and what do you do better?",desc:"Optional.",id:"f-competitors",children:e.jsx("textarea",{className:"st-textarea",rows:3,placeholder:"e.g. DetailPros and CleanRide in Wilmington. They both require you to come to them. I go to the customer.",value:s.competitors,onChange:t=>o("competitors",t.target.value)})})]}),h.id==="assets"&&e.jsxs("div",{className:"st-fields",children:[e.jsx(n,{label:"What do you currently have?",required:!0,desc:"Check everything that applies.",id:"f-assetsHave",error:a.assetsHave,children:e.jsx(w,{value:s.assetsHave,onChange:t=>o("assetsHave",t),layout:"stack",opts:[{v:"A logo",label:"A logo",desc:"Even if you're not happy with it"},{v:"Brand colors or fonts",label:"Brand colors or fonts",desc:"Colors or fonts you use consistently"},{v:"An existing website",label:"An existing website",desc:"Add URL in links below"},{v:"Active social media profiles",label:"Active social media profiles"},{v:"Professional photos",label:"Professional photos",desc:"Of your work or team"},{v:"Written content",label:"Written content",desc:"Service descriptions, about us, pricing"},{v:"A domain name",label:"A domain name",desc:"Even with no site on it"},{v:"Google Business profile",label:"Google Business profile",desc:"Claimed"},{v:"None, starting from zero",label:"None, starting from zero"}]})}),e.jsx(n,{label:"Drop any relevant links",desc:"Website, Instagram, Facebook, Google listing, anything that shows what your business looks like right now.",id:"f-existingLinks",children:e.jsx("textarea",{className:"st-textarea",rows:3,placeholder:"e.g. Instagram: @sopesdetailing",value:s.existingLinks,onChange:t=>o("existingLinks",t.target.value)})}),e.jsx(n,{label:"Do you have photos ready to use?",required:!0,id:"f-photosReady",error:a.photosReady,children:e.jsx(y,{name:"photosReady",value:s.photosReady,onChange:t=>o("photosReady",t),opts:[{v:"Yes, high quality photos ready to go",label:"Yes, high quality photos ready to go"},{v:"Kind of, some but inconsistent or phone photos",label:"Kind of, some but inconsistent or phone photos"},{v:"No, I'll need to gather or take photos",label:"No, I'll need to gather or take photos during the project"},{v:"No, stock photos or illustrations preferred",label:"No, I'd prefer stock photos or illustrations"}]})})]}),h.id==="contact"&&e.jsxs("div",{className:"st-fields",children:[e.jsxs("div",{className:"st-row2",children:[e.jsx(n,{label:"Email Address",required:!0,id:"f-email",error:a.email,children:e.jsx("input",{className:"st-input",type:"email",placeholder:"e.g. carlos@sopesdetailing.com",value:s.email,onChange:t=>o("email",t.target.value),autoComplete:"email"})}),e.jsx(n,{label:"Phone Number",desc:"Text is fine. Include if you prefer it over email.",id:"f-phone",children:e.jsx("input",{className:"st-input",type:"tel",placeholder:"e.g. (302) 555-0123",value:s.phone,onChange:t=>o("phone",t.target.value),autoComplete:"tel"})})]}),e.jsx(n,{label:"Best way to reach you?",required:!0,id:"f-bestContact",error:a.bestContact,children:e.jsx(y,{name:"bestContact",value:s.bestContact,onChange:t=>o("bestContact",t),opts:[{v:"Email",label:"Email"},{v:"Text",label:"Text"},{v:"Instagram DM",label:"Instagram DM"},{v:"Phone Call",label:"Phone Call"}]})}),e.jsx(n,{label:"When do you need this completed?",required:!0,id:"f-timeline",error:a.timeline,children:e.jsx(y,{name:"timeline",value:s.timeline,onChange:t=>o("timeline",t),opts:[{v:"ASAP, within 1 week",label:"ASAP, within 1 week",note:"Rush fees may apply"},{v:"Within 2–3 weeks",label:"Within 2–3 weeks"},{v:"Within 1 month",label:"Within 1 month"},{v:"1–3 months, planning ahead",label:"1–3 months, planning ahead"},{v:"I have a specific date",label:"I have a specific date",note:"Add details below"},{v:"No rush",label:"No rush"}]})}),e.jsx(n,{label:"Budget range",required:!0,id:"f-budget",error:a.budget,children:e.jsx(y,{name:"budget",value:s.budget,onChange:t=>o("budget",t),opts:[{v:"Under $300",label:"Under $300",note:"Something specific and small"},{v:"$300–$600",label:"$300–$600",note:"Starter brand or basic website"},{v:"$600–$1,000",label:"$600–$1,000",note:"Full brand or full website"},{v:"$1,000–$2,000",label:"$1,000–$2,000",note:"Brand + website together"},{v:"$2,000+",label:"$2,000+",note:"Full package with everything"},{v:"Not sure, need to see costs first",label:"Not sure, I need to see what things cost first"}]})}),e.jsx(n,{label:"Anything else we should know?",desc:"Specific requirements, concerns, or anything that would help from day one.",id:"f-additionalInfo",children:e.jsx("textarea",{className:"st-textarea",rows:4,placeholder:"e.g. I have a big event coming up in 6 weeks.",value:s.additionalInfo,onChange:t=>o("additionalInfo",t.target.value)})})]}),a._submit&&e.jsx("p",{className:"st-err-msg st-submit-err",role:"alert",children:a._submit}),e.jsxs("div",{className:"st-controls",children:[e.jsxs("button",{type:"button",className:"st-back",onClick:q,children:[e.jsx(O,{width:15,height:15})," Back"]}),e.jsx("button",{type:"submit",className:"btn btn-primary st-next",disabled:c,children:c?e.jsx("span",{className:"st-spinner","aria-label":"Submitting"}):N?e.jsxs(e.Fragment,{children:[e.jsx(H,{width:16,height:16})," Submit Your Brief"]}):e.jsxs(e.Fragment,{children:["Continue ",e.jsx(C,{width:16,height:16})]})})]})]},r)}),e.jsx("style",{children:j})]})}const j=`
  .st-shell { background: var(--bg); min-height: calc(100vh - 76px); }

  /* ── Intro ── */
  .st-intro {
    min-height: calc(100vh - 180px);
    display: flex; align-items: center; justify-content: center;
    background: var(--bg-deep); text-align: center;
    padding: var(--space-16) var(--space-6);
  }
  .st-intro-inner {
    max-width: 640px; display: flex; flex-direction: column; align-items: center;
    animation: stIn 0.6s var(--ease) both;
  }
  .st-intro-mark { margin-bottom: var(--space-8); opacity: 0.9; }
  .st-intro-title {
    font-size: clamp(3.2rem, 10vw, 6rem); color: var(--text);
    margin-bottom: var(--space-6);
  }
  .st-intro-red { color: var(--brand); }
  .st-intro-sub {
    font-size: 1.0625rem; color: var(--text-secondary); line-height: 1.7;
    max-width: 420px; margin-bottom: var(--space-8);
  }
  .st-begin-btn {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 15px 40px; font-size: 1.0625rem; font-weight: 700;
    border-radius: 12px;
  }

  /* ── Progress ── */
  .st-progress {
    position: sticky; top: 0; z-index: 100;
    background: var(--chrome-solid);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
  }
  .st-progress-inner {
    display: flex; align-items: baseline; gap: var(--space-4);
    padding: 14px var(--space-6) 12px;
  }
  .st-progress-label {
    font-size: 0.7rem; font-weight: 800; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--brand); white-space: nowrap;
  }
  .st-progress-title { font-size: 0.875rem; font-weight: 600; color: var(--text-secondary); }
  .st-progress-track { height: 2px; background: var(--glass-bg); }
  .st-progress-fill {
    height: 100%; background: var(--brand);
    transition: width 0.45s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* ── Step frame + transitions ── */
  .st-form { max-width: 760px; padding-top: var(--space-10); padding-bottom: var(--space-24); }
  @keyframes stIn      { from { opacity: 0; transform: translateY(18px); }  to { opacity: 1; transform: none; } }
  @keyframes stInFwd   { from { opacity: 0; transform: translateX(36px); }  to { opacity: 1; transform: none; } }
  @keyframes stInBack  { from { opacity: 0; transform: translateX(-36px); } to { opacity: 1; transform: none; } }
  .st-anim-fwd  { animation: stInFwd  0.4s var(--ease) both; }
  .st-anim-back { animation: stInBack 0.4s var(--ease) both; }
  @media (prefers-reduced-motion: reduce) {
    .st-anim-fwd, .st-anim-back, .st-intro-inner { animation: stIn 0.01s both; }
    .st-progress-fill { transition: none; }
  }

  .st-step-head { margin-bottom: var(--space-8); }
  .st-step-title {
    font-size: clamp(1.7rem, 4vw, 2.4rem); font-weight: 800;
    letter-spacing: -0.03em; color: var(--text); outline: none;
    margin-bottom: var(--space-2);
  }
  .st-step-sub { color: var(--text-secondary); }

  .st-fields { display: flex; flex-direction: column; gap: var(--space-6); }

  /* ── Fields ── */
  .st-field { display: flex; flex-direction: column; gap: 6px; }
  .st-label { font-size: 0.9375rem; font-weight: 700; color: var(--text); line-height: 1.4; }
  .st-req { color: var(--brand); margin-left: 2px; }
  .st-desc { font-size: 0.84rem; color: var(--text-muted); line-height: 1.6; }
  .st-err-msg { font-size: 0.78rem; color: var(--brand); font-weight: 700; }
  .st-submit-err { margin-top: var(--space-4); }
  .st-field--err .st-input,
  .st-field--err .st-textarea,
  .st-field--err .st-select { border-color: rgba(212,76,67,0.6) !important; }

  .st-input, .st-textarea, .st-select {
    width: 100%; padding: 12px 15px;
    border: 1.5px solid var(--border-light); border-radius: 10px;
    background: var(--bg-card); color: var(--text);
    font-family: inherit; font-size: 0.9375rem; line-height: 1.5;
    outline: none; transition: border-color 0.18s, box-shadow 0.18s;
  }
  .st-input:focus, .st-textarea:focus, .st-select:focus {
    border-color: var(--brand);
    box-shadow: 0 0 0 3px rgba(212,76,67,0.15);
  }
  .st-textarea { resize: vertical; min-height: 100px; }
  .st-select { appearance: none; cursor: pointer; }
  .st-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
  @media (max-width: 580px) { .st-row2 { grid-template-columns: 1fr; } }

  /* ── Icon cards (project type + services) ── */
  .st-cards { display: flex; flex-direction: column; gap: 8px; position: relative; }
  .st-icard {
    display: flex; align-items: center; gap: 14px;
    padding: 15px 18px; border: 1.5px solid var(--border);
    border-radius: 12px; cursor: pointer; background: var(--bg-card);
    transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
    user-select: none; position: relative;
  }
  .st-icard input { position: absolute; opacity: 0; pointer-events: none; }
  .st-icard:hover { border-color: rgba(212,76,67,0.4); }
  .st-icard:has(input:focus-visible) { box-shadow: 0 0 0 3px rgba(212,76,67,0.3); }
  .st-icard.is-sel {
    border-color: var(--brand); background: var(--glass-bg-brand);
    box-shadow: 0 0 0 3px rgba(212,76,67,0.12);
  }
  .st-icard-icon {
    width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--brand); background: var(--glass-bg);
    border: 1px solid var(--border);
  }
  .st-icard-body { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .st-icard-lbl { font-size: 0.9375rem; font-weight: 700; color: var(--text); line-height: 1.3; }
  .st-icard-desc { font-size: 0.8125rem; color: var(--text-muted); line-height: 1.45; }
  .st-icard-mark {
    width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
    border: 2px solid var(--border-light); background: transparent;
    display: inline-flex; align-items: center; justify-content: center;
    color: #fff; transition: all 0.18s;
  }
  .st-icard.is-sel .st-icard-mark { background: var(--brand); border-color: var(--brand); }

  /* ── Radios ── */
  .st-radio-group { display: flex; flex-direction: column; gap: 8px; }
  .st-radio {
    display: flex; align-items: center; gap: 12px;
    padding: 13px 16px; border: 1.5px solid var(--border);
    border-radius: 10px; cursor: pointer; background: var(--bg-card);
    transition: border-color 0.18s, background 0.18s; user-select: none;
    position: relative;
  }
  .st-radio input { position: absolute; opacity: 0; pointer-events: none; }
  .st-radio:hover { border-color: rgba(212,76,67,0.4); }
  .st-radio:has(input:focus-visible) { box-shadow: 0 0 0 3px rgba(212,76,67,0.3); }
  .st-radio.is-sel { border-color: var(--brand); background: var(--glass-bg-brand); }
  .st-radio-dot {
    width: 20px; height: 20px; border-radius: 50%;
    border: 2px solid var(--border-light); flex-shrink: 0;
    position: relative; transition: border-color 0.18s;
  }
  .st-radio.is-sel .st-radio-dot { border-color: var(--brand); }
  .st-radio.is-sel .st-radio-dot::after {
    content: ''; position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 9px; height: 9px; border-radius: 50%; background: var(--brand);
  }
  .st-radio-txt { font-size: 0.9375rem; font-weight: 500; color: var(--text); flex: 1; line-height: 1.4; }
  .st-radio-note {
    font-size: 0.7rem; font-weight: 600; color: var(--text-muted);
    padding: 3px 9px; background: var(--glass-bg); border-radius: 999px; flex-shrink: 0;
  }

  /* ── Checkboxes ── */
  .st-checks--stack { display: flex; flex-direction: column; gap: 8px; }
  .st-checks--grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  @media (max-width: 560px) { .st-checks--grid { grid-template-columns: 1fr; } }
  .st-checks--pills { display: flex; flex-wrap: wrap; gap: 8px; }
  .st-checks--pills .st-check { padding: 8px 16px; border-radius: 999px; align-items: center; gap: 7px; }
  .st-checks--pills .st-check-desc { display: none; }
  .st-checks--pills .st-check-box { width: 14px; height: 14px; border-radius: 50%; margin-top: 0; }
  .st-checks--pills .st-check-lbl { font-size: 0.875rem; }
  .st-check {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 13px 15px; border: 1.5px solid var(--border);
    border-radius: 10px; cursor: pointer; background: var(--bg-card);
    transition: border-color 0.18s, background 0.18s; user-select: none;
    position: relative;
  }
  .st-check input { position: absolute; opacity: 0; pointer-events: none; }
  .st-check:hover { border-color: rgba(212,76,67,0.4); }
  .st-check:has(input:focus-visible) { box-shadow: 0 0 0 3px rgba(212,76,67,0.3); }
  .st-check.is-sel { border-color: var(--brand); background: var(--glass-bg-brand); }
  .st-check.is-dis { opacity: 0.35; cursor: not-allowed; }
  .st-check-box {
    width: 20px; height: 20px; border-radius: 5px;
    border: 2px solid var(--border-light); flex-shrink: 0; margin-top: 1px;
    display: inline-flex; align-items: center; justify-content: center;
    color: #fff; transition: background 0.18s, border-color 0.18s;
  }
  .st-check.is-sel .st-check-box { background: var(--brand); border-color: var(--brand); }
  .st-check-body { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .st-check-lbl { font-size: 0.9375rem; font-weight: 600; color: var(--text); line-height: 1.3; }
  .st-check-desc { font-size: 0.8125rem; color: var(--text-muted); line-height: 1.45; }

  /* ── Controls ── */
  .st-controls {
    display: flex; align-items: center; justify-content: space-between;
    gap: var(--space-4); margin-top: var(--space-10);
    padding-top: var(--space-6); border-top: 1px solid var(--border);
  }
  .st-back {
    display: inline-flex; align-items: center; gap: 7px;
    background: none; border: 1px solid var(--border); border-radius: 10px;
    color: var(--text-secondary); font-size: 0.9rem; font-weight: 600;
    padding: 11px 20px; cursor: pointer; font-family: inherit;
    transition: color 0.2s, border-color 0.2s;
  }
  .st-back:hover { color: var(--text); border-color: var(--border-light); }
  .st-next {
    display: inline-flex; align-items: center; gap: 9px;
    padding: 13px 32px; font-size: 1rem; font-weight: 700;
    border-radius: 10px; min-width: 170px; justify-content: center;
  }
  .st-next:disabled { opacity: 0.6; cursor: not-allowed; }
  .st-spinner {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
    animation: stSpin 0.65s linear infinite; display: inline-block;
  }
  @keyframes stSpin { to { transform: rotate(360deg); } }

  /* ── Success ── */
  .st-success {
    display: flex; align-items: center; justify-content: center;
    min-height: calc(100vh - 200px); padding: var(--space-16) var(--space-6);
  }
  .st-success-inner {
    display: flex; flex-direction: column; align-items: center;
    max-width: 520px; text-align: center;
  }
  .st-success-icon { color: #22c55e; margin-bottom: var(--space-5); display: inline-flex; }
  .st-success-title { font-size: clamp(2.6rem, 7vw, 4rem); color: var(--text); margin-bottom: var(--space-3); }
  .st-success-body { font-size: 1.0625rem; color: var(--text-secondary); margin-bottom: var(--space-5); }
  .st-success-steps {
    text-align: left; display: flex; flex-direction: column; gap: var(--space-3);
    margin: 0 0 var(--space-6); padding-left: 1.2em;
    color: var(--text-secondary); font-size: 0.9375rem; line-height: 1.65;
  }
  .st-success-steps strong { color: var(--text); }
  .st-success-sub { font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-6); }
  .st-success-btn { padding: 12px 32px; border-radius: 10px; }
`;export{se as default};
