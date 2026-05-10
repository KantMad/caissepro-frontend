/* ══════════ COMPANY ══════════ */
export const CO={name:"Ma Boutique Textile",address:"12 rue de la Mode",postalCode:"75001",city:"Paris",
  siret:"123 456 789 00012",tvaIntra:"FR 12 345678900",phone:"01 23 45 67 89",sw:"CaissePro",ver:"5.0.0",
  logo:"",footerMsg:"Merci de votre visite !",legalForm:"SARL",capital:"10 000 €"};

/* ══════════ TVA RATES ══════════ */
export const DEFAULT_TVA_RATES=[{id:"normal",label:"Normal 20%",rate:0.20},{id:"inter",label:"Intermédiaire 10%",rate:0.10},{id:"reduit",label:"Réduit 5,5%",rate:0.055}];
export let TVA_RATES=[...DEFAULT_TVA_RATES];

/* ══════════ PERMISSIONS ══════════ */
export const PERMS={
  admin:{maxDiscount:100,canVoid:true,canExport:true,canSettings:true,canCloseZ:true,canCreateProduct:true,canViewMargin:true,canManagePromos:true},
  cashier:{maxDiscount:20,canVoid:false,canExport:false,canSettings:false,canCloseZ:true,canCreateProduct:false,canViewMargin:false,canManagePromos:false},
};

/* ══════════ DATA ══════════ */
export const initProducts=[
  {id:"1",name:"T-shirt Basique",sku:"TS-001",price:29.90,costPrice:12.00,taxRate:0.20,category:"T-shirts",collection:"PE-2026",
    variants:[{id:"v1",color:"Blanc",size:"S",ean:"3760123450011",stock:15,defective:0,stockAlert:5},
      {id:"v2",color:"Blanc",size:"M",ean:"3760123450012",stock:20,defective:0,stockAlert:5},
      {id:"v3",color:"Noir",size:"M",ean:"3760123450022",stock:18,defective:0,stockAlert:5},
      {id:"v4",color:"Noir",size:"L",ean:"3760123450023",stock:2,defective:0,stockAlert:5}]},
  {id:"2",name:"Jean Slim",sku:"JN-001",price:79.90,costPrice:32.00,taxRate:0.20,category:"Jeans",collection:"PE-2026",
    variants:[{id:"v7",color:"Bleu",size:"38",ean:"3760123460012",stock:12,defective:0,stockAlert:3},
      {id:"v9",color:"Bleu",size:"40",ean:"3760123460013",stock:1,defective:0,stockAlert:3},
      {id:"v10",color:"Noir",size:"38",ean:"3760123460022",stock:9,defective:0,stockAlert:3}]},
  {id:"3",name:"Robe Été",sku:"RB-001",price:59.90,costPrice:22.00,taxRate:0.20,category:"Robes",collection:"PE-2026",
    variants:[{id:"v13",color:"Fleurie",size:"S",ean:"3760123470011",stock:5,defective:0,stockAlert:3},
      {id:"v14",color:"Fleurie",size:"M",ean:"3760123470012",stock:8,defective:0,stockAlert:3}]},
  {id:"4",name:"Pull Mérinos",sku:"PL-001",price:49.90,costPrice:20.00,taxRate:0.20,category:"Pulls",collection:"AH-2025",
    variants:[{id:"v18",color:"Gris",size:"M",ean:"3760123480011",stock:10,defective:0,stockAlert:3},
      {id:"v20",color:"Beige",size:"M",ean:"3760123480021",stock:2,defective:0,stockAlert:3}]},
  {id:"5",name:"Chemise Lin",sku:"CH-001",price:69.90,costPrice:28.00,taxRate:0.10,category:"Chemises",collection:"PE-2026",
    variants:[{id:"v22",color:"Blanc",size:"M",ean:"3760123490012",stock:11,defective:0,stockAlert:3}]},
  {id:"6",name:"Veste Blazer",sku:"VT-001",price:129.90,costPrice:52.00,taxRate:0.20,category:"Vestes",collection:"AH-2025",
    variants:[{id:"v30",color:"Noir",size:"M",ean:"3760123510011",stock:4,defective:0,stockAlert:2}]},
];
export const initUsers=[{id:"1",name:"Admin",password:"1234",role:"admin"},{id:"2",name:"Sophie",password:"1234",role:"cashier"},{id:"3",name:"Marc",password:"1234",role:"cashier"}];
export const initCustomers=[
  {id:"1",firstName:"Marie",lastName:"Dupont",email:"marie.dupont@email.com",phone:"0612345678",city:"Paris",points:120,totalSpent:450,notes:"Préfère les couleurs claires, taille M"},
  {id:"2",firstName:"Jean",lastName:"Martin",email:"jean.martin@email.com",phone:"0623456789",city:"Lyon",points:85,totalSpent:320,notes:""},
  {id:"3",firstName:"Sophie",lastName:"Bernard",email:"sophie.bernard@email.com",phone:"0634567890",city:"Paris",points:200,totalSpent:780,notes:"Cliente VIP, achète chaque saison"},
];
export const LOYALTY_TIERS=[{minPoints:0,name:"Bronze",discount:0},{minPoints:100,name:"Argent",discount:5},{minPoints:250,name:"Or",discount:10},{minPoints:500,name:"Platine",discount:15}];
export const initPromos=[
  {id:"1",name:"Soldes été -30%",type:"collection_discount",value:30,collection:"PE-2026",active:true,startDate:"2026-06-25",endDate:"2026-08-05",code:""},
  {id:"2",name:"3 achetés = -20%",type:"qty_discount",minQty:3,value:20,active:false,code:"",collection:"",startDate:"",endDate:""},
  {id:"3",name:"Code WELCOME10",type:"code",value:10,code:"WELCOME10",active:true,collection:"",startDate:"",endDate:""},
];
export const categories=["Tous","T-shirts","Jeans","Robes","Pulls","Chemises","Vestes"];

/* ══════════ DESIGN ══════════ */
export const C={bg:"#F8FAFC",surface:"#FFFFFF",surfaceAlt:"#F1F5F9",surfaceHover:"#F8FAFC",text:"#0F172A",textMuted:"#64748B",textLight:"#94A3B8",
  primary:"#047857",primaryLight:"#ECFDF5",primaryDark:"#022C22",accent:"#D97706",accentLight:"#FFFBEB",
  danger:"#DC2626",dangerLight:"#FEF2F2",info:"#0369A1",infoLight:"#F0F9FF",border:"#E2E8F0",borderDark:"#CBD5E1",
  gradientB:"#059669",fiscal:"#0F766E",fiscalLight:"#F0FDFA",warn:"#D97706",warnLight:"#FFFBEB",
  shadow:"rgba(15,23,42,0.04)",shadowMd:"rgba(15,23,42,0.08)",shadowLg:"rgba(15,23,42,0.12)"};
export const CAT_COLORS={"T-shirts":"#0369A1","Jeans":"#047857","Robes":"#D97706","Pulls":"#7C3AED","Chemises":"#CA8A04","Vestes":"#DC2626","Divers":"#64748B"};

/* ══════════ CATEGORY ICON ══════════ */
export const DEFAULT_CAT_ICONS={"T-shirts":"👕","Jeans":"👖","Robes":"👗","Pulls":"🧶","Chemises":"👔","Vestes":"🧥","Pantalons":"👖","Chaussures":"👟","Accessoires":"👜","Divers":"📦"};
