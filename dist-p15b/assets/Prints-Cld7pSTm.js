import{j as e,_ as O,r as g,h as _,a as A,X as E,g as $,U as Q,A as P,o as U,T as D,p as Y}from"./index-B9Tcr1Fm.js";var V=function(t){return e.jsx("svg",O({xmlns:"http://www.w3.org/2000/svg",width:24,height:24,fill:"none",viewBox:"0 0 24 24"},t,{children:e.jsx("path",{stroke:"currentColor",strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M2 2h1.3062c.246 0 .369 0 .468.0452a.5.5 0 0 1 .213.1848c.0587.0915.0761.2133.111.4569L4.5713 6m0 0 1.052 7.7314c.1334.9811.2001 1.4717.4347 1.8409.2067.3254.503.5841.8533.7451.3975.1826.8925.1826 1.8827.1826h8.5579c.9425 0 1.4138 0 1.799-.1696a2 2 0 0 0 .8413-.6962c.2386-.3466.3268-.8095.5032-1.7354l1.3236-6.9491c.0621-.3259.0931-.4888.0481-.6162a.5.5 0 0 0-.2197-.2655C21.5308 6 21.365 6 21.0332 6zM10 21c0 .5523-.4477 1-1 1s-1-.4477-1-1 .4477-1 1-1 1 .4477 1 1m8 0c0 .5523-.4477 1-1 1s-1-.4477-1-1 .4477-1 1-1 1 .4477 1 1"})}))};const T="",G=[{id:"all",label:"All"},{id:"stickers",label:"Stickers"},{id:"vinyl",label:"Vinyl"},{id:"print",label:"Print & Cards"}],W=[{id:"logo-sticker",cat:"stickers",popular:!0,name:"Logo Die-Cut Sticker",desc:"Your logo precision-cut to shape. Glossy, waterproof, and made for indoor use, keep out of direct sunlight.",pricing:{mode:"sticker"},fields:["qty","size","artwork"]},{id:"qr-sticker",cat:"stickers",name:"QR Code Sticker",desc:"Logo + scannable QR code in one sticker. Link customers to your site, menu, or booking page.",pricing:{mode:"sticker"},fields:["qty","size","qrUrl","artwork"]},{id:"sticker-sheet",cat:"stickers",name:"Kiss-Cut Sticker Sheet",desc:"Multiple designs on one sheet. Perfect for variety packs, packaging inserts, and giveaways.",pricing:{mode:"quote"},fields:["qty","sheetSize","artwork"]},{id:"ig-vinyl",cat:"vinyl",badge:"$15 flat",name:"Instagram Handle Vinyl",desc:"Your @handle on your car, includes 2, one for each side. Single color, clean and sharp.",pricing:{mode:"flat",amount:15,note:"Includes 2, one for each side of your car"},fields:["text","vinylColor","vinylSize"]},{id:"custom-text-vinyl",cat:"vinyl",name:"Custom Text Vinyl",desc:"Any text you want. Single-color vinyl for vehicles, windows, storefronts, or walls.",pricing:{mode:"quote"},fields:["text","vinylColor","vinylSize"]},{id:"logo-vinyl",cat:"vinyl",name:"Logo Vinyl Decal",desc:"Your logo as a single-color vinyl decal. Die-cut silhouette, minimal and sharp.",pricing:{mode:"quote"},fields:["artwork","vinylColor","vinylSize"]},{id:"business-cards",cat:"print",name:"Business Cards",desc:"Premium card stock, matte or gloss finish. Bring your design or we'll build it from scratch.",pricing:{mode:"quote"},fields:["qty","cardFinish","artwork"]}],I={'2" × 2"':{base:.75,bulk:.53},'3" × 3"':{base:1,bulk:.7},'4" × 4"':{base:1.35,bulk:.95},'5" × 5"':{base:1.75,bulk:1.25},'6" × 8"':{base:2.5,bulk:1.75}},R=250;function H(s){const t=s.pricing;return t?t.mode==="flat"?`$${t.amount} flat`:t.mode==="sticker"?"From $0.75/ea":"By quote":"By quote"}function K(s,t){const r=s.pricing;if(!r||r.mode==="quote")return{mode:"quote",total:null,display:"By quote"};if(r.mode==="flat")return{mode:"flat",total:r.amount,display:`$${r.amount} flat`};if(r.mode==="sticker"){const i=parseInt(String(t.qty||"").replace(/[^0-9]/g,""),10)||0;if(t.size==="Custom")return{mode:"quote",total:null,display:"By quote"};const u=I[t.size];if(!i||!u)return{mode:"sticker",qty:i,total:null,display:null};const o=i>=R?u.bulk:u.base,h=+(o*i).toFixed(2);return{mode:"sticker",qty:i,unit:o,total:h,display:`$${o.toFixed(2)}/ea`}}return{mode:"quote",total:null,display:"By quote"}}function w(s){return`$${s.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`}const J=['2" × 2"','3" × 3"','4" × 4"','5" × 5"','6" × 8"',"Custom"],X=['4" × 6"','5" × 7"','8.5" × 11"',"Custom"],Z=['4" × 16"','6" × 24"','8" × 32"',"Custom"],ee=["Matte","Gloss","Spot UV"],se=["10","25","50","100","250","500","1,000+"],re=["50","100","250","500","1,000"],te=[{label:"White",hex:"#ffffff",border:!0},{label:"Black",hex:"#111111"},{label:"Red",hex:"#d44c43"},{label:"Gold",hex:"#c9a12a"},{label:"Blue",hex:"#2563eb"},{label:"Silver",hex:"#a1a1aa"},{label:"Other, specify in notes",hex:null}];function ie({label:s,selected:t,onClick:r}){return e.jsx("button",{type:"button",className:`ps-chip${t?" is-sel":""}`,onClick:r,children:s})}function ae({value:s,onChange:t}){return e.jsx("div",{className:"ps-opt-grid",children:J.map(r=>{const i=I[r];return e.jsxs("button",{type:"button",className:`ps-opt ps-opt--size${s===r?" is-sel":""}`,onClick:()=>t(r),children:[e.jsx("span",{children:r}),e.jsx("span",{className:"ps-opt-price",children:i?`$${i.base.toFixed(2)}/ea`:"By quote"})]},r)})})}function F({opts:s,value:t,onChange:r}){return e.jsx("div",{className:"ps-opt-grid",children:s.map(i=>e.jsx("button",{type:"button",className:`ps-opt${t===i?" is-sel":""}`,onClick:()=>r(i),children:i},i))})}function oe({value:s,onChange:t}){return e.jsx("div",{className:"ps-color-row",children:te.map(r=>e.jsx("button",{type:"button",title:r.label,className:`ps-swatch${s===r.label?" is-sel":""}`,onClick:()=>t(r.label),style:{background:r.hex||"conic-gradient(red,orange,yellow,green,blue,purple,red)",border:r.border?"2px solid #555":void 0},children:s===r.label&&e.jsx($,{width:12,height:12,color:r.border?"#333":"var(--ps-white)"})},r.label))})}const L={"logo-sticker":e.jsxs("svg",{viewBox:"0 0 48 48",fill:"none",children:[e.jsx("circle",{cx:"24",cy:"24",r:"18",stroke:"currentColor",strokeWidth:"2.5"}),e.jsx("circle",{cx:"24",cy:"24",r:"9",stroke:"currentColor",strokeWidth:"2",strokeDasharray:"4 3"}),e.jsx("circle",{cx:"24",cy:"24",r:"3",fill:"currentColor"})]}),"qr-sticker":e.jsxs("svg",{viewBox:"0 0 48 48",fill:"none",children:[e.jsx("rect",{x:"8",y:"8",width:"14",height:"14",rx:"2",stroke:"currentColor",strokeWidth:"2.2"}),e.jsx("rect",{x:"26",y:"8",width:"14",height:"14",rx:"2",stroke:"currentColor",strokeWidth:"2.2"}),e.jsx("rect",{x:"8",y:"26",width:"14",height:"14",rx:"2",stroke:"currentColor",strokeWidth:"2.2"}),e.jsx("rect",{x:"11",y:"11",width:"8",height:"8",rx:"1",fill:"currentColor"}),e.jsx("rect",{x:"29",y:"11",width:"8",height:"8",rx:"1",fill:"currentColor"}),e.jsx("rect",{x:"11",y:"29",width:"8",height:"8",rx:"1",fill:"currentColor"}),e.jsx("path",{d:"M30 26h4M30 30h8M34 34h4",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round"})]}),"sticker-sheet":e.jsxs("svg",{viewBox:"0 0 48 48",fill:"none",children:[e.jsx("rect",{x:"6",y:"6",width:"36",height:"36",rx:"4",stroke:"currentColor",strokeWidth:"2.2"}),e.jsx("rect",{x:"13",y:"13",width:"9",height:"9",rx:"2",stroke:"currentColor",strokeWidth:"2"}),e.jsx("rect",{x:"26",y:"13",width:"9",height:"9",rx:"2",stroke:"currentColor",strokeWidth:"2"}),e.jsx("rect",{x:"13",y:"26",width:"9",height:"9",rx:"2",stroke:"currentColor",strokeWidth:"2"}),e.jsx("rect",{x:"26",y:"26",width:"9",height:"9",rx:"2",stroke:"currentColor",strokeWidth:"2"})]}),"ig-vinyl":e.jsxs("svg",{viewBox:"0 0 48 48",fill:"none",children:[e.jsx("rect",{x:"10",y:"10",width:"28",height:"28",rx:"8",stroke:"currentColor",strokeWidth:"2.5"}),e.jsx("circle",{cx:"24",cy:"24",r:"6",stroke:"currentColor",strokeWidth:"2.2"}),e.jsx("circle",{cx:"33",cy:"15",r:"2",fill:"currentColor"})]}),"custom-text-vinyl":e.jsx("svg",{viewBox:"0 0 48 48",fill:"none",children:e.jsx("path",{d:"M8 36h8M12 12v24M12 12h8M20 12h8M24 12v12M32 12v24M28 36h8",stroke:"currentColor",strokeWidth:"2.4",strokeLinecap:"round",strokeLinejoin:"round"})}),"logo-vinyl":e.jsxs("svg",{viewBox:"0 0 48 48",fill:"none",children:[e.jsx("path",{d:"M10 38L24 10L38 38Z",stroke:"currentColor",strokeWidth:"2.5",strokeLinejoin:"round"}),e.jsx("circle",{cx:"24",cy:"28",r:"4",stroke:"currentColor",strokeWidth:"2.2"})]}),"business-cards":e.jsxs("svg",{viewBox:"0 0 48 48",fill:"none",children:[e.jsx("rect",{x:"6",y:"13",width:"36",height:"22",rx:"3",stroke:"currentColor",strokeWidth:"2.4"}),e.jsx("path",{d:"M13 22h10M13 27h7",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round"}),e.jsx("circle",{cx:"33",cy:"24.5",r:"5",stroke:"currentColor",strokeWidth:"2"})]})},ne={qty:"",size:"",sheetSize:"",finish:"",artwork:"",artworkFile:null,qrUrl:"",text:"",vinylColor:"",vinylSize:"",cardFinish:"",notes:""};function le({product:s,onClose:t,onAdd:r}){var M;const[i,u]=g.useState(ne),[o,h]=g.useState({}),v=g.useRef(null),c=(a,z)=>u(B=>({...B,[a]:z})),x=s.fields,k=x.includes("qty"),N=x.includes("size"),C=x.includes("sheetSize"),d=x.includes("cardFinish"),m=x.includes("artwork"),j=x.includes("qrUrl"),q=x.includes("text"),n=x.includes("vinylColor"),b=x.includes("vinylSize"),f=()=>{const a={};return k&&!i.qty&&(a.qty="Select a quantity"),N&&!i.size&&(a.size="Select a size"),C&&!i.sheetSize&&(a.sheetSize="Select a sheet size"),d&&!i.cardFinish&&(a.cardFinish="Select a finish"),q&&!i.text.trim()&&(a.text=s.id==="ig-vinyl"?"Enter your Instagram handle":"Enter your text"),n&&!i.vinylColor&&(a.vinylColor="Select a color"),b&&!i.vinylSize&&(a.vinylSize="Select a size"),a},l=K(s,i),p=()=>{const a=f();if(Object.keys(a).length){h(a);return}const z=pe(s,i);r({cartId:Date.now(),productId:s.id,productName:s.name,vals:{...i},label:z,priceMode:l.mode,priceTotal:l.total}),t()},y=((M=s.pricing)==null?void 0:M.mode)==="sticker"?I[i.size]:null,S=y?`$${y.base.toFixed(2)} each · $${y.bulk.toFixed(2)} each at ${R}+`:null;return e.jsx("div",{className:"ps-overlay",onClick:a=>a.target===a.currentTarget&&t(),children:e.jsxs("div",{className:"ps-modal",children:[e.jsxs("div",{className:"ps-modal-head",children:[e.jsxs("div",{children:[e.jsx("p",{className:"ps-modal-eyebrow",children:s.price}),e.jsx("h3",{className:"ps-modal-title",children:s.name})]}),e.jsx("button",{type:"button",className:"ps-modal-close",onClick:t,children:e.jsx(E,{width:20,height:20})})]}),e.jsxs("div",{className:"ps-modal-body",children:[k&&e.jsxs("div",{className:`ps-mfield${o.qty?" is-err":""}`,children:[e.jsxs("label",{className:"ps-mlabel",children:["Quantity ",o.qty&&e.jsx("span",{className:"ps-merr",children:o.qty})]}),e.jsx(F,{opts:s.id==="business-cards"?re:se,value:i.qty,onChange:a=>c("qty",a)}),S&&e.jsx("p",{className:"ps-mhint",children:S})]}),N&&e.jsxs("div",{className:`ps-mfield${o.size?" is-err":""}`,children:[e.jsxs("label",{className:"ps-mlabel",children:["Size ",o.size&&e.jsx("span",{className:"ps-merr",children:o.size})]}),e.jsx(ae,{value:i.size,onChange:a=>c("size",a)}),e.jsx("p",{className:"ps-mhint",children:"Glossy finish · Waterproof · Indoor use, keep out of direct sunlight."})]}),C&&e.jsxs("div",{className:`ps-mfield${o.sheetSize?" is-err":""}`,children:[e.jsxs("label",{className:"ps-mlabel",children:["Sheet Size ",o.sheetSize&&e.jsx("span",{className:"ps-merr",children:o.sheetSize})]}),e.jsx(F,{opts:X,value:i.sheetSize,onChange:a=>c("sheetSize",a)})]}),d&&e.jsxs("div",{className:`ps-mfield${o.cardFinish?" is-err":""}`,children:[e.jsxs("label",{className:"ps-mlabel",children:["Card Finish ",o.cardFinish&&e.jsx("span",{className:"ps-merr",children:o.cardFinish})]}),e.jsx(F,{opts:ee,value:i.cardFinish,onChange:a=>c("cardFinish",a)})]}),q&&e.jsxs("div",{className:`ps-mfield${o.text?" is-err":""}`,children:[e.jsxs("label",{className:"ps-mlabel",children:[s.id==="ig-vinyl"?"Instagram Handle":"Your Text",o.text&&e.jsx("span",{className:"ps-merr",children:o.text})]}),e.jsx("input",{className:"ps-minput",type:"text",placeholder:s.id==="ig-vinyl"?"@yourhandle":"e.g. Sopes Detailing · Wilmington, DE",value:i.text,onChange:a=>{c("text",a.target.value),o.text&&h(z=>({...z,text:""}))}}),s.id==="ig-vinyl"&&e.jsx("p",{className:"ps-mhint",children:"Printed twice, once for each side of your car. White text only."})]}),n&&e.jsxs("div",{className:`ps-mfield${o.vinylColor?" is-err":""}`,children:[e.jsxs("label",{className:"ps-mlabel",children:["Vinyl Color ",o.vinylColor&&e.jsx("span",{className:"ps-merr",children:o.vinylColor})]}),e.jsx(oe,{value:i.vinylColor,onChange:a=>{c("vinylColor",a),o.vinylColor&&h(z=>({...z,vinylColor:""}))}}),i.vinylColor==="Other, specify in notes"&&e.jsx("p",{className:"ps-mhint",children:"Add your color in the notes field below."})]}),b&&e.jsxs("div",{className:`ps-mfield${o.vinylSize?" is-err":""}`,children:[e.jsxs("label",{className:"ps-mlabel",children:["Size (per set) ",o.vinylSize&&e.jsx("span",{className:"ps-merr",children:o.vinylSize})]}),e.jsx(F,{opts:Z,value:i.vinylSize,onChange:a=>c("vinylSize",a)})]}),j&&e.jsxs("div",{className:"ps-mfield",children:[e.jsx("label",{className:"ps-mlabel",children:"QR Code Destination URL"}),e.jsx("input",{className:"ps-minput",type:"url",placeholder:"https://yourbusiness.com",value:i.qrUrl,onChange:a=>c("qrUrl",a.target.value)}),e.jsx("p",{className:"ps-mhint",children:"We'll generate the QR code. Just give us the URL it should open."})]}),m&&e.jsxs("div",{className:"ps-mfield",children:[e.jsx("label",{className:"ps-mlabel",children:"Artwork / Logo File"}),e.jsx("div",{className:"ps-upload-zone",onClick:()=>{var a;return(a=v.current)==null?void 0:a.click()},children:i.artworkFile?e.jsxs(e.Fragment,{children:[e.jsx($,{width:18,height:18,color:"var(--ps-ok)"}),e.jsx("span",{className:"ps-upload-name",children:i.artworkFile.name}),e.jsx("button",{type:"button",className:"ps-upload-clear",onClick:a=>{a.stopPropagation(),c("artworkFile",null)},children:"Remove"})]}):e.jsxs(e.Fragment,{children:[e.jsx(Q,{width:20,height:20}),e.jsxs("span",{children:["Click to upload file",e.jsx("br",{}),e.jsx("small",{children:".ai, .pdf, .png, .svg, .psd"})]})]})}),e.jsx("input",{ref:v,type:"file",accept:".ai,.pdf,.png,.svg,.psd,.jpg,.jpeg,.eps",style:{display:"none"},onChange:a=>{a.target.files[0]&&c("artworkFile",a.target.files[0])}}),e.jsx("p",{className:"ps-mhint",children:"Don't have files ready? Leave blank and we'll follow up after your order."})]}),e.jsxs("div",{className:"ps-mfield",children:[e.jsxs("label",{className:"ps-mlabel",children:["Special Notes ",e.jsx("span",{style:{fontWeight:400,color:"var(--ps-muted)"},children:"(optional)"})]}),e.jsx("textarea",{className:"ps-mtextarea",rows:3,placeholder:"Any specific requirements, colors, or details we should know.",value:i.notes,onChange:a=>c("notes",a.target.value)})]})]}),e.jsxs("div",{className:"ps-modal-foot",children:[e.jsx("div",{className:"ps-price-box",children:l.mode==="quote"?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"ps-price-amt",children:"By Quote"}),e.jsx("span",{className:"ps-price-note",children:"We'll price after reviewing your details"})]}):l.mode==="flat"?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"ps-price-amt",children:w(l.total)}),e.jsx("span",{className:"ps-price-note",children:s.pricing.note||"Flat rate"})]}):l.total!=null?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"ps-price-amt",children:w(l.total)}),e.jsxs("span",{className:"ps-price-note",children:[l.display," × ",l.qty," stickers"]})]}):e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"ps-price-amt ps-price-amt--dim",children:"Select size & quantity"}),S&&e.jsx("span",{className:"ps-price-note",children:S})]})}),e.jsxs("button",{type:"button",className:"ps-btn-primary",onClick:p,children:["Add to Cart ",e.jsx(P,{width:16,height:16})]})]})]})})}function ce({cart:s,onRemove:t,onClose:r,onCheckoutDone:i}){const[u,o]=g.useState("cart"),[h,v]=g.useState({name:"",email:"",phone:""}),[c,x]=g.useState({}),[k,N]=g.useState(!1),[C,d]=g.useState("");g.useRef({});const m=(n,b)=>v(f=>({...f,[n]:b})),j=()=>{const n={};return h.name.trim()||(n.name="Required"),(!h.email.trim()||!/\S+@\S+\.\S+/.test(h.email))&&(n.email="Valid email required"),n},q=async()=>{const n=j();if(Object.keys(n).length){x(n);return}N(!0),d("");try{const b=s.reduce((p,y)=>p+(y.priceMode!=="quote"&&y.priceTotal!=null?y.priceTotal:0),0),f=s.some(p=>p.priceMode==="quote"||p.priceTotal==null),l=new FormData;l.append("access_key",T),l.append("subject",`New Shop Order, ${h.name}`),l.append("from_name",h.name),l.append("email",h.email),l.append("Phone",h.phone||"n/a"),l.append("Order Items",s.length.toString()),l.append("Estimated Subtotal",`${w(b)}${f?" + quote items":""}`),s.forEach((p,y)=>{const S=p.priceMode==="quote"||p.priceTotal==null?"Quote":w(p.priceTotal);l.append(`Item ${y+1}`,`${p.productName}, ${p.label}, ${S}`),p.vals.notes&&l.append(`Item ${y+1} Notes`,p.vals.notes),p.vals.artworkFile&&l.append(`Artwork, ${p.productName}`,p.vals.artworkFile)}),l.append("Payment","No deposit, collected when production begins");try{await fetch("/api/submissions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"shop-order",name:h.name.trim(),email:h.email.trim(),phone:h.phone.trim(),fields:{Items:s.map(p=>`${p.productName}, ${p.label}, ${p.priceMode==="quote"||p.priceTotal==null?"Quote":w(p.priceTotal)}`).join(" | "),"Estimated Subtotal":`${w(b)}${f?" + quote items":""}`,Payment:"Collected when production begins"}})})}catch{}o("done"),i()}catch{d("Something went wrong. Email us at contact@visualizeclients.com.")}finally{N(!1)}};return e.jsx("div",{className:"ps-overlay",onClick:n=>n.target===n.currentTarget&&r(),children:e.jsxs("div",{className:"ps-drawer",children:[e.jsxs("div",{className:"ps-drawer-head",children:[e.jsx("h3",{className:"ps-drawer-title",children:u==="cart"?`Cart (${s.length})`:u==="checkout"?"Your Info":"Order Placed"}),e.jsx("button",{type:"button",className:"ps-modal-close",onClick:r,children:e.jsx(E,{width:20,height:20})})]}),u==="cart"&&e.jsx(e.Fragment,{children:s.length===0?e.jsxs("div",{className:"ps-drawer-empty",children:[e.jsx(U,{width:40,height:40}),e.jsx("p",{children:"Your cart is empty"})]}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"ps-drawer-items",children:s.map(n=>e.jsxs("div",{className:"ps-cart-item",children:[e.jsx("div",{className:"ps-ci-icon",children:L[n.productId]}),e.jsxs("div",{className:"ps-ci-body",children:[e.jsx("p",{className:"ps-ci-name",children:n.productName}),e.jsx("p",{className:"ps-ci-label",children:n.label})]}),e.jsxs("div",{className:"ps-ci-right",children:[e.jsx("span",{className:"ps-ci-price",children:n.priceMode==="quote"||n.priceTotal==null?"Quote":w(n.priceTotal)}),e.jsx("button",{type:"button",className:"ps-ci-remove",onClick:()=>t(n.cartId),children:e.jsx(D,{width:14,height:14})})]})]},n.cartId))}),e.jsxs("div",{className:"ps-drawer-foot",children:[(()=>{const n=s.reduce((f,l)=>f+(l.priceMode!=="quote"&&l.priceTotal!=null?l.priceTotal:0),0),b=s.some(f=>f.priceMode==="quote"||f.priceTotal==null);return e.jsxs("div",{className:"ps-subtotal-row",children:[e.jsx("span",{children:"Estimated subtotal"}),e.jsxs("span",{className:"ps-subtotal-amt",children:[w(n),b?" + quote":""]})]})})(),e.jsx("p",{className:"ps-drawer-note",children:"Quote items are priced after review. No payment is due today, payment is collected when production begins."}),e.jsxs("button",{type:"button",className:"ps-btn-primary",style:{width:"100%"},onClick:()=>o("checkout"),children:["Continue to Checkout ",e.jsx(P,{width:16,height:16})]})]})]})}),u==="checkout"&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"ps-drawer-items",style:{gap:16,padding:"20px 24px"},children:[e.jsxs("div",{className:"ps-checkout-recap",children:[e.jsxs("p",{className:"ps-cr-label",children:[s.length," item",s.length!==1?"s":""]}),s.map(n=>e.jsx("p",{className:"ps-cr-item",children:n.productName},n.cartId))]}),e.jsxs("div",{className:"ps-co-field",children:[e.jsxs("label",{className:"ps-mlabel",children:["Full Name ",c.name&&e.jsx("span",{className:"ps-merr",children:c.name})]}),e.jsx("input",{className:`ps-minput${c.name?" is-err":""}`,placeholder:"Carlos Mendez",value:h.name,onChange:n=>{m("name",n.target.value),c.name&&x(b=>({...b,name:""}))}})]}),e.jsxs("div",{className:"ps-co-field",children:[e.jsxs("label",{className:"ps-mlabel",children:["Email ",c.email&&e.jsx("span",{className:"ps-merr",children:c.email})]}),e.jsx("input",{className:`ps-minput${c.email?" is-err":""}`,type:"email",placeholder:"you@example.com",value:h.email,onChange:n=>{m("email",n.target.value),c.email&&x(b=>({...b,email:""}))}})]}),e.jsxs("div",{className:"ps-co-field",children:[e.jsxs("label",{className:"ps-mlabel",children:["Phone ",e.jsx("span",{style:{fontWeight:400,color:"var(--ps-muted)"},children:"(optional)"})]}),e.jsx("input",{className:"ps-minput",type:"tel",placeholder:"(302) 555-0123",value:h.phone,onChange:n=>m("phone",n.target.value)})]}),C&&e.jsx("p",{className:"ps-merr",style:{fontSize:"0.8rem"},children:C})]}),e.jsxs("div",{className:"ps-drawer-foot",children:[e.jsx("button",{type:"button",className:"ps-back-btn",onClick:()=>o("cart"),children:"← Back"}),e.jsx("button",{type:"button",className:"ps-btn-primary",style:{flex:1},onClick:q,disabled:k,children:k?e.jsx("span",{className:"ps-spinner"}):e.jsxs(e.Fragment,{children:[e.jsx(Y,{width:15,height:15})," Place Order"]})})]})]}),u==="done"&&e.jsxs("div",{className:"ps-drawer-empty",style:{gap:16},children:[e.jsx("div",{className:"ps-done-icon",children:e.jsx($,{width:30,height:30})}),e.jsx("p",{style:{fontWeight:700,fontSize:"1.1rem",color:"var(--ps-text)"},children:"Order received."}),e.jsx("p",{style:{fontSize:"0.875rem",color:"var(--ps-muted)",textAlign:"center",lineHeight:1.6},children:"Rob will follow up within 24 hours to confirm details. Payment is collected when production begins."})]})]})})}function pe(s,t){const r=[];return t.qty&&r.push(`Qty: ${t.qty}`),t.size&&r.push(t.size,"Glossy"),t.sheetSize&&r.push(t.sheetSize),t.vinylSize&&r.push(t.vinylSize),t.cardFinish&&r.push(t.cardFinish),t.vinylColor&&r.push(t.vinylColor),t.text&&r.push(`"${t.text}"`),t.artworkFile&&r.push(`File: ${t.artworkFile.name}`),r.join(" · ")||s.name}function de({product:s,onCustomize:t}){return e.jsxs("div",{className:"ps-card",children:[s.popular&&e.jsxs("span",{className:"ps-card-badge ps-card-badge--pop",children:[e.jsx(_,{width:10,height:10})," Popular"]}),s.badge&&!s.popular&&e.jsx("span",{className:"ps-card-badge ps-card-badge--price",children:s.badge}),e.jsx("div",{className:"ps-card-icon",children:L[s.id]}),e.jsxs("div",{className:"ps-card-body",children:[e.jsx("h3",{className:"ps-card-name",children:s.name}),e.jsx("p",{className:"ps-card-desc",children:s.desc})]}),e.jsxs("div",{className:"ps-card-foot",children:[e.jsx("span",{className:"ps-card-price",children:H(s)}),e.jsxs("button",{type:"button",className:"ps-card-btn",onClick:()=>t(s),children:["Customize ",e.jsx(A,{width:14,height:14})]})]})]})}function xe(){const[s,t]=g.useState("all"),[r,i]=g.useState(()=>{try{return JSON.parse(sessionStorage.getItem("vz_cart")||"[]")}catch{return[]}}),[u,o]=g.useState(null),[h,v]=g.useState(!1),c=g.useCallback(d=>{const m=d.map(j=>({...j,vals:{...j.vals,artworkFile:null}}));try{sessionStorage.setItem("vz_cart",JSON.stringify(m))}catch{}},[]),x=d=>{const m=[...r,d];i(m),c(m),o(null),v(!0)},k=d=>{const m=r.filter(j=>j.cartId!==d);i(m),c(m)},N=()=>{i([]);try{sessionStorage.removeItem("vz_cart")}catch{}},C=s==="all"?W:W.filter(d=>d.cat===s);return e.jsxs("div",{className:"ps-page",children:[e.jsx("header",{className:"ps-header",children:e.jsxs("div",{className:"ps-header-inner",children:[e.jsx("div",{className:"ps-header-brand",children:e.jsx("img",{src:"/VisualizeWordmark.png",alt:"Visualize Studio",className:"ps-wordmark"})}),e.jsx("div",{className:"ps-header-center",children:e.jsx("span",{className:"ps-header-title",children:"Print Shop"})}),e.jsxs("button",{type:"button",className:"ps-cart-toggle",onClick:()=>v(!0),children:[e.jsx(V,{width:18,height:18}),"Cart",r.length>0&&e.jsx("span",{className:"ps-cart-count",children:r.length})]})]})}),e.jsxs("section",{className:"ps-hero",children:[e.jsxs("div",{className:"ps-hero-inner",children:[e.jsx("p",{className:"ps-hero-eyebrow",children:"Custom Print Services"}),e.jsxs("h1",{className:"ps-hero-title",children:["Your brand,",e.jsx("br",{}),"on everything."]}),e.jsx("p",{className:"ps-hero-sub",children:"Stickers, vinyl, and print, designed and produced for your business. Select a product, customize it, and we'll handle the rest."})]}),e.jsx("div",{className:"ps-hero-visual","aria-hidden":"true",children:[...Array(6)].map((d,m)=>e.jsx("div",{className:"ps-hero-dot",style:{"--i":m}},m))})]}),e.jsx("div",{className:"ps-cat-bar",children:G.map(d=>e.jsx(ie,{label:d.label,selected:s===d.id,onClick:()=>t(d.id)},d.id))}),e.jsx("main",{className:"ps-grid-wrap",children:e.jsx("div",{className:"ps-grid",children:C.map(d=>e.jsx(de,{product:d,onCustomize:m=>o(m)},d.id))})}),e.jsx("footer",{className:"ps-foot",children:e.jsxs("p",{children:["No payment is due at checkout, payment is collected when production begins. Final pricing confirmed after review.",e.jsx("br",{}),"Questions? Email ",e.jsx("a",{href:"mailto:contact@visualizeclients.com",children:"contact@visualizeclients.com"})]})}),u&&e.jsx(le,{product:u,onClose:()=>o(null),onAdd:x}),h&&e.jsx(ce,{cart:r,onRemove:k,onClose:()=>v(!1),onCheckoutDone:N}),e.jsx("style",{children:he})]})}const he=`
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .ps-page {
    min-height: 100vh;
    --ps-bg:      #0d0d0f;
    background: var(--ps-bg);
    --ps-surface: #141418;
    --ps-card:    #1a1a22;
    --ps-border:  rgba(255,255,255,0.09);
    --ps-text:    #f2f2f3;
    --ps-sub:     #9a9aab;
    --ps-muted:   #5e5e6e;
    --ps-brand:   #d44c43;
    --ps-white:   #fff;
    --ps-ok:      #22c55e;
    --ps-gold:    #c9a12a;
    --ps-brand-dim: rgba(212,76,67,0.12);
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
    color: var(--ps-text);
  }

  /* ── Header ──────────────────────────── */
  .ps-header {
    position: sticky; top: 0; z-index: 50;
    background: rgba(13,13,15,0.88);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--ps-border);
  }
  .ps-header-inner {
    max-width: 1100px; margin: 0 auto;
    padding: 14px 24px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .ps-wordmark { height: 18px; filter: brightness(0) invert(1); }
  .ps-header-center { position: absolute; left: 50%; transform: translateX(-50%); }
  .ps-header-title { font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ps-sub); }
  .ps-cart-toggle {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 16px; border-radius: 999px;
    border: 1px solid var(--ps-border); background: var(--ps-surface);
    color: var(--ps-text); font-size: 0.875rem; font-weight: 600;
    cursor: pointer; font-family: inherit; position: relative;
    transition: border-color 0.18s, background 0.18s;
  }
  .ps-cart-toggle:hover { border-color: rgba(212,76,67,0.5); background: var(--ps-brand-dim); }
  .ps-cart-count {
    position: absolute; top: -7px; right: -7px;
    width: 20px; height: 20px; border-radius: 50%;
    background: var(--ps-brand); color: var(--ps-white);
    font-size: 0.65rem; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
  }

  /* ── Hero ────────────────────────────── */
  .ps-hero {
    padding: 72px 24px 56px; max-width: 1100px; margin: 0 auto;
    display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 40px;
  }
  .ps-hero-inner { max-width: 520px; }
  .ps-hero-eyebrow {
    font-size: 0.7rem; font-weight: 800; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--ps-brand); margin-bottom: 16px;
  }
  .ps-hero-title {
    font-size: clamp(2.2rem, 5vw, 3.4rem); font-weight: 900;
    letter-spacing: -0.04em; line-height: 1.06; color: var(--ps-text);
    margin-bottom: 18px;
  }
  .ps-hero-sub { font-size: 1rem; color: var(--ps-sub); line-height: 1.7; max-width: 420px; }
  .ps-hero-visual {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 10px; opacity: 0.4;
  }
  .ps-hero-dot {
    width: 28px; height: 28px; border-radius: 6px;
    background: var(--ps-brand);
    opacity: calc(0.3 + var(--i) * 0.12);
    animation: dotPulse 2.5s ease-in-out infinite;
    animation-delay: calc(var(--i) * 0.3s);
  }
  @keyframes dotPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(0.85)} }
  @media(max-width:600px){ .ps-hero{grid-template-columns:1fr;} .ps-hero-visual{display:none;} .ps-hero{padding:48px 20px 36px;} }

  /* ── Category chips ──────────────────── */
  .ps-cat-bar {
    display: flex; gap: 8px; padding: 0 24px 24px;
    max-width: 1100px; margin: 0 auto; overflow-x: auto; scrollbar-width: none;
  }
  .ps-cat-bar::-webkit-scrollbar { display: none; }
  .ps-chip {
    padding: 7px 18px; border-radius: 999px; font-size: 0.875rem; font-weight: 600;
    border: 1px solid var(--ps-border); background: var(--ps-surface);
    color: var(--ps-sub); cursor: pointer; white-space: nowrap; font-family: inherit;
    transition: all 0.18s;
  }
  .ps-chip:hover { border-color: rgba(212,76,67,0.4); color: var(--ps-text); }
  .ps-chip.is-sel { background: var(--ps-brand); border-color: var(--ps-brand); color: var(--ps-white); }

  /* ── Product grid ────────────────────── */
  .ps-grid-wrap { max-width: 1100px; margin: 0 auto; padding: 0 24px 48px; }
  .ps-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
  .ps-card {
    background: var(--ps-card); border: 1px solid var(--ps-border);
    border-radius: 16px; padding: 24px;
    display: flex; flex-direction: column; gap: 16px;
    position: relative; overflow: hidden;
    transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
  }
  .ps-card:hover {
    border-color: rgba(212,76,67,0.3);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  }
  .ps-card-badge {
    position: absolute; top: 16px; right: 16px;
    font-size: 0.65rem; font-weight: 800; letter-spacing: 0.06em;
    padding: 3px 9px; border-radius: 999px;
    display: flex; align-items: center; gap: 4px;
  }
  .ps-card-badge--pop { background: rgba(212,76,67,0.18); color: var(--ps-brand); border: 1px solid rgba(212,76,67,0.3); }
  .ps-card-badge--price { background: rgba(201,161,42,0.15); color: var(--ps-gold); border: 1px solid rgba(201,161,42,0.3); }
  .ps-card-icon {
    width: 52px; height: 52px; color: var(--ps-brand);
    display: flex; align-items: center; justify-content: center;
    background: var(--ps-brand-dim); border-radius: 12px;
    flex-shrink: 0;
  }
  .ps-card-icon svg { width: 28px; height: 28px; }
  .ps-card-body { flex: 1; }
  .ps-card-name { font-size: 1rem; font-weight: 800; letter-spacing: -0.02em; color: var(--ps-text); margin-bottom: 6px; }
  .ps-card-desc { font-size: 0.8375rem; color: var(--ps-sub); line-height: 1.6; }
  .ps-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .ps-card-price { font-size: 0.875rem; font-weight: 700; color: var(--ps-sub); }
  .ps-card-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 8px 18px; border-radius: 999px;
    background: var(--ps-brand); color: var(--ps-white);
    border: none; font-size: 0.84rem; font-weight: 700;
    cursor: pointer; font-family: inherit;
    transition: opacity 0.18s, transform 0.15s;
  }
  .ps-card-btn:hover { opacity: 0.88; transform: scale(1.03); }

  /* ── Overlay ─────────────────────────── */
  .ps-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    display: flex; align-items: flex-end; justify-content: center;
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }

  /* ── Modal ───────────────────────────── */
  .ps-modal {
    background: var(--ps-surface); border-top: 1px solid var(--ps-border);
    border-radius: 24px 24px 0 0; width: 100%; max-width: 560px;
    max-height: 90vh; display: flex; flex-direction: column;
    animation: slideUp 0.22s cubic-bezier(0.32,0.72,0,1);
  }
  @keyframes slideUp { from{transform:translateY(32px);opacity:0} to{transform:translateY(0);opacity:1} }
  .ps-modal-head {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding: 22px 24px 18px; border-bottom: 1px solid var(--ps-border); flex-shrink: 0;
  }
  .ps-modal-eyebrow { font-size: 0.75rem; font-weight: 700; color: var(--ps-brand); margin-bottom: 4px; letter-spacing: 0.04em; }
  .ps-modal-title { font-size: 1.25rem; font-weight: 800; letter-spacing: -0.025em; color: var(--ps-text); }
  .ps-modal-close {
    width: 34px; height: 34px; border-radius: 50%;
    border: 1px solid var(--ps-border); background: var(--ps-card);
    color: var(--ps-sub); cursor: pointer; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 2px;
    transition: background 0.15s;
  }
  .ps-modal-close:hover { background: rgba(255,255,255,0.08); }
  .ps-modal-body { flex: 1; overflow-y: auto; padding: 22px 24px; display: flex; flex-direction: column; gap: 22px; }
  .ps-modal-foot { padding: 16px 24px; border-top: 1px solid var(--ps-border); flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .ps-price-box { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .ps-price-amt { font-size: 1.375rem; font-weight: 800; letter-spacing: -0.03em; color: var(--ps-text); line-height: 1.1; }
  .ps-price-amt--dim { font-size: 1rem; font-weight: 600; color: var(--ps-muted); }
  .ps-price-note { font-size: 0.72rem; color: var(--ps-muted); line-height: 1.4; }
  .ps-modal-foot .ps-btn-primary { flex-shrink: 0; }

  /* ── Modal fields ────────────────────── */
  .ps-mfield { display: flex; flex-direction: column; gap: 8px; }
  .ps-mfield.is-err .ps-opt,
  .ps-mfield.is-err .ps-minput,
  .ps-mfield.is-err .ps-swatch { outline: 1px solid var(--ps-brand); }
  .ps-mlabel { font-size: 0.875rem; font-weight: 700; color: var(--ps-text); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ps-merr { font-size: 0.75rem; font-weight: 600; color: var(--ps-brand); }
  .ps-mhint { font-size: 0.78rem; color: var(--ps-muted); line-height: 1.55; }
  .ps-minput, .ps-mtextarea {
    width: 100%; padding: 11px 14px; border-radius: 10px;
    border: 1.5px solid var(--ps-border); background: var(--ps-card);
    color: var(--ps-text); font-family: inherit; font-size: 0.9375rem; outline: none;
    transition: border-color 0.18s;
  }
  .ps-minput::placeholder, .ps-mtextarea::placeholder { color: var(--ps-muted); }
  .ps-minput:focus, .ps-mtextarea:focus { border-color: var(--ps-brand); }
  .ps-minput.is-err { border-color: var(--ps-brand); }
  .ps-mtextarea { resize: vertical; min-height: 80px; }
  .ps-opt-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .ps-opt {
    padding: 7px 14px; border-radius: 8px;
    border: 1.5px solid var(--ps-border); background: var(--ps-card);
    color: var(--ps-sub); font-size: 0.84rem; font-weight: 600;
    cursor: pointer; font-family: inherit;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .ps-opt:hover { border-color: rgba(212,76,67,0.4); color: var(--ps-text); }
  .ps-opt--size { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .ps-opt-price { font-size: 0.68rem; font-weight: 700; color: var(--ps-muted); }
  .ps-opt.is-sel .ps-opt-price { color: var(--ps-text); opacity: 0.75; }
  .ps-opt.is-sel { border-color: var(--ps-brand); background: var(--ps-brand-dim); color: var(--ps-text); }
  .ps-color-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .ps-swatch {
    width: 32px; height: 32px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.12); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .ps-swatch:last-child { width: auto; border-radius: 8px; padding: 0 12px; font-size: 0.78rem; font-weight: 600; color: var(--ps-sub); background: var(--ps-card); }
  .ps-swatch.is-sel { transform: scale(1.15); box-shadow: 0 0 0 3px var(--ps-brand); }
  .ps-upload-zone {
    border: 1.5px dashed var(--ps-border); border-radius: 10px;
    padding: 22px; display: flex; align-items: center; justify-content: center;
    gap: 10px; color: var(--ps-sub); cursor: pointer; font-size: 0.875rem;
    text-align: center; line-height: 1.55;
    transition: border-color 0.18s, background 0.18s;
  }
  .ps-upload-zone:hover { border-color: rgba(212,76,67,0.5); background: var(--ps-brand-dim); }
  .ps-upload-name { font-weight: 600; color: var(--ps-ok); }
  .ps-upload-clear { background: none; border: none; color: var(--ps-muted); font-size: 0.78rem; cursor: pointer; text-decoration: underline; font-family: inherit; margin-left: 8px; }

  /* ── Cart drawer ─────────────────────── */
  .ps-drawer {
    background: var(--ps-surface); border-top: 1px solid var(--ps-border);
    border-radius: 24px 24px 0 0; width: 100%; max-width: 480px;
    max-height: 90vh; display: flex; flex-direction: column;
    animation: slideUp 0.22s cubic-bezier(0.32,0.72,0,1);
  }
  .ps-drawer-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 24px 18px; border-bottom: 1px solid var(--ps-border); flex-shrink: 0;
  }
  .ps-drawer-title { font-size: 1.1rem; font-weight: 800; letter-spacing: -0.02em; color: var(--ps-text); }
  .ps-drawer-items { flex: 1; overflow-y: auto; padding: 16px 24px; display: flex; flex-direction: column; gap: 10px; }
  .ps-drawer-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 40px 24px; color: var(--ps-muted); text-align: center; }
  .ps-drawer-foot { padding: 18px 24px; border-top: 1px solid var(--ps-border); flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; }
  .ps-drawer-note { font-size: 0.775rem; color: var(--ps-muted); line-height: 1.5; text-align: center; }
  .ps-cart-item {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px; border-radius: 10px;
    border: 1px solid var(--ps-border); background: var(--ps-card);
  }
  .ps-ci-icon { width: 36px; height: 36px; flex-shrink: 0; color: var(--ps-brand); }
  .ps-ci-icon svg { width: 36px; height: 36px; }
  .ps-ci-body { flex: 1; min-width: 0; }
  .ps-ci-name { font-size: 0.875rem; font-weight: 700; color: var(--ps-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ps-ci-label { font-size: 0.775rem; color: var(--ps-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ps-ci-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .ps-ci-price { font-size: 0.875rem; font-weight: 800; color: var(--ps-text); white-space: nowrap; }
  .ps-ci-remove { background: none; border: none; color: var(--ps-muted); cursor: pointer; padding: 4px; border-radius: 6px; flex-shrink: 0; transition: color 0.15s, background 0.15s; }
  .ps-ci-remove:hover { color: var(--ps-brand); background: var(--ps-brand-dim); }
  .ps-subtotal-row { display: flex; align-items: center; justify-content: space-between; font-size: 0.9rem; font-weight: 600; color: var(--ps-sub); padding-bottom: 4px; }
  .ps-subtotal-amt { font-size: 1.05rem; font-weight: 800; color: var(--ps-text); letter-spacing: -0.02em; }

  /* ── Checkout fields ─────────────────── */
  .ps-checkout-recap { background: var(--ps-card); border-radius: 10px; padding: 14px; border: 1px solid var(--ps-border); }
  .ps-cr-label { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ps-muted); margin-bottom: 6px; }
  .ps-cr-item { font-size: 0.875rem; color: var(--ps-sub); line-height: 1.6; }
  .ps-co-field { display: flex; flex-direction: column; gap: 7px; }
  .ps-back-btn { background: none; border: 1px solid var(--ps-border); border-radius: 8px; color: var(--ps-sub); padding: 10px 18px; font-family: inherit; font-size: 0.875rem; cursor: pointer; transition: background 0.15s; }
  .ps-back-btn:hover { background: rgba(255,255,255,0.05); }

  /* ── CTA buttons ─────────────────────── */
  .ps-btn-primary {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 14px 24px; border-radius: 12px;
    background: var(--ps-brand); color: var(--ps-white);
    border: none; font-size: 0.9375rem; font-weight: 700; letter-spacing: -0.01em;
    cursor: pointer; font-family: inherit;
    box-shadow: 0 4px 20px rgba(212,76,67,0.3);
    transition: opacity 0.18s, transform 0.15s;
  }
  .ps-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
  .ps-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  /* ── Misc ────────────────────────────── */
  .ps-done-icon {
    width: 64px; height: 64px; border-radius: 50%;
    background: rgba(34,197,94,0.12); border: 1.5px solid rgba(34,197,94,0.3);
    display: flex; align-items: center; justify-content: center; color: var(--ps-ok);
  }
  .ps-done-banner {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 300;
    background: #14532d; border: 1px solid rgba(34,197,94,0.3); color: #86efac;
    padding: 12px 20px; border-radius: 12px;
    display: flex; align-items: center; gap: 10px; font-size: 0.875rem; font-weight: 600;
    white-space: nowrap; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  }
  .ps-done-banner button { background: none; border: none; color: inherit; cursor: pointer; display: flex; align-items: center; margin-left: 4px; }
  .ps-spinner {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.3); border-top-color: var(--ps-white);
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to{transform:rotate(360deg)} }
  .ps-foot { padding: 32px 24px 48px; text-align: center; color: var(--ps-muted); font-size: 0.8rem; line-height: 1.7; }
  .ps-foot a { color: var(--ps-sub); text-decoration: underline; }
  @media(max-width:480px) {
    .ps-header-center { display: none; }
    .ps-grid { grid-template-columns: 1fr; }
    .ps-modal, .ps-drawer { border-radius: 20px 20px 0 0; max-height: 92vh; }
    .ps-hero-title { font-size: 2rem; }
  }
`;export{xe as default};
