/* ══════════ COMPANY ══════════ */
export const CO={name:"Ma Boutique Textile",address:"12 rue de la Mode",postalCode:"75001",city:"Paris",
  siret:"123 456 789 00012",tvaIntra:"FR 12 345678900",phone:"01 23 45 67 89",sw:"Tech in Cash",ver:typeof __APP_VERSION__!=='undefined'?__APP_VERSION__:"7.0.0",
  logo:"",footerMsg:"Merci de votre visite !",legalForm:"SARL",capital:"10 000 €"};

/* ══════════ TVA RATES ══════════ */
export const DEFAULT_TVA_RATES=[{id:"normal",label:"Normal 20%",rate:0.20},{id:"inter",label:"Intermédiaire 10%",rate:0.10},{id:"reduit",label:"Réduit 5,5%",rate:0.055}];
export let TVA_RATES=[...DEFAULT_TVA_RATES];

/* ══════════ PERMISSIONS ══════════ */
export const PERMS={
  admin:{maxDiscount:100,canVoid:true,canExport:true,canSettings:true,canCloseZ:true,canCreateProduct:true,canViewMargin:true,canManagePromos:true},
  manager:{maxDiscount:50,canVoid:true,canExport:true,canSettings:false,canCloseZ:true,canCreateProduct:true,canViewMargin:true,canManagePromos:true},
  cashier:{maxDiscount:20,canVoid:false,canExport:false,canSettings:false,canCloseZ:false,canCreateProduct:false,canViewMargin:false,canManagePromos:false},
};

/* ══════════ DATA ══════════ */
// SEC-04: Removed hardcoded passwords. Offline login uses cached credentials from last successful online login.
export const initUsers=[];
export const LOYALTY_TIERS=[{minPoints:0,name:"Bronze",discount:0},{minPoints:100,name:"Argent",discount:5},{minPoints:250,name:"Or",discount:10},{minPoints:500,name:"Platine",discount:15}];
export const categories=["Tous","T-shirts","Jeans","Robes","Pulls","Chemises","Vestes"];

/* ══════════ DESIGN ══════════ */
const C_NORMAL={bg:"#F8FAFC",surface:"#FFFFFF",surfaceAlt:"#F1F5F9",surfaceHover:"#F8FAFC",text:"#0F172A",textMuted:"#64748B",textLight:"#94A3B8",
  primary:"#047857",primaryLight:"#ECFDF5",primaryDark:"#022C22",accent:"#D97706",accentLight:"#FFFBEB",
  danger:"#DC2626",dangerLight:"#FEF2F2",info:"#0369A1",infoLight:"#F0F9FF",border:"#E2E8F0",borderDark:"#CBD5E1",
  gradientB:"#059669",fiscal:"#0F766E",fiscalLight:"#F0FDFA",warn:"#D97706",warnLight:"#FFFBEB",
  shadow:"rgba(15,23,42,0.04)",shadowMd:"rgba(15,23,42,0.08)",shadowLg:"rgba(15,23,42,0.12)"};
// 4.4: High-contrast theme for accessibility
const C_HIGH_CONTRAST={bg:"#FFFFFF",surface:"#FFFFFF",surfaceAlt:"#F3F4F6",surfaceHover:"#E5E7EB",text:"#000000",textMuted:"#374151",textLight:"#4B5563",
  primary:"#065F46",primaryLight:"#D1FAE5",primaryDark:"#022C22",accent:"#92400E",accentLight:"#FEF3C7",
  danger:"#B91C1C",dangerLight:"#FEE2E2",info:"#1E40AF",infoLight:"#DBEAFE",border:"#9CA3AF",borderDark:"#6B7280",
  gradientB:"#047857",fiscal:"#0F766E",fiscalLight:"#CCFBF1",warn:"#92400E",warnLight:"#FEF3C7",
  shadow:"rgba(0,0,0,0.08)",shadowMd:"rgba(0,0,0,0.15)",shadowLg:"rgba(0,0,0,0.2)"};
let _highContrast=false;try{_highContrast=localStorage.getItem("caissepro_highcontrast")==="true";}catch(e){}
export let C=_highContrast?{...C_HIGH_CONTRAST}:{...C_NORMAL};
export function setHighContrast(on){_highContrast=on;Object.assign(C,on?C_HIGH_CONTRAST:C_NORMAL);try{localStorage.setItem("caissepro_highcontrast",String(on));}catch(e){}}
export function isHighContrast(){return _highContrast;}
export const CAT_COLORS={"T-shirts":"#0369A1","Jeans":"#047857","Robes":"#D97706","Pulls":"#7C3AED","Chemises":"#CA8A04","Vestes":"#DC2626","Divers":"#64748B"};

/* ══════════ CATEGORY ICON ══════════ */
export const DEFAULT_CAT_ICONS={"T-shirts":"👕","Jeans":"👖","Robes":"👗","Pulls":"🧶","Chemises":"👔","Vestes":"🧥","Pantalons":"👖","Chaussures":"👟","Accessoires":"👜","Divers":"📦"};
