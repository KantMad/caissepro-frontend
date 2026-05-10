import * as API from "./api.js";

/* ══════════ SECURITY — HTML sanitization ══════════ */
export const escapeHtml=(str)=>{if(!str)return"";return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");};

/* ══════════ SECURITY — PIN hashing ══════════ */
export const hashPin=async(pin)=>{const enc=new TextEncoder().encode(pin+"_caissepro_salt_v1");const buf=await crypto.subtle.digest("SHA-256",enc);return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");};
export const verifyPin=async(pin,hash)=>{if(!hash||hash==="****")return false;if(hash.length<60){return hash===pin;}const h=await hashPin(pin);return h===hash;};

/* ══════════ PRICING MODE HELPERS ══════════ */
// pricingMode: "TTC" = prices stored are TTC, "HT" = prices stored are HT
// When TTC: HT = price / (1 + taxRate), TVA = price - HT
// When HT:  TVA = price * taxRate, TTC = price + TVA
export const getPriceHT=(price,taxRate,mode)=>mode==="TTC"?price/(1+(taxRate||0.20)):price;
export const getPriceTTC=(price,taxRate,mode)=>mode==="TTC"?price:price*(1+(taxRate||0.20));

/* ══════════ NF525 — SHA-256 Hash (Web Crypto API) ══════════ */
export async function sha256(str){
  const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

/* ══════════ CATEGORY ICON ══════════ */
export const DEFAULT_CAT_ICONS={"T-shirts":"👕","Jeans":"👖","Robes":"👗","Pulls":"🧶","Chemises":"👔","Vestes":"🧥","Pantalons":"👖","Chaussures":"👟","Accessoires":"👜","Divers":"📦"};
export const catIcon=(cat,settingsIcons)=>{const ic={...DEFAULT_CAT_ICONS,...(settingsIcons||{})};return ic[cat]||"📦";};

/* ══════════ DATA NORMALIZERS ══════════ */
/*
 * Variant ordering — 2 layers:
 *  1) CSV import order per product (priority) — stored in variantOrderMap { sku: ["key1","key2",...] }
 *  2) Global size ranking fallback — stored in sizeRanking { "S":1, "M":2, "L":3, ... }
 *     Used when a product has NO CSV import order defined.
 *     Does NOT override the CSV import order.
 * Both are persisted in localStorage + backend settings.
 */

// ─── Per-product CSV import order ───
let _variantOrderMap=null;
export function getVariantOrderMap(){
  if(_variantOrderMap)return _variantOrderMap;
  try{const s=localStorage.getItem("caissepro_variant_order");if(s){_variantOrderMap=JSON.parse(s);return _variantOrderMap;}}catch(e){}
  return{};
}
export function saveVariantOrderMap(map){
  _variantOrderMap=map;
  try{localStorage.setItem("caissepro_variant_order",JSON.stringify(map));}catch(e){}
  try{API.settings.update({variantOrderMap:map}).catch(()=>{});}catch(e){}
}
export function loadVariantOrderFromSettings(s){
  if(s?.variantOrderMap&&typeof s.variantOrderMap==="object"){
    _variantOrderMap=s.variantOrderMap;
    try{localStorage.setItem("caissepro_variant_order",JSON.stringify(_variantOrderMap));}catch(e){}
  }
  if(s?.sizeRanking&&typeof s.sizeRanking==="object"){
    _sizeRanking=s.sizeRanking;
    try{localStorage.setItem("caissepro_size_ranking",JSON.stringify(_sizeRanking));}catch(e){}
  }
}
export function variantKey(v){return `${(v.color||"défaut").toLowerCase()}|${(v.size||"tu").toLowerCase()}`;}
export function setProductVariantOrder(productSku,variants){
  const map={...getVariantOrderMap()};
  map[productSku]=variants.map(v=>variantKey(v));
  saveVariantOrderMap(map);
}

// ─── Global size ranking (fallback) ───
export const DEFAULT_SIZE_RANKING={"XXS":1,"XS":2,"S":3,"M":4,"L":5,"XL":6,"XXL":7,"2XL":7,"3XL":8,"XXXL":8,"4XL":9,"5XL":10,"6XL":11,
  "TU":0,"U":0,"UNIQUE":0,"34":34,"36":36,"38":38,"40":40,"42":42,"44":44,"46":46,"48":48,"50":50,"52":52};
let _sizeRanking=null;
export function getSizeRanking(){
  if(_sizeRanking)return _sizeRanking;
  try{const s=localStorage.getItem("caissepro_size_ranking");if(s){_sizeRanking=JSON.parse(s);return _sizeRanking;}}catch(e){}
  _sizeRanking={...DEFAULT_SIZE_RANKING};return _sizeRanking;
}
export function saveSizeRanking(ranking){
  _sizeRanking=ranking;
  try{localStorage.setItem("caissepro_size_ranking",JSON.stringify(ranking));}catch(e){}
  try{API.settings.update({sizeRanking:ranking}).catch(()=>{});}catch(e){}
}
export function getSizeRank(size){
  const r=getSizeRanking();const key=(size||"").toUpperCase().trim();
  if(r[key]!=null)return r[key];
  const num=parseFloat(key);if(!isNaN(num))return num;
  return 9999;
}
// Auto-import sizes from products into the ranking (add missing sizes with auto-rank)
export function autoImportSizesFromProducts(prods){
  if(!prods||!prods.length)return;
  const ranking=getSizeRanking();let changed=false;
  const maxRank=Math.max(0,...Object.values(ranking));let nextRank=maxRank+1;
  prods.forEach(p=>{(p.variants||[]).forEach(v=>{
    const s=(v.size||"").toUpperCase().trim();
    if(s&&s!=="TU"&&s!=="—"&&s!==""&&ranking[s]==null){
      // Try to auto-assign a numeric rank if it looks like a number
      const num=parseFloat(s);
      if(!isNaN(num)){ranking[s]=num;}else{ranking[s]=nextRank++;} changed=true;}});});
  if(changed){saveSizeRanking(ranking);}
}

// ─── Normalizer ───
export const norm={
  product(p){
    const sku=p.sku||p.id||"";
    const csvOrder=(getVariantOrderMap())[sku];// array of keys if CSV import exists for this product
    const variants=(p.variants||[]).map((v,i)=>({...v,stock:parseInt(v.stock||0),stockAlert:parseInt(v.stock_alert||v.stockAlert||5),
      defective:parseInt(v.defective||0)}))
      .sort((a,b)=>{
        if(csvOrder){
          // Priority 1: CSV import order for this product
          const ia=csvOrder.indexOf(variantKey(a));const ib=csvOrder.indexOf(variantKey(b));
          const sa=ia>=0?ia:9999;const sb=ib>=0?ib:9999;
          if(sa!==sb)return sa-sb;
        }
        // Priority 2: Global size ranking (fallback when no CSV order)
        const ra=getSizeRank(a.size);const rb=getSizeRank(b.size);
        if(ra!==rb)return ra-rb;
        // Priority 3: sort_order from DB
        if(a.sort_order!=null&&b.sort_order!=null)return a.sort_order-b.sort_order;
        return 0;
      });
    return{...p,price:parseFloat(p.price),costPrice:parseFloat(p.cost_price||p.costPrice||0),
    taxRate:parseFloat(p.tax_rate||p.taxRate||0.20),category:p.category||"",collection:p.collection||"",variants}},
  customer(c){return{...c,firstName:c.first_name||c.firstName,lastName:c.last_name||c.lastName,
    totalSpent:parseFloat(c.total_spent||c.totalSpent||0),points:parseInt(c.points||0)}},
  products(list){return(list||[]).map(norm.product)},
  customers(list){return(list||[]).map(norm.customer)},
};

/* ══════════ BARCODE LABEL PRINTING ══════════ */
export function printBarcodeLabels(product,settings){
  const fmt=settings?.labelFormat||"50x30";const content=settings?.labelContent||"ean+price";
  const[w,h]=fmt.split("x").map(Number);
  const pm=settings?.pricingMode||"TTC";
  const variants=(product.variants||[]).filter(v=>v.ean);
  if(!variants.length){alert("Aucune variante avec code EAN. Ajoutez des EAN pour imprimer des étiquettes.");return;}
  // Generate barcode SVG using Code128-like simple rendering
  const encodeBarcode=(code)=>{
    const bars=[];let x=0;const narrow=1.5;const wide=3;
    // Simple EAN/Code display — use SVG text for the number and lines pattern
    for(let i=0;i<code.length;i++){const c=code.charCodeAt(i);
      const pattern=((c*7+i*13)%4===0)?[wide,narrow,narrow,wide]:[narrow,wide,wide,narrow];
      pattern.forEach((bw,j)=>{bars.push({x,w:bw,fill:j%2===0});x+=bw;});}
    return{bars,totalWidth:x};
  };
  const labels=variants.map(v=>{
    const ean=v.ean||"";const bc=encodeBarcode(ean);
    const showName=content.includes("name");const showPrice=content.includes("price");
    return`<div style="width:${w}mm;height:${h}mm;border:0.5px dashed #ccc;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;padding:1mm;box-sizing:border-box;page-break-inside:avoid;overflow:hidden">
      ${showName?`<div style="font-size:${Math.min(8,h/5)}px;font-weight:700;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;line-height:1.2">${escapeHtml(product.name)}</div>`:""}
      ${showName&&v.color?`<div style="font-size:${Math.min(6,h/7)}px;color:#666;line-height:1.1">${escapeHtml(v.color)} / ${escapeHtml(v.size)}</div>`:""}
      <svg viewBox="0 0 ${bc.totalWidth} 30" style="width:${w-4}mm;height:${h*0.4}mm;margin:0.5mm 0">
        ${bc.bars.filter(b=>b.fill).map(b=>`<rect x="${b.x}" y="0" width="${b.w}" height="30" fill="#000"/>`).join("")}
      </svg>
      <div style="font-size:${Math.min(7,h/5)}px;font-family:monospace;letter-spacing:1px;font-weight:600">${escapeHtml(ean)}</div>
      ${showPrice?`<div style="font-size:${Math.min(9,h/4)}px;font-weight:800;color:#000">${product.price.toFixed(2)}€ ${pm}</div>`:""}
    </div>`;
  });
  const win=window.open("","_blank","width=800,height=600");
  if(!win){alert("Popup bloqué — autorisez les popups pour imprimer les étiquettes");return;}
  win.document.write(`<!DOCTYPE html><html><head><title>Étiquettes — ${escapeHtml(product.name)}</title>
    <style>@page{margin:2mm}body{margin:0;font-family:Arial,sans-serif}
    .grid{display:flex;flex-wrap:wrap;gap:1mm;padding:2mm}
    @media print{.no-print{display:none!important}}</style></head><body>
    <div class="no-print" style="padding:10px;background:#f5f5f5;border-bottom:1px solid #ddd;display:flex;align-items:center;gap:10px">
      <button onclick="window.print()" style="padding:8px 20px;background:#047857;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">🖨️ Imprimer</button>
      <span style="font-size:12px;color:#666">${variants.length} étiquette(s) — ${fmt} mm — ${escapeHtml(product.name)}</span>
    </div>
    <div class="grid">${labels.join("")}</div></body></html>`);
  win.document.close();
}
