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
    // Check if sort_order was explicitly set (not all null/0)
    const rawVariants=(p.variants||[]).map((v,i)=>({...v,stock:parseInt(v.stock||0),stockAlert:parseInt(v.stock_alert||v.stockAlert||5),
      defective:parseInt(v.defective||0),colorCode:v.color_code||v.colorCode||""}));
    const hasExplicitSortOrder=rawVariants.some(v=>v.sort_order!=null&&v.sort_order>0);
    const variants=rawVariants
      .sort((a,b)=>{
        if(csvOrder){
          // Priority 1: CSV import order for this product
          const ia=csvOrder.indexOf(variantKey(a));const ib=csvOrder.indexOf(variantKey(b));
          const sa=ia>=0?ia:9999;const sb=ib>=0?ib:9999;
          if(sa!==sb)return sa-sb;
        }
        // Priority 2: sort_order from DB (explicit user reorder action)
        if(hasExplicitSortOrder&&a.sort_order!=null&&b.sort_order!=null){
          if(a.sort_order!==b.sort_order)return a.sort_order-b.sort_order;
        }
        // Priority 3: Global size ranking (fallback when no explicit sort_order)
        // Sort by color first, then by size rank within same color
        const ca=(a.color||"").toLowerCase(),cb=(b.color||"").toLowerCase();
        if(ca!==cb)return ca<cb?-1:1;
        const ra=getSizeRank(a.size);const rb=getSizeRank(b.size);
        if(ra!==rb)return ra-rb;
        return 0;
      });
    return{...p,price:parseFloat(p.price),costPrice:parseFloat(p.cost_price||p.costPrice||0),
    taxRate:parseFloat(p.tax_rate||p.taxRate||0.20),category:p.category||"",collection:p.collection||"",variants}},
  customer(c){return{...c,firstName:c.first_name||c.firstName,lastName:c.last_name||c.lastName,
    totalSpent:parseFloat(c.total_spent||c.totalSpent||0),points:parseInt(c.points||0)}},
  products(list){return(list||[]).map(norm.product)},
  customers(list){return(list||[]).map(norm.customer)},
  avoir(a){return{...a,
    avoirNumber:a.avoirNumber||a.avoir_number||a.code||"",
    totalTTC:parseFloat(a.totalTTC||a.total_ttc||a.amount||0),
    totalHT:parseFloat(a.totalHT||a.total_ht||0),
    totalTVA:parseFloat(a.totalTVA||a.total_tva||0),
    remaining:parseFloat(a.remaining??a.totalTTC??a.total_ttc??a.amount??0),
    used:a.used??false,
    date:a.date||a.created_at,
    originalTicket:a.originalTicket||a.original_ticket||"",
    reason:a.reason||"",
    refundMethod:a.refundMethod||a.refund_method||"avoir",
    // Echange = avoir consomme immediatement par une nouvelle vente (calcul serveur)
    isExchange:a.isExchange??a.is_exchange??(a.refundMethod||a.refund_method)==="exchange",
    usedInTicket:a.usedInTicket||a.used_in_ticket||"",
    userName:a.userName||a.user_name||"",
    customerName:a.customerName||a.customer_name||"",
    barcode:a.barcode||"",
    items:(a.items||[]).map(i=>({...i,
      product:i.product||{id:i.product_id,name:i.product_name||i.name,sku:i.sku||""},
      variant:i.variant||{id:i.variant_id,color:i.variant_color,size:i.variant_size,ean:i.ean||"",colorCode:i.color_code||i.colorCode||""},
      quantity:i.quantity||i.qty||1,
      lineTTC:parseFloat(i.lineTTC||i.line_ttc||0)}))}},
  avoirs(list){return(list||[]).map(norm.avoir)},
  // Vente / ticket : accepte la forme API (snake_case) OU checkout (camelCase),
  // spread l'original (rien n'est perdu) + garantit les champs camelCase. Idempotent.
  sale(s){return{...s,
    ticketNumber:s.ticketNumber||s.ticket_number||"",
    seq:s.seq,
    totalHT:parseFloat(s.totalHT??s.total_ht??0)||0,
    totalTVA:parseFloat(s.totalTVA??s.total_tva??0)||0,
    totalTTC:parseFloat(s.totalTTC??s.total_ttc??0)||0,
    margin:parseFloat(s.margin??0)||0,
    globalDiscount:parseFloat(s.globalDiscount??s.global_discount??0)||0,
    grandTotal:parseFloat(s.grandTotal??s.grand_total??0)||0,
    date:s.date||s.createdAt||s.created_at||null,
    userName:s.userName||s.user_name||"",
    sellerName:s.sellerName||s.seller_name||null,
    paymentMethod:s.paymentMethod||s.payment_method||"",
    customerId:s.customerId||s.customer_id||null,
    customerName:s.customerName||s.customer_name||null,
    saleNote:s.saleNote||s.sale_note||null,
    fingerprint:s.fingerprint||"",
    hash:s.hash||s.ticket_hash||"",
    barcode:s.barcode||"",
    items:(s.items||[]).map(i=>({...i,
      product:i.product||{id:i.product_id,name:i.product_name||i.name,sku:i.sku||i.product_sku||"",
        category:i.category||"",collection:i.collection||""},
      variant:i.variant||{id:i.variant_id,color:i.variant_color,size:i.variant_size,ean:i.ean||i.variant_ean||"",colorCode:i.color_code||i.colorCode||""},
      quantity:i.quantity||i.qty||1,
      lineTTC:parseFloat(i.lineTTC??i.line_ttc??((i.unit_price||0)*(i.quantity||1)))||0,
      lineHT:parseFloat(i.lineHT??i.line_ht??0)||0,
      lineTVA:parseFloat(i.lineTVA??i.line_tva??0)||0,
      // Remise de ligne en euros (HT) : brut - net. Couvre les remises en % ET en euros,
      // car une remise en euros laisse discount_percent a 0 (migrations 028/029).
      lineDiscountHT:Math.max(0,Math.round(((parseFloat(i.unit_price??i.unitPrice??0)||0)*(i.quantity||i.qty||1)-(parseFloat(i.lineHT??i.line_ht??0)||0))*100)/100)})),
    payments:s.payments||[]}},
  sales(list){return(list||[]).map(norm.sale)},
  // Changement de prix : forme API (old_price string, product_name, user_name, created_at)
  // OU locale (oldPrice, productName, user, date). Spread + camelCase garanti. Idempotent.
  priceHistory(e){return{...e,
    id:e.id,
    productName:e.productName||e.product_name||e.name||"—",
    oldPrice:parseFloat(e.oldPrice??e.old_price??0)||0,
    newPrice:parseFloat(e.newPrice??e.new_price??0)||0,
    reason:e.reason||"",
    user:e.user||e.userName||e.user_name||"—",
    date:e.date||e.created_at||null}},
  priceHistories(list){return(list||[]).map(norm.priceHistory)},
};

/* ══════════ EAN-13 SVG BARCODE COMPONENT ══════════ */
// EAN-13 encoding tables
const EAN_L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
const EAN_G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
const EAN_R = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
const EAN_PARITY = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];

/* ══════════ EAN-13 BARCODE GENERATION ══════════ */
export function generateEAN13(prefix, seq) {
  // prefix: 3 digits (200=ventes, 201=avoirs, 202=cartes cadeau, 203=retouches)
  // seq: number to encode (will be padded to fill remaining digits)
  const seqStr = String(seq).padStart(9, '0').slice(-9);
  const digits12 = prefix + seqStr;
  // Compute check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits12[i]) * (i % 2 === 0 ? 1 : 3);
  return digits12 + String((10 - (sum % 10)) % 10);
}

// Motif binaire EAN-13 : 95 modules (garde 101 + 6 chiffres + garde centrale 01010
// + 6 chiffres + garde 101). Source unique : tickets, cartes cadeaux ET etiquettes.
export function ean13Bits(code) {
  if (!code || !/^\d{13}$/.test(String(code))) return "";
  const digits = String(code).split("").map(Number);
  const parity = EAN_PARITY[digits[0]];
  let bits = "101";
  for (let i = 0; i < 6; i++) bits += (parity[i] === "L" ? EAN_L : EAN_G)[digits[i + 1]];
  bits += "01010";
  for (let i = 0; i < 6; i++) bits += EAN_R[digits[i + 7]];
  return bits + "101";
}

// Verifie la cle de controle (13e chiffre) — un EAN faux ne doit jamais partir en etiquette.
export function isValidEAN13(code) {
  if (!code || !/^\d{13}$/.test(String(code))) return false;
  const d = String(code).split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += d[i] * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === d[12];
}

// Barres SVG (chaine HTML) a partir du motif — reutilise par toutes les impressions.
export function ean13Rects(code, width, height) {
  const bits = ean13Bits(code);
  if (!bits) return "";
  const barW = width / bits.length;
  let rects = "";
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === "1") rects += `<rect x="${(i * barW).toFixed(3)}" y="0" width="${barW.toFixed(3)}" height="${height}" fill="#000"/>`;
  }
  return rects;
}

export function EAN13Svg({ code, width = 180, height = 60 }) {
  const bits = ean13Bits(code);
  if (!bits) return null;
  const barW = width / bits.length;
  const bars = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === "1") bars.push(<rect key={i} x={i * barW} y={0} width={barW} height={height} fill="#000" />);
  }
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>{bars}</svg>
      <div style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: 2, marginTop: 2 }}>{code}</div>
    </div>
  );
}

// EAN-13 SVG as HTML string (for popup windows)
export function ean13SvgHtml(code, width = 180, height = 60) {
  const rects = ean13Rects(code, width, height);
  if (!rects) return "";
  return `<div style="text-align:center;margin-top:8px"><svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${rects}</svg><div style="font-family:monospace;font-size:11px;letter-spacing:2px;margin-top:2px">${code}</div></div>`;
}

/* ══════════ ETIQUETTES CODE-BARRES ══════════ */
// Formats courants d'etiquettes textile (largeur x hauteur en mm)
export const LABEL_FORMATS = [
  { id: "30x20", w: 30, h: 20, l: "30 x 20 mm — petite" },
  { id: "40x30", w: 40, h: 30, l: "40 x 30 mm — standard" },
  { id: "50x30", w: 50, h: 30, l: "50 x 30 mm — large" },
  { id: "60x40", w: 60, h: 40, l: "60 x 40 mm — grande" },
];

/**
 * Construit le HTML d'une planche d'etiquettes.
 * @param {Array} lignes - [{ productName, sku, color, colorCode, size, ean, price, qty }]
 * @param {Object} opts - { format:"40x30", name, colorSize, price, sku, pricingMode }
 * Le code-barres est un VRAI EAN-13 (meme encodage que les tickets) : scannable.
 */
export function buildLabelsHtml(lignes, opts = {}) {
  const fmt = LABEL_FORMATS.find(f => f.id === (opts.format || "40x30")) || LABEL_FORMATS[1];
  const { w, h } = fmt;
  const pm = opts.pricingMode === "HT" ? "HT" : "TTC";
  const cards = [];
  let ignorees = 0;
  for (const l of lignes) {
    if (!isValidEAN13(l.ean)) { ignorees += Math.max(1, l.qty || 1); continue; }
    // Code-barres : ~55 % de la hauteur, hauteur minimale de 8 mm pour rester lisible
    const bcH = Math.max(8, h * 0.45), bcW = w - 6;
    const rects = ean13Rects(l.ean, 100, 30);
    const variante = [l.color, l.size].filter(Boolean).join(" / ") + (l.colorCode ? ` (${l.colorCode})` : "");
    const card = `<div class="lbl" style="width:${w}mm;height:${h}mm">
      ${opts.name && l.productName ? `<div class="nom">${escapeHtml(l.productName)}</div>` : ""}
      ${opts.colorSize && variante.trim() ? `<div class="var">${escapeHtml(variante)}</div>` : ""}
      ${opts.sku && l.sku ? `<div class="sku">${escapeHtml(l.sku)}</div>` : ""}
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" style="width:${bcW}mm;height:${bcH}mm">${rects}</svg>
      <div class="ean">${escapeHtml(l.ean)}</div>
      ${opts.price && l.price != null ? `<div class="prix">${Number(l.price).toFixed(2)}€ ${pm}</div>` : ""}
    </div>`;
    for (let i = 0; i < Math.max(1, l.qty || 1); i++) cards.push(card);
  }
  const style = `@page{size:auto;margin:3mm}
    body{margin:0;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact}
    .grid{display:flex;flex-wrap:wrap;gap:1.5mm;padding:2mm;align-content:flex-start}
    .lbl{border:0.2mm solid #eee;display:flex;flex-direction:column;align-items:center;justify-content:center;
      padding:0.8mm;box-sizing:border-box;overflow:hidden;page-break-inside:avoid;text-align:center}
    .nom{font-size:${Math.min(8, h / 3.5).toFixed(1)}pt;font-weight:700;line-height:1.1;max-width:100%;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .var{font-size:${Math.min(7, h / 4.5).toFixed(1)}pt;color:#333;line-height:1.1}
    .sku{font-size:${Math.min(6.5, h / 5).toFixed(1)}pt;font-family:monospace;color:#555;line-height:1.1}
    .ean{font-size:${Math.min(7, h / 4.5).toFixed(1)}pt;font-family:monospace;letter-spacing:0.4pt;line-height:1.2}
    .prix{font-size:${Math.min(11, h / 2.8).toFixed(1)}pt;font-weight:800;line-height:1.1}
    @media print{.no-print{display:none!important}.lbl{border:none}}`;
  return { html: `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Étiquettes</title><style>${style}</style></head>
    <body><div class="no-print" style="padding:10px;background:#f5f5f5;border-bottom:1px solid #ddd;display:flex;align-items:center;gap:12px">
      <button onclick="window.print()" style="padding:8px 20px;background:#047857;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Imprimer</button>
      <span style="font-size:12px;color:#666">${cards.length} étiquette(s) — ${fmt.l}${ignorees ? ` — ${ignorees} ignorée(s) : code-barres manquant ou invalide` : ""}</span>
    </div><div class="grid">${cards.join("")}</div></body></html>`, count: cards.length, ignorees };
}

// Ouvre la planche d'etiquettes dans un onglet (impression via le pilote de l'imprimante).
export function printLabels(lignes, opts = {}) {
  const { html, count, ignorees } = buildLabelsHtml(lignes, opts);
  if (!count) return { count: 0, ignorees };
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return { count: 0, ignorees, popupBloque: true };
  win.document.write(html);
  win.document.close();
  return { count, ignorees };
}

// Fiche produit : une etiquette par declinaison ayant un code-barres.
export function printBarcodeLabels(product, settings) {
  const lignes = (product.variants || []).map(v => ({
    productName: product.name, sku: product.sku, color: v.color, colorCode: v.colorCode || v.color_code,
    size: v.size, ean: v.ean, price: product.price, qty: 1,
  }));
  const content = settings?.labelContent || "ean+price";
  return printLabels(lignes, {
    format: settings?.labelFormat || "40x30",
    name: content.includes("name"), colorSize: true, sku: true,
    price: content.includes("price"), pricingMode: settings?.pricingMode,
  });
}
