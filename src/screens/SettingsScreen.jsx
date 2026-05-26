import React, { useState, useEffect, useRef, useCallback } from "react";
import { Trash2, CreditCard, Plus, XCircle, RotateCcw, Euro, AlertTriangle, Save, Activity, Printer, Box, Star, Grid, ScanLine, Check, X, Scissors, Monitor, Wifi, Code, Receipt, Upload } from "lucide-react";
import * as API from "../api.js";
import printer from "../printer.js";
import { C, setHighContrast, isHighContrast } from "../constants.jsx";
import { DEFAULT_CAT_ICONS, getVariantOrderMap, saveVariantOrderMap, DEFAULT_SIZE_RANKING, getSizeRanking, saveSizeRanking, norm } from "../utils.jsx";
import { Btn, Input, Badge } from "../ui.jsx";
import { useApp } from "../context.jsx";
import hardwareManager from "../hardware.js";

function SizeSettingsTab({notify}){
  const[newSizeInput,setNewSizeInput]=useState("");
  const ranking=getSizeRanking();
  const entries=Object.entries(ranking).sort((a,b)=>a[1]-b[1]);
  const csvMap=getVariantOrderMap();
  const csvProductCount=Object.keys(csvMap).length;

  const updateRank=(size,newRank)=>{const r={...ranking,[size]:parseFloat(newRank)||0};saveSizeRanking(r);notify("Ranking sauvegardé","success");};
  const removeSize=(size)=>{const r={...ranking};delete r[size];saveSizeRanking(r);notify("Taille supprimée","success");};
  const addSize=()=>{if(!newSizeInput.trim())return;
    const key=newSizeInput.toUpperCase().trim();if(ranking[key]!=null){notify("Cette taille existe déjà","error");return;}
    const maxR=entries.length?Math.max(...entries.map(e=>e[1]))+1:1;
    const r={...ranking,[key]:maxR};saveSizeRanking(r);setNewSizeInput("");notify("Taille ajoutée","success");};
  const resetToDefault=()=>{saveSizeRanking({...DEFAULT_SIZE_RANKING});notify("Ranking réinitialisé aux valeurs par défaut","info");};

  return(<div style={{maxWidth:650}}>
    <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
        <Grid size={20} color={C.primary}/>
        <div><h3 style={{fontSize:16,fontWeight:800,margin:0}}>Ranking des tailles</h3>
          <p style={{fontSize:11,color:C.textMuted,margin:0}}>Ordre par défaut des tailles (S=3, M=4, L=5...). Utilisé quand un produit n'a pas d'ordre CSV spécifique.</p></div></div></div>

    <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <h4 style={{fontSize:13,fontWeight:700,margin:0}}>Tailles et positions ({entries.length})</h4>
        <div style={{display:"flex",gap:6}}>
          <Input value={newSizeInput} onChange={e=>setNewSizeInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSize()} placeholder="Ex: 3XL" style={{width:80,height:28,fontSize:10,padding:"2px 6px"}}/>
          <Btn variant="outline" onClick={addSize} style={{fontSize:10,padding:"4px 10px"}}><Plus size={11}/> Ajouter</Btn>
          <Btn variant="outline" onClick={resetToDefault} style={{fontSize:10,padding:"4px 10px",borderColor:C.danger+"44",color:C.danger}}><RotateCcw size={11}/> Défaut</Btn></div></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:6}}>
        {entries.map(([size,rank])=>(
          <div key={size} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:10,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
            <span style={{fontSize:13,fontWeight:700,minWidth:40}}>{size}</span>
            <span style={{fontSize:10,color:C.textMuted}}>=</span>
            <input type="number" value={rank} onChange={e=>updateRank(size,e.target.value)}
              style={{width:45,padding:"3px 5px",borderRadius:6,border:`1.5px solid ${C.border}`,fontSize:12,fontWeight:600,textAlign:"center",fontFamily:"inherit"}}/>
            <button onClick={()=>removeSize(size)} style={{width:20,height:20,borderRadius:5,border:"none",background:C.dangerLight,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><X size={10} color={C.danger}/></button>
          </div>))}
      </div>
    </div>

    {csvProductCount>0&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div><h4 style={{fontSize:13,fontWeight:700,margin:0}}>Ordre CSV par produit</h4>
          <p style={{fontSize:10,color:C.textMuted,margin:0}}>{csvProductCount} produit(s) avec un ordre CSV spécifique (prioritaire sur le ranking)</p></div>
        <Btn variant="outline" onClick={()=>{saveVariantOrderMap({});notify("Ordres CSV réinitialisés","info");}} style={{fontSize:10,padding:"4px 10px",borderColor:C.danger+"44",color:C.danger}}><RotateCcw size={11}/> Effacer CSV</Btn></div>
      <div style={{maxHeight:150,overflowY:"auto"}}>
        {Object.entries(csvMap).slice(0,20).map(([sku,order])=>(
          <div key={sku} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderBottom:`1px solid ${C.border}`,fontSize:11}}>
            <span style={{fontWeight:700,minWidth:100}}>{sku}</span>
            <span style={{color:C.textMuted,flex:1}}>{order.map(k=>k.includes("|")?k.split("|")[1]:k).join(" → ")}</span>
          </div>))}
        {csvProductCount>20&&<div style={{fontSize:10,color:C.textMuted,padding:6}}>… et {csvProductCount-20} autres</div>}
      </div>
    </div>}

    <div style={{background:C.warnLight,borderRadius:12,padding:14,border:`1px solid ${C.warn}33`,display:"flex",gap:10,alignItems:"start"}}>
      <AlertTriangle size={16} color={C.warn} style={{flexShrink:0,marginTop:2}}/>
      <div style={{fontSize:11,color:"#92400E",lineHeight:1.5}}>
        <strong>Priorité :</strong> L'import CSV définit l'ordre pour chaque produit importé (prioritaire). Pour les produits sans import CSV, le ranking ci-dessus est utilisé (S avant M avant L, etc.).
        Tout est synchronisé avec le backend.</div></div>
  </div>);
}

/* ══════════ DEBUG PANEL — Full diagnostic suite for Sunmi T2s ══════════ */
function DebugPanel(){
  const{tickets,printerConnected,hwId,paymentId,paymentConfig,settings,avoirs,closures}=useApp();
  const[logs,setLogs]=useState([]);
  const[running,setRunning]=useState(false);
  const[debugTab,setDebugTab]=useState("general");
  const[tpeIp,setTpeIp]=useState(paymentConfig?.tpeHost||"");
  const[tpePort,setTpePort]=useState(paymentConfig?.tpePort||"8888");
  const[tpeAmount,setTpeAmount]=useState("1.00");
  const logRef=React.useRef(null);

  const addLog=(msg,type="info")=>{
    const ts=new Date().toLocaleTimeString("fr-FR");
    setLogs(prev=>[...prev,{ts,msg,type}].slice(-200));
    setTimeout(()=>{if(logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight;},50);
  };
  const clearLogs=()=>setLogs([]);

  // ══════════════════════════════════════════════
  // GENERAL DIAGNOSTIC
  // ══════════════════════════════════════════════
  const runDiag=async()=>{
    setRunning(true);clearLogs();
    addLog("=== DIAGNOSTIC COMPLET ===","title");
    addLog(`Hardware ID: ${hwId}`);
    addLog(`User Agent: ${navigator.userAgent.substring(0,100)}`);
    addLog(`Capacitor: ${!!window.Capacitor} | Native: ${!!window.Capacitor?.isNativePlatform?.()}`);
    addLog(`Plugins: ${Object.keys(window.Capacitor?.Plugins||{}).join(", ")||"AUCUN"}`);
    addLog(`Mode paiement: ${paymentId} | Config: ${JSON.stringify(paymentConfig||{})}`);
    addLog(`Tickets: ${tickets?.length||0} | Avoirs: ${avoirs?.length||0} | Clotures: ${closures?.length||0}`);

    try{
      const hm=(await import("../hardware.js")).default;
      addLog("--- Hardware Manager ---","title");
      addLog(`Printer: ${hm.printer?.constructor?.name} | connected: ${hm.printer?.connected} | isCapacitor: ${hm.printer?._isCapacitor}`);
      addLog(`Payment: ${hm.payment?.constructor?.name} | paymentId: ${hm.paymentId}`);
      addLog(`Scanner: ${hm.scanner?"OUI":"NON"} | Drawer: ${hm.cashDrawer?"OUI":"NON"}`);
    }catch(e){addLog(`HM error: ${e.message}`,"error");}

    addLog("--- Erreurs JS en memoire ---","title");
    const errs=window.__CAISSEPRO_ERRORS||[];
    addLog(`${errs.length} erreur(s) capturee(s)`,errs.length>0?"error":"success");
    errs.slice(-5).forEach(e=>addLog(`  ${e.msg}`,"error"));

    addLog("=== FIN ===","title");
    setRunning(false);
  };

  // ══════════════════════════════════════════════
  // PRINTER TESTS
  // ══════════════════════════════════════════════
  const testPrinterStatus=async()=>{
    setRunning(true);clearLogs();
    addLog("=== DIAGNOSTIC IMPRIMANTE ===","title");
    const sp=window.Capacitor?.Plugins?.SunmiPrinter;
    if(!sp){addLog("Plugin SunmiPrinter ABSENT","error");setRunning(false);return;}
    addLog(`Methods: ${Object.keys(sp).filter(k=>typeof sp[k]==="function").join(", ")}`);
    try{
      const st=await sp.getStatus();
      addLog(`Status complet: ${JSON.stringify(st,null,1)}`);
      const stateColors={1:"success",2:"error",3:"error",4:"error",5:"error"};
      addLog(`Etat: ${st.printerState} = ${st.printerStateLabel}`,stateColors[st.printerState]||"info");
      if(st.printerState===2){
        addLog("PREPARING = imprimante pas prete.","error");
        addLog("Tentative d attente (10s max)...","info");
        try{
          const wr=await sp.waitForReady({timeout:10000});
          if(wr.ready)addLog(`Prete apres ${wr.waitedMs}ms!`,"success");
          else addLog(`Toujours pas prete apres ${wr.waitedMs}ms (state=${wr.state})`,"error");
        }catch(e){addLog(`waitForReady erreur: ${e.message}`,"error");}
      }
      if(st.printerState===1)addLog("NORMAL = imprimante prete!","success");
    }catch(e){addLog(`Erreur: ${e.message}`,"error");}
    setRunning(false);
  };

  const testSelfCheck=async()=>{
    setRunning(true);clearLogs();
    addLog("=== SELF-CHECK HARDWARE ===","title");
    addLog("Ceci lance la page de test interne de l imprimante Sunmi.","info");
    addLog("Si RIEN ne sort: le papier est a l envers!","warn");
    addLog("Si une page sort: le hardware marche, probleme logiciel.","info");
    const sp=window.Capacitor?.Plugins?.SunmiPrinter;
    if(!sp){addLog("Plugin SunmiPrinter ABSENT","error");setRunning(false);return;}
    try{
      const r=await sp.selfCheck();
      addLog(`Resultat: ${JSON.stringify(r)}`,"success");
      addLog("Regardez l imprimante...","title");
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}
    setRunning(false);
  };

  const testPrinterPrint=async()=>{
    setRunning(true);clearLogs();
    addLog("=== TEST IMPRESSION (5 methodes) ===","title");
    const sp=window.Capacitor?.Plugins?.SunmiPrinter;
    if(!sp){addLog("Plugin absent","error");setRunning(false);return;}

    // Check state first
    try{const st=await sp.getStatus();addLog(`Etat: ${st.printerState} (${st.printerStateLabel})`);}catch(e){}

    // Method 1: testPrint natif
    addLog("--- Methode 1: testPrint() natif ---","title");
    try{const r=await sp.testPrint({});addLog(`Resultat: ${JSON.stringify(r)}`,"success");}
    catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    // Method 2: printBatch
    addLog("--- Methode 2: printBatch() ---","title");
    try{const r=await sp.printBatch({commands:[
      {cmd:"text",text:"=== PRINTBATCH TEST ===\n"},{cmd:"text",text:`Date: ${new Date().toLocaleString("fr-FR")}\n`},
      {cmd:"text",text:"Si ce texte sort, printBatch marche!\n"},{cmd:"feed",lines:4},{cmd:"cut"}
    ]});addLog(`Resultat: ${JSON.stringify(r)}`,"success");}
    catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    // Method 3: printText simple
    addLog("--- Methode 3: printText() simple ---","title");
    try{await sp.printerInit({});await sp.printText({text:"TEST PRINTTEXT SIMPLE\n"});await sp.lineWrap({lines:4});addLog("OK (pas d'erreur)","success");}
    catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    // Method 4: sendRAWData ESC/POS brut
    addLog("--- Methode 4: sendRAWData() ESC/POS brut ---","title");
    try{
      // Build raw ESC/POS: init + text + feed
      const text="TEST ESC/POS RAW - Texte brut!\n";
      const bytes=[];
      bytes.push(0x1B,0x40); // ESC @ init
      for(let i=0;i<text.length;i++)bytes.push(text.charCodeAt(i));
      bytes.push(0x1B,0x64,0x04); // ESC d 4 = feed 4 lines
      const b64=btoa(String.fromCharCode(...bytes));
      await sp.sendRAWData({data:b64});
      addLog("OK (pas d'erreur)","success");
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    // Method 5: reconnect then print
    addLog("--- Methode 5: reconnect + printBatch ---","title");
    try{
      addLog("Reconnexion...");
      await sp.reconnect();
      await new Promise(r=>setTimeout(r,3000));
      const st=await sp.getStatus();
      addLog(`Etat apres reconnect: ${st.printerState} (${st.printerStateLabel})`);
      const r=await sp.printBatch({commands:[
        {cmd:"text",text:"=== APRES RECONNECT ===\n"},{cmd:"text",text:"Impression post-reconnexion\n"},{cmd:"feed",lines:4}
      ]});addLog(`Resultat: ${JSON.stringify(r)}`,"success");
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    addLog("--- VERDICT ---","title");
    addLog("Si AUCUN texte n'est sorti malgre tous les 'success':","error");
    addLog("1. RETOURNEZ LE PAPIER dans l'imprimante","error");
    addLog("2. Grattez le papier avec l'ongle: le cote qui noircit = face vers le haut","error");
    addLog("3. Ouvrez/fermez le couvercle","error");
    addLog("4. Redemarrez completement la Sunmi T2s","error");
    setRunning(false);
  };

  // ══════════════════════════════════════════════
  // TEST TICKET FORMATE (avec bold/size/align)
  // ══════════════════════════════════════════════
  const testFormattedPrint=async()=>{
    setRunning(true);clearLogs();
    addLog("=== TEST IMPRESSION FORMATEE ===","title");
    const sp=window.Capacitor?.Plugins?.SunmiPrinter;
    if(!sp){addLog("Plugin absent","error");setRunning(false);return;}

    // Test A: text-only ticket (no bold/size/align)
    addLog("--- Test A: Ticket TEXTE SEUL (sans formatage) ---","title");
    try{
      const r=await sp.printBatch({commands:[
        {cmd:"text",text:"================================\n"},
        {cmd:"text",text:"       MA BOUTIQUE TEST\n"},
        {cmd:"text",text:"   123 Rue du Commerce\n"},
        {cmd:"text",text:"================================\n"},
        {cmd:"text",text:"N: TK-999  13/05/2026 14:30\n"},
        {cmd:"text",text:"Caissier: Admin\n"},
        {cmd:"text",text:"--------------------------------\n"},
        {cmd:"text",text:"Pantalon Jean (Bleu/M)\n"},
        {cmd:"text",text:"  x1  49.90 EUR\n"},
        {cmd:"text",text:"T-Shirt Coton (Noir/L)\n"},
        {cmd:"text",text:"  x2  39.80 EUR\n"},
        {cmd:"text",text:"--------------------------------\n"},
        {cmd:"text",text:"Total HT     74.75 EUR\n"},
        {cmd:"text",text:"TVA          14.95 EUR\n"},
        {cmd:"text",text:"TOTAL TTC    89.70 EUR\n"},
        {cmd:"text",text:"Paiement: CB 89.70 EUR\n"},
        {cmd:"text",text:"================================\n"},
        {cmd:"feed",lines:4},{cmd:"cut"}
      ]});
      addLog(`OK: ${JSON.stringify(r)}`,"success");
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    // Test B: with align + size (no bold)
    addLog("--- Test B: Avec ALIGN + SIZE (sans bold) ---","title");
    try{
      const r=await sp.printBatch({commands:[
        {cmd:"align",value:1},{cmd:"size",value:28},
        {cmd:"text",text:"MA BOUTIQUE\n"},
        {cmd:"size",value:20},
        {cmd:"text",text:"Rue du Commerce\n"},
        {cmd:"align",value:0},{cmd:"size",value:20},
        {cmd:"text",text:"--------------------------------\n"},
        {cmd:"text",text:"Article test  49.90 EUR\n"},
        {cmd:"text",text:"TOTAL TTC     49.90 EUR\n"},
        {cmd:"feed",lines:4},{cmd:"cut"}
      ]});
      addLog(`OK: ${JSON.stringify(r)}`,"success");
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    // Test C: with bold (now simulated via size bump, no sendRAWData)
    addLog("--- Test C: Avec BOLD (simule par taille+2) ---","title");
    try{
      const r=await sp.printBatch({commands:[
        {cmd:"bold",enabled:true},
        {cmd:"text",text:"TEXTE EN GRAS (taille+2)\n"},
        {cmd:"bold",enabled:false},
        {cmd:"text",text:"Texte normal\n"},
        {cmd:"feed",lines:4},{cmd:"cut"}
      ]});
      addLog(`OK: ${JSON.stringify(r)}`,"success");
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    // Test D: full formatted (like real ticket)
    addLog("--- Test D: Ticket COMPLET (align+size+bold+line) ---","title");
    try{
      const r=await sp.printBatch({commands:[
        {cmd:"align",value:1},{cmd:"size",value:28},{cmd:"bold",enabled:true},
        {cmd:"text",text:"MA BOUTIQUE\n"},
        {cmd:"size",value:20},{cmd:"bold",enabled:false},
        {cmd:"text",text:"123 Rue du Commerce\n"},
        {cmd:"text",text:"75001 Paris\n"},
        {cmd:"line",char:"=",len:32},
        {cmd:"align",value:0},{cmd:"bold",enabled:true},
        {cmd:"text",text:"N: TK-TEST  13/05/2026\n"},
        {cmd:"bold",enabled:false},
        {cmd:"text",text:"Caissier: Admin\n"},
        {cmd:"line",char:"-",len:32},
        {cmd:"bold",enabled:true},
        {cmd:"text",text:"Jean Slim (Bleu/38)\n"},
        {cmd:"bold",enabled:false},
        {cmd:"text",text:"  x1  59.90 EUR\n"},
        {cmd:"line",char:"-",len:32},
        {cmd:"bold",enabled:true},{cmd:"size",value:28},
        {cmd:"text",text:"TOTAL TTC    59.90 EUR\n"},
        {cmd:"size",value:20},{cmd:"bold",enabled:false},
        {cmd:"text",text:"Paiement: CB 59.90 EUR\n"},
        {cmd:"line",char:"=",len:32},
        {cmd:"align",value:1},{cmd:"size",value:18},
        {cmd:"text",text:"EMPREINTE NF525\n"},
        {cmd:"text",text:"ABC123DEF456\n"},
        {cmd:"feed",lines:4},{cmd:"cut"}
      ]});
      addLog(`OK: ${JSON.stringify(r)}`,"success");
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    addLog("--- DIAGNOSTIC ---","title");
    addLog("A sort + B/C/D non = le formatage (size/align) bloque","error");
    addLog("A+B+C sortent + D non = trop de commandes ou combinaison","error");
    addLog("Tout sort = suppression sendRAWData a corrige le probleme!","success");
    setRunning(false);
  };

  // ══════════════════════════════════════════════
  // TEST PRINT RAW ESC/POS (bypass AIDL)
  // ══════════════════════════════════════════════
  const testPrintRaw=async()=>{
    setRunning(true);clearLogs();
    addLog("=== TEST ESC/POS RAW (bypass AIDL complet) ===","title");
    const sp=window.Capacitor?.Plugins?.SunmiPrinter;
    if(!sp){addLog("Plugin absent","error");setRunning(false);return;}
    if(!sp.printRaw){addLog("Methode printRaw absente — APK pas a jour?","error");setRunning(false);return;}

    addLog("Le service AIDL est en PREPARING (state=2).","info");
    addLog("printText/setFontSize sont ignores dans cet etat.","info");
    addLog("sendRAWData (ESC/POS brut) bypasse ce blocage.","info");

    // Test 1: simple text via printRaw
    addLog("--- Test RAW simple (texte seul) ---","title");
    try{
      const r=await sp.printRaw({commands:[
        {cmd:"text",text:"=== ESC/POS RAW TEST ===\n"},
        {cmd:"text",text:"Bypass AIDL complet!\n"},
        {cmd:"text",text:`Date: ${new Date().toLocaleString("fr-FR")}\n`},
        {cmd:"text",text:"================================\n"},
        {cmd:"feed",lines:4},{cmd:"cut"}
      ]});
      addLog(`OK: ${JSON.stringify(r)}`,"success");
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    // Test 2: formatted ticket via printRaw
    addLog("--- Test RAW ticket formate ---","title");
    try{
      const r=await sp.printRaw({commands:[
        {cmd:"align",value:1},{cmd:"size",value:28},{cmd:"bold",enabled:true},
        {cmd:"text",text:"MA BOUTIQUE\n"},
        {cmd:"size",value:20},{cmd:"bold",enabled:false},
        {cmd:"text",text:"123 Rue du Commerce\n"},
        {cmd:"align",value:0},
        {cmd:"text",text:"================================\n"},
        {cmd:"text",text:"N: TK-RAW  " + new Date().toLocaleString("fr-FR") + "\n"},
        {cmd:"text",text:"Caissier: Admin\n"},
        {cmd:"text",text:"--------------------------------\n"},
        {cmd:"bold",enabled:true},
        {cmd:"text",text:"Jean Slim (Bleu/38)\n"},
        {cmd:"bold",enabled:false},
        {cmd:"text",text:"  x1  59.90 EUR\n"},
        {cmd:"text",text:"--------------------------------\n"},
        {cmd:"size",value:28},
        {cmd:"text",text:"TOTAL TTC  59.90 EUR\n"},
        {cmd:"size",value:20},
        {cmd:"text",text:"Paiement: CB 59.90 EUR\n"},
        {cmd:"text",text:"================================\n"},
        {cmd:"feed",lines:4},{cmd:"cut"}
      ]});
      addLog(`OK: ${JSON.stringify(r)}`,"success");
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    addLog("--- VERDICT ---","title");
    addLog("Si le texte sort = ESC/POS fonctionne, AIDL est bloque","success");
    addLog("Si rien ne sort = le probleme est plus profond","error");
    setRunning(false);
  };

  // ══════════════════════════════════════════════
  // PRINT DIRECT — Appels Java natifs, sans JSON
  // ══════════════════════════════════════════════
  const testPrintDirect=async()=>{
    setRunning(true);clearLogs();
    addLog("=== TEST PRINT DIRECT (Java natif, sans JSON) ===","title");
    const sp=window.Capacitor?.Plugins?.SunmiPrinter;
    if(!sp){addLog("Plugin absent","error");setRunning(false);return;}
    if(!sp.printDirect){addLog("Methode printDirect absente — APK pas a jour?","error");setRunning(false);return;}

    // Test 1: simple
    addLog("--- Direct SIMPLE (3 lignes texte) ---","title");
    try{
      const r=await sp.printDirect({mode:"simple"});
      addLog(`OK: ${JSON.stringify(r)}`,"success");
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    // Test 2: formatted (align+size, no bold)
    addLog("--- Direct FORMATE (align+size) ---","title");
    try{
      const r=await sp.printDirect({mode:"formatted"});
      addLog(`OK: ${JSON.stringify(r)}`,"success");
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    addLog("--- VERDICT ---","title");
    addLog("Si Direct SIMPLE sort = le probleme est dans printBatch (JSON)","info");
    addLog("Si Direct FORMATE sort = on peut imprimer les tickets via printDirect","info");
    addLog("Si rien ne sort = probleme avec le service imprimante","error");
    setRunning(false);
  };

  // ══════════════════════════════════════════════
  // TPE / CONCERT PROTOCOL TESTS
  // ══════════════════════════════════════════════
  const testTpePlugin=async()=>{
    setRunning(true);clearLogs();
    addLog("=== DIAGNOSTIC TPE ===","title");

    // 1. Check plugins
    addLog("--- Plugins disponibles ---","title");
    const cp=window.Capacitor?.Plugins?.ConcertProtocol;
    const pt=window.Capacitor?.Plugins?.PaymentTerminal;
    addLog(`ConcertProtocol: ${cp?"OUI":"NON"}`);
    addLog(`PaymentTerminal: ${pt?"OUI":"NON"}`);
    if(cp)addLog(`Concert methods: ${Object.keys(cp).filter(k=>typeof cp[k]==="function").join(", ")}`);
    if(pt)addLog(`Payment methods: ${Object.keys(pt).filter(k=>typeof pt[k]==="function").join(", ")}`);

    // 2. Payment config
    addLog("--- Configuration paiement ---","title");
    addLog(`Mode actif: ${paymentId}`);
    addLog(`Config: ${JSON.stringify(paymentConfig||{})}`);
    addLog(`IP TPE: ${paymentConfig?.tpeHost||"NON CONFIGURE"}`);
    addLog(`Port TPE: ${paymentConfig?.tpePort||"8888 (defaut)"}`);

    // 3. Hardware detection
    if(pt){
      addLog("--- Detection hardware paiement ---","title");
      try{
        const hw=await pt.detectHardware();
        addLog(`Hardware: ${JSON.stringify(hw,null,1)}`,"success");
      }catch(e){addLog(`detectHardware erreur: ${e.message}`,"error");}
    }

    // 4. HardwareManager payment state
    addLog("--- Hardware Manager state ---","title");
    try{
      const hm=(await import("../hardware.js")).default;
      addLog(`Payment adapter: ${hm.payment?.constructor?.name}`);
      addLog(`Payment connected: ${hm.payment?.connected}`);
      addLog(`Payment config: ${JSON.stringify(hm.paymentConfig)}`);
    }catch(e){addLog(`HM error: ${e.message}`,"error");}

    setRunning(false);
  };

  const testTpePing=async()=>{
    setRunning(true);clearLogs();
    const host=tpeIp.trim();
    const port=parseInt(tpePort)||8888;
    if(!host){addLog("Entrez l'adresse IP du TPE ci-dessus!","error");setRunning(false);return;}

    addLog(`=== PING TPE ${host}:${port} ===`,"title");
    const cp=window.Capacitor?.Plugins?.ConcertProtocol;
    if(!cp){addLog("Plugin ConcertProtocol ABSENT!","error");setRunning(false);return;}

    // Test 1: Ping TCP
    addLog("Test 1: Connexion TCP...");
    try{
      const r=await cp.ping({host,port});
      addLog(`Resultat: ${JSON.stringify(r)}`,r.success?"success":"error");
      if(r.success)addLog("Le TPE repond sur le reseau!","success");
      else addLog(`Echec: ${r.error}`,"error");
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}

    // Test 2: Try different ports
    addLog("Test 2: Scan des ports courants...","title");
    const ports=[8888,9100,20000,23,4000,5000,6000,7000,9000,10000];
    for(const p of ports){
      try{
        const r=await cp.ping({host,port:p});
        addLog(`  Port ${p}: ${r.success?"OUVERT":"ferme"}`,r.success?"success":"info");
      }catch(e){addLog(`  Port ${p}: erreur (${e.message})`,"info");}
    }

    // Test 3: Try alternate IPs on same subnet
    addLog("Test 3: Scan reseau local...","title");
    const subnet=host.split(".").slice(0,3).join(".");
    const lastOctet=parseInt(host.split(".")[3])||100;
    const ipsToTry=[lastOctet-1,lastOctet+1,lastOctet-2,lastOctet+2,1,254].filter(x=>x>0&&x<255&&x!==lastOctet);
    for(const oct of ipsToTry.slice(0,4)){
      const ip=`${subnet}.${oct}`;
      try{
        const r=await cp.ping({host:ip,port});
        addLog(`  ${ip}:${port} = ${r.success?"REPOND":"pas de reponse"}`,r.success?"success":"info");
      }catch(e){addLog(`  ${ip}:${port} = timeout`,"info");}
    }

    setRunning(false);
  };

  const testTpeSale=async()=>{
    setRunning(true);clearLogs();
    const host=tpeIp.trim();
    const port=parseInt(tpePort)||8888;
    const amount=Math.round(parseFloat(tpeAmount)*100)||100;
    if(!host){addLog("Entrez l'adresse IP du TPE!","error");setRunning(false);return;}

    addLog(`=== TEST TRANSACTION ${(amount/100).toFixed(2)} EUR ===`,"title");
    addLog(`TPE: ${host}:${port}`);
    addLog(`Montant: ${amount} centimes`);

    const cp=window.Capacitor?.Plugins?.ConcertProtocol;
    if(!cp){addLog("Plugin ConcertProtocol ABSENT!","error");setRunning(false);return;}

    // Step 1: Ping first
    addLog("Etape 1: Verification connexion...");
    try{
      const ping=await cp.ping({host,port});
      if(!ping.success){addLog(`TPE non joignable: ${ping.error}`,"error");setRunning(false);return;}
      addLog("Connexion OK","success");
    }catch(e){addLog(`Ping erreur: ${e.message}`,"error");setRunning(false);return;}

    // Step 2: Send sale (V3 by default)
    addLog("Etape 2: Envoi transaction sale() en Caisse-AP V3...","title");
    addLog("Format: TLV (Tag-Length-Value) sur TCP/IP — port 8888");
    addLog("En attente de reponse du TPE (jusqu'a 3 min)...");
    addLog("Presentez la carte sur le terminal...");
    try{
      const r=await cp.sale({host,port,amount,currency:"EUR",reference:`DBG-${Date.now()}`,protocol:"v3"});
      addLog(`Protocole: ${r.protocol||"?"}`);
      addLog(`REPONSE TPE:`,r.success?"success":"error");
      // Display all fields clearly
      if(r.success){
        addLog("TRANSACTION ACCEPTEE!","success");
        if(r.authCode)addLog(`Code autorisation: ${r.authCode}`,"success");
        if(r.amount)addLog(`Montant confirme: ${r.amount} centimes`,"success");
        if(r.maskedPan)addLog(`Carte: ${r.maskedPan}`,"success");
        if(r.paymentLabel)addLog(`Type paiement: ${r.paymentLabel}`,"success");
        if(r.contactless!==undefined)addLog(`Sans contact: ${r.contactless?"OUI":"NON"}`,"success");
        if(r.cardExpiry)addLog(`Expiration: ${r.cardExpiry}`);
        if(r.applicationId)addLog(`AID: ${r.applicationId}`);
        if(r.contractNumber)addLog(`Contrat: ${r.contractNumber}`);
      }else{
        addLog(`TRANSACTION ECHOUEE: ${r.error||r.errorLabel||r.status}`,"error");
        addLog(`Status: ${r.status} | Code: ${r.statusCode}`);
        if(r.errorCode)addLog(`Code erreur: ${r.errorCode} = ${r.errorLabel}`,"error");
      }
      if(r.rawResponse)addLog(`Reponse brute: ${r.rawResponse}`);
      if(r.privateData)addLog(`Donnees privees: ${r.privateData}`);
      // Show parsed tags if available
      if(r.tags){
        addLog("Tags TLV parses:","title");
        Object.entries(r.tags).forEach(([k,v])=>addLog(`  ${k} = ${v}`));
      }
      if(r.lrcValid!==undefined)addLog(`LRC valide: ${r.lrcValid}`,r.lrcValid?"success":"error");
    }catch(e){
      addLog(`ERREUR TRANSACTION: ${e.message}`,"error");
      addLog("Verifiez que le TPE est en mode attente (ecran principal)","info");
      addLog("Verifiez que 'Connexion Caisse' est Active sur le TPE","info");
      addLog("Verifiez que le port est bien 8888","info");
    }
    setRunning(false);
  };

  const testTpeRefund=async()=>{
    setRunning(true);clearLogs();
    const host=tpeIp.trim();
    const port=parseInt(tpePort)||8888;
    const amount=Math.round(parseFloat(tpeAmount)*100)||100;
    if(!host){addLog("Entrez l'adresse IP du TPE!","error");setRunning(false);return;}

    addLog(`=== TEST REMBOURSEMENT ${(amount/100).toFixed(2)} EUR ===`,"title");
    const cp=window.Capacitor?.Plugins?.ConcertProtocol;
    if(!cp){addLog("Plugin absent","error");setRunning(false);return;}

    try{
      const r=await cp.refund({host,port,amount,currency:"EUR"});
      addLog(`REPONSE: ${JSON.stringify(r,null,1)}`);
      addLog(r.success?"REMBOURSEMENT ACCEPTE":"REMBOURSEMENT REFUSE",r.success?"success":"error");
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}
    setRunning(false);
  };

  const testTpeCancel=async()=>{
    setRunning(true);clearLogs();
    const host=tpeIp.trim();
    const port=parseInt(tpePort)||8888;
    addLog(`=== ANNULATION TPE ===`,"title");
    const cp=window.Capacitor?.Plugins?.ConcertProtocol;
    if(!cp){addLog("Plugin absent","error");setRunning(false);return;}
    try{
      const r=await cp.cancel({host,port});
      addLog(`REPONSE: ${JSON.stringify(r,null,1)}`);
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}
    setRunning(false);
  };

  const testTpeRawV3=async()=>{
    setRunning(true);clearLogs();
    const host=tpeIp.trim();
    const port=parseInt(tpePort)||8888;
    if(!host){addLog("Entrez l'IP du TPE!","error");setRunning(false);return;}

    addLog(`=== TEST CAISSE-AP V3 (TLV) ${host}:${port} ===`,"title");
    addLog("Protocole: Caisse-AP V3 / Concert V3 over TCP/IP");
    addLog("Format: TLV (Tag-Length-Value) — ASCII brut, pas de STX/ETX/LRC");

    const cp=window.Capacitor?.Plugins?.ConcertProtocol;
    if(!cp){addLog("Plugin absent","error");setRunning(false);return;}

    // Build V3 TLV message manually for display (matching what Java sends)
    // Reference: github.com/akretion/caisse-ap-ip (tested with Desk/5000)
    const amount=Math.round(parseFloat(tpeAmount)*100)||100;
    let amtStr=String(amount);
    if(amtStr.length<2)amtStr="0"+amtStr;
    const buildTag=(t,v)=>`${t}${String(v.length).padStart(3,"0")}${v}`;
    const tlv=buildTag("CZ","0300")+buildTag("CJ","012345678901")+buildTag("CA","01")
      +buildTag("CE","978")+buildTag("BA","0")+buildTag("CD","0")+buildTag("CB",amtStr);

    addLog(`Message TLV construit (${tlv.length} chars):`,"title");
    addLog(`  [${tlv}]`);
    addLog("");
    addLog("Decodage des tags (identique au code akretion/caisse-ap-ip):","title");
    addLog(`  CZ = 0300 (version protocole caisse — le TPE repond avec sa version 0301)`);
    addLog(`  CJ = 012345678901 (identifiant protocole Concert — OBLIGATOIRE)`);
    addLog(`  CA = 01 (numero de caisse)`);
    addLog(`  CE = 978 (devise: EUR)`);
    addLog(`  BA = 0 (mode reponse: attendre fin transaction)`);
    addLog(`  CD = 0 (action: 0=debit, 1=remboursement)`);
    addLog(`  CB = ${amtStr} (montant en centimes = ${(amount/100).toFixed(2)} EUR)`);
    addLog(`  (PAS de CF — le code de reference n'en envoie pas)`);

    // Also show what V2 would look like for comparison
    addLog("");
    addLog("=== Comparaison Concert V2 (ancien format) ===","title");
    const v2msg=`01${String(amount).padStart(8,"0")}110978          A010B010`;
    addLog(`V2 (34 octets): [${v2msg}]`);
    addLog("Le Desk/5000 en TCP/IP utilise V3 (TLV), PAS V2!");

    addLog("");
    addLog("=== Envoi test V3 via sale() ===","title");
    addLog("En attente de reponse du TPE (presentez la carte)...");
    try{
      const r=await cp.sale({host,port,amount,currency:"EUR",reference:`DBG-${Date.now()}`,protocol:"v3"});
      addLog(`Protocole utilise: ${r.protocol||"?"}`);
      addLog(`Reponse complete:`,"title");
      Object.entries(r).forEach(([k,v])=>{
        if(typeof v==="object"&&v!==null){
          addLog(`  ${k}:`);
          Object.entries(v).forEach(([k2,v2])=>addLog(`    ${k2}: ${v2}`));
        }else{
          addLog(`  ${k}: ${v}`,k==="success"?(v?"success":"error"):"info");
        }
      });
      if(r.success)addLog("TRANSACTION ACCEPTEE!","success");
      else addLog(`Transaction echouee: ${r.error||r.errorLabel||"?"}`,"error");
    }catch(e){
      addLog(`ERREUR: ${e.message}`,"error");
      addLog(`Stack: ${e.stack?.substring(0,300)}`,"error");
    }

    addLog("");
    addLog("=== Test envoi V3 brut (sendRawV3) ===","title");
    try{
      if(cp.sendRawV3){
        const r2=await cp.sendRawV3({host,port,message:tlv});
        addLog(`Reponse sendRawV3:`,r2.success?"success":"error");
        Object.entries(r2).forEach(([k,v])=>{
          if(typeof v==="object"&&v!==null){
            addLog(`  ${k}:`);
            Object.entries(v).forEach(([k2,v2])=>addLog(`    ${k2}: ${v2}`));
          }else addLog(`  ${k}: ${v}`);
        });
      }else addLog("sendRawV3 non disponible sur ce plugin","info");
    }catch(e){addLog(`sendRawV3 erreur: ${e.message}`,"error");}

    setRunning(false);
  };

  const testTpeRawV2=async()=>{
    setRunning(true);clearLogs();
    const host=tpeIp.trim();
    const port=parseInt(tpePort)||8888;
    if(!host){addLog("Entrez l'IP du TPE!","error");setRunning(false);return;}

    addLog(`=== TEST CONCERT V2 (ancien format) ${host}:${port} ===`,"title");
    addLog("ATTENTION: Le Desk/5000 en TCP/IP utilise normalement V3, pas V2!");

    const cp=window.Capacitor?.Plugins?.ConcertProtocol;
    if(!cp){addLog("Plugin absent","error");setRunning(false);return;}

    const amount=Math.round(parseFloat(tpeAmount)*100)||100;
    addLog(`Envoi sale() en mode V2 (STX + 34 octets + ETX + LRC)...`);
    try{
      const r=await cp.sale({host,port,amount,currency:"EUR",reference:"V2TEST",protocol:"v2"});
      addLog(`Reponse:`,r.success?"success":"error");
      Object.entries(r).forEach(([k,v])=>addLog(`  ${k}: ${typeof v==="object"?JSON.stringify(v):v}`));
    }catch(e){addLog(`ERREUR: ${e.message}`,"error");}
    setRunning(false);
  };

  // ══════════════════════════════════════════════
  // TICKET MODAL TESTS
  // ══════════════════════════════════════════════
  const testTicketData=async()=>{
    setRunning(true);clearLogs();
    addLog("=== DIAGNOSTIC TICKETS ===","title");
    addLog(`Total tickets: ${tickets?.length||0}`);
    addLog(`Total avoirs: ${avoirs?.length||0}`);

    if(!tickets?.length){addLog("Aucun ticket!","error");setRunning(false);return;}

    // Test first 3 tickets
    const count=Math.min(3,tickets.length);
    for(let idx=0;idx<count;idx++){
      const t=tickets[idx];
      addLog(`--- Ticket ${idx+1}/${count} ---`,"title");
      const fields=[
        ["ticketNumber",t.ticketNumber],["ticket_number",t.ticket_number],
        ["totalTTC",t.totalTTC,"(type:"+typeof t.totalTTC+")"],["total_ttc",t.total_ttc,"(type:"+typeof t.total_ttc+")"],
        ["totalHT",t.totalHT],["totalTVA",t.totalTVA],
        ["userName",t.userName],["user_name",t.user_name],
        ["date",t.date],["created_at",t.created_at],
        ["items",Array.isArray(t.items)?t.items.length+" items":"MANQUANT"],
        ["payments",Array.isArray(t.payments)?t.payments.length+" paiements":"MANQUANT"],
        ["fingerprint",t.fingerprint],["paymentMethod",t.paymentMethod||t.payment_method],
      ];
      fields.forEach(([k,v,extra])=>addLog(`  ${k}: ${v===undefined?"UNDEFINED":v===null?"NULL":v} ${extra||""}`,
        v===undefined||v===null?"error":"success"));

      // Test modal rendering
      addLog("  -- Rendu modal --");
      try{
        const num=t.ticketNumber||t.ticket_number||"?";
        const date=new Date(t.date||t.createdAt||t.created_at).toLocaleString("fr-FR");
        const ttc=(t.totalTTC||parseFloat(t.total_ttc)||0).toFixed(2);
        const ht=(t.totalHT||parseFloat(t.total_ht)||0).toFixed(2);
        const pay=(t.payments||[]).map(p=>`${p.method} ${(p.amount||0).toFixed(2)}`).join(" + ")||t.paymentMethod||"?";
        addLog(`  Rendu OK: #${num} | ${date} | ${ttc}EUR | Paiement: ${pay}`,"success");
      }catch(e){addLog(`  CRASH RENDU: ${e.message}`,"error");}

      // Test items rendering
      if(t.items?.length>0){
        t.items.slice(0,2).forEach((item,i)=>{
          try{
            const name=item.product?.name||item.product_name||"?";
            const ltc=(item.lineTTC||item.line_ttc||(item.unit_price*item.quantity)||0);
            addLog(`  Item ${i}: ${name} x${item.quantity} = ${Number(ltc).toFixed(2)}`,"success");
          }catch(e){addLog(`  Item ${i} CRASH: ${e.message}`,"error");}
        });
      }
    }

    // Test avoirs too
    if(avoirs?.length>0){
      addLog("--- Premier avoir ---","title");
      const a=avoirs[0];
      addLog(`  avoirNumber: ${a.avoirNumber||a.avoir_number}`);
      addLog(`  totalTTC: ${a.totalTTC} (type: ${typeof a.totalTTC})`);
      addLog(`  items: ${Array.isArray(a.items)?a.items.length:"MANQUANT"}`,Array.isArray(a.items)?"success":"error");
      if(a.items?.length>0){
        try{
          const i=a.items[0];
          addLog(`  Item 0: ${i.product?.name||i.product_name||"?"} | lineTTC: ${i.lineTTC||i.line_ttc}`,"success");
        }catch(e){addLog(`  Item 0 CRASH: ${e.message}`,"error");}
      }
    }
    setRunning(false);
  };

  const testJsErrors=()=>{
    clearLogs();
    addLog("=== ERREURS JS CAPTUREES ===","title");
    const errs=window.__CAISSEPRO_ERRORS||[];
    addLog(`Total: ${errs.length} erreur(s)`);
    if(errs.length===0)addLog("Aucune erreur!","success");
    else errs.forEach(e=>{
      addLog(`[${e.ts}] ${e.msg}`,"error");
      if(e.stack)addLog(`  ${e.stack.substring(0,400)}`,"error");
    });
    addLog("--- INSTRUCTIONS ---","title");
    addLog("1. Allez dans l'historique des tickets","info");
    addLog("2. Cliquez sur un ticket pour ouvrir le detail","info");
    addLog("3. Revenez ici et cliquez 'Erreurs JS' a nouveau","info");
    addLog("L'erreur qui empeche l'ouverture sera capturee.","info");
  };

  // ══════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════
  const colorMap={info:"#94A3B8",success:"#4ADE80",error:"#F87171",title:"#60A5FA",warn:"#FBBF24"};
  const tabStyle=(id)=>({padding:"6px 14px",borderRadius:8,border:`2px solid ${debugTab===id?"#fff":"#334155"}`,
    background:debugTab===id?"#1E293B":"transparent",color:debugTab===id?"#fff":"#94A3B8",
    fontSize:12,fontWeight:700,cursor:"pointer"});

  return(<div style={{maxWidth:750}}>
    <div style={{background:"linear-gradient(135deg,#DC2626,#991B1B)",borderRadius:16,padding:20,marginBottom:16}}>
      <h3 style={{fontSize:18,fontWeight:800,margin:"0 0 4px",color:"#fff"}}>Centre de Debug CaissePro</h3>
      <p style={{fontSize:11,color:"#FCA5A5",margin:0}}>Diagnostic complet — imprimante, TPE, tickets. Faites des screenshots des resultats.</p></div>

    {/* Debug sub-tabs */}
    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      {[{id:"general",l:"General"},{id:"printer",l:"Imprimante"},{id:"tpe",l:"TPE / Concert"},{id:"tickets",l:"Tickets"},{id:"errors",l:`Erreurs (${(window.__CAISSEPRO_ERRORS||[]).length})`}].map(t=>
        <button key={t.id} onClick={()=>{setDebugTab(t.id);clearLogs();}} style={tabStyle(t.id)}>{t.l}</button>)}
    </div>

    {/* === GENERAL TAB === */}
    {debugTab==="general"&&<div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
      <Btn onClick={runDiag} disabled={running} style={{height:44,background:"#2563EB",fontSize:12,fontWeight:700}}>
        <Activity size={14}/> Diagnostic complet</Btn>
    </div>}

    {/* === PRINTER TAB === */}
    {debugTab==="printer"&&<div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
      <Btn onClick={testPrinterStatus} disabled={running} style={{height:44,background:"#2563EB",fontSize:12,fontWeight:700}}>
        <Activity size={14}/> Etat imprimante</Btn>
      <Btn onClick={testSelfCheck} disabled={running} style={{height:44,background:"#7C3AED",fontSize:12,fontWeight:700}}>
        <Zap size={14}/> Self-check hardware</Btn>
      <Btn onClick={testPrinterPrint} disabled={running} style={{height:44,background:"#059669",fontSize:12,fontWeight:700}}>
        <Printer size={14}/> Tester 5 methodes</Btn>
      <Btn onClick={testFormattedPrint} disabled={running} style={{height:44,background:"#D97706",fontSize:12,fontWeight:700}}>
        <Printer size={14}/> Test ticket formate</Btn>
      <Btn onClick={testPrintRaw} disabled={running} style={{height:44,background:"#DC2626",fontSize:12,fontWeight:700}}>
        <Zap size={14}/> Test ESC/POS RAW</Btn>
      <Btn onClick={testPrintDirect} disabled={running} style={{height:44,background:"#9333EA",fontSize:12,fontWeight:700}}>
        <Zap size={14}/> Print DIRECT (AIDL)</Btn>
      <Btn onClick={async()=>{
        setRunning(true);clearLogs();
        addLog("=== TEST MINIMAL (7 methodes AIDL) ===","title");
        addLog("Pas de printerInit, pas de exitPrinterBuffer","info");
        addLog("Teste feedPaper, printText, printOriginalText,","info");
        addLog("printTextWithFont, sendRAWData, lineWrap, init+print","info");
        const sp=window.Capacitor?.Plugins?.SunmiPrinter;
        if(!sp||!sp.printMinimal){addLog("printMinimal absent — APK pas a jour?","error");setRunning(false);return;}
        try{
          const r=await sp.printMinimal({});
          addLog("Resultat:","success");
          (r.log||"").split("\n").forEach(l=>{if(l.trim())addLog(l,l.includes("ERR")?"error":"info");});
          addLog("--- VERDICT ---","title");
          addLog("Si feedPaper fait bouger le papier = moteur OK","info");
          addLog("Si printText/printOriginalText sortent du texte = AIDL OK","success");
          addLog("Si RIEN ne sort = service imprimante bloque, REBOOTER LE T2s","error");
        }catch(e){addLog(`ERREUR: ${e.message}`,"error");}
        setRunning(false);
      }} disabled={running} style={{height:44,background:"#0891B2",fontSize:12,fontWeight:700}}>
        <Activity size={14}/> Test MINIMAL (7 methodes)</Btn>
      <Btn onClick={async()=>{
        setRunning(true);clearLogs();
        addLog("=== RESET IMPRIMANTE ===","title");
        const sp=window.Capacitor?.Plugins?.SunmiPrinter;
        if(!sp){addLog("Plugin absent","error");setRunning(false);return;}
        if(!sp.resetPrinter){addLog("Methode resetPrinter absente — APK pas a jour?","error");setRunning(false);return;}
        try{
          const r=await sp.resetPrinter();
          addLog(`Reset OK: ${JSON.stringify(r)}`,"success");
          addLog("Buffer mode desactive. Retestez les impressions maintenant.","info");
        }catch(e){addLog(`ERREUR: ${e.message}`,"error");}
        setRunning(false);
      }} disabled={running} style={{height:44,background:"#7C3AED",fontSize:12,fontWeight:700}}>
        <Activity size={14}/> RESET imprimante</Btn>
      <Btn onClick={async()=>{
        setRunning(true);clearLogs();
        addLog("=== TEST CODEPAGES ACCENTS ===","title");
        addLog("Imprime une ligne par codepage avec les accents francais","info");
        addLog("La ligne correcte = la bonne codepage pour ce modele","info");
        const sp=window.Capacitor?.Plugins?.SunmiPrinter;
        if(!sp||!sp.testCodepage){addLog("testCodepage absent — APK pas a jour?","error");setRunning(false);return;}
        try{
          const r=await sp.testCodepage({});
          addLog(`OK: ${r.message}`,"success");
          addLog("Regardez le ticket imprime pour identifier la bonne codepage","info");
        }catch(e){addLog(`ERREUR: ${e.message}`,"error");}
        setRunning(false);
      }} disabled={running} style={{height:44,background:"#EA580C",fontSize:12,fontWeight:700}}>
        <Zap size={14}/> Test CODEPAGES accents</Btn>
    </div>}

    {/* === TPE TAB === */}
    {debugTab==="tpe"&&<>
      <div style={{background:"#1E293B",borderRadius:12,padding:16,marginBottom:12,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{fontSize:12,fontWeight:700,color:"#fff"}}>Configuration TPE Concert</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:11,color:"#94A3B8",minWidth:60}}>IP TPE:</span>
          <Input value={tpeIp} onChange={e=>setTpeIp(e.target.value)} placeholder="192.168.1.100"
            style={{flex:1,background:"#0F172A",color:"#fff",border:"1px solid #334155",fontSize:13,fontFamily:"monospace"}}/>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:11,color:"#94A3B8",minWidth:60}}>Port:</span>
          <Input value={tpePort} onChange={e=>setTpePort(e.target.value)} placeholder="8888"
            style={{width:100,background:"#0F172A",color:"#fff",border:"1px solid #334155",fontSize:13,fontFamily:"monospace"}}/>
          <span style={{fontSize:11,color:"#94A3B8",minWidth:60}}>Montant:</span>
          <Input value={tpeAmount} onChange={e=>setTpeAmount(e.target.value)} placeholder="1.00"
            style={{width:100,background:"#0F172A",color:"#fff",border:"1px solid #334155",fontSize:13,fontFamily:"monospace"}}/>
          <span style={{fontSize:11,color:"#94A3B8"}}>EUR</span>
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <Btn onClick={testTpePlugin} disabled={running} style={{height:44,background:"#2563EB",fontSize:12,fontWeight:700}}>
          <Activity size={14}/> Diagnostic TPE</Btn>
        <Btn onClick={testTpePing} disabled={running} style={{height:44,background:"#7C3AED",fontSize:12,fontWeight:700}}>
          <Wifi size={14}/> Ping + Scan ports</Btn>
        <Btn onClick={testTpeSale} disabled={running} style={{height:44,background:"#059669",fontSize:12,fontWeight:700}}>
          <CreditCard size={14}/> Test paiement</Btn>
        <Btn onClick={testTpeRefund} disabled={running} style={{height:44,background:"#D97706",fontSize:12,fontWeight:700}}>
          <RotateCcw size={14}/> Test remboursement</Btn>
        <Btn onClick={testTpeCancel} disabled={running} style={{height:44,background:"#DC2626",fontSize:12,fontWeight:700}}>
          <XCircle size={14}/> Annuler transaction</Btn>
        <Btn onClick={testTpeRawV3} disabled={running} style={{height:44,background:"#0F172A",border:"2px solid #7C3AED",fontSize:12,fontWeight:700}}>
          <Code size={14}/> Test V3 TLV (recommande)</Btn>
        <Btn onClick={testTpeRawV2} disabled={running} style={{height:44,background:"#0F172A",border:"2px solid #475569",fontSize:12,fontWeight:700}}>
          <Code size={14}/> Test V2 (ancien)</Btn>
      </div>
      <div style={{background:"#1E293B",borderRadius:10,padding:12,marginBottom:12,fontSize:10,color:"#94A3B8",lineHeight:1.6}}>
        <strong style={{color:"#4ADE80",fontSize:12}}>IMPORTANT: Protocole Caisse-AP V3 (Concert V3)</strong><br/>
        Le Desk/5000 en TCP/IP utilise le protocole <strong style={{color:"#fff"}}>Caisse-AP V3</strong> (format TLV), PAS Concert V2!<br/>
        <br/>
        <strong style={{color:"#fff"}}>Configuration Ingenico Desk/5000:</strong><br/>
        1. Appuyez sur le <strong>bouton rond blanc</strong> pour acceder au menu<br/>
        2. Allez dans <strong>PARAM</strong> (en bas a gauche)<br/>
        3. <strong>Panneau de controle</strong> &gt; <strong>Connexion Caisse</strong> &gt; mettre sur <strong>Active</strong><br/>
        4. Selectionnez <strong>IP/Eth</strong> (Ethernet)<br/>
        5. Notez l'adresse IP du terminal (Parametres &gt; Communication &gt; Ethernet)<br/>
        6. Port par defaut: <strong style={{color:"#FBBF24"}}>8888</strong><br/>
        7. Le TPE et la Sunmi T2s doivent etre sur le <strong>meme reseau local</strong><br/>
        8. Le TPE doit etre en <strong>ecran d'attente</strong> (pas dans un menu)<br/>
        <br/>
        <strong style={{color:"#FBBF24"}}>Astuce: Lancez d'abord "Ping + Scan ports" pour trouver le bon port!</strong><br/>
        <strong style={{color:"#60A5FA"}}>Ref: github.com/akretion/caisse-ap-ip (Odoo POS, teste avec Desk/5000)</strong>
      </div>
    </>}

    {/* === TICKETS TAB === */}
    {debugTab==="tickets"&&<div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
      <Btn onClick={testTicketData} disabled={running} style={{height:44,background:"#D97706",fontSize:12,fontWeight:700}}>
        <Receipt size={14}/> Inspecter tickets</Btn>
      <Btn onClick={testJsErrors} disabled={running} style={{height:44,background:"#DC2626",fontSize:12,fontWeight:700}}>
        <AlertTriangle size={14}/> Erreurs JS</Btn>
    </div>}

    {/* === ERRORS TAB === */}
    {debugTab==="errors"&&<div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
      <Btn onClick={testJsErrors} style={{height:44,background:"#DC2626",fontSize:12,fontWeight:700}}>
        <AlertTriangle size={14}/> Voir erreurs capturees</Btn>
      <Btn onClick={()=>{window.__CAISSEPRO_ERRORS=[];clearLogs();addLog("Erreurs effacees","success");}}
        style={{height:44,background:"#64748B",fontSize:12}}>Effacer erreurs</Btn>
    </div>}

    {/* === LOG OUTPUT === */}
    <div ref={logRef} style={{background:"#0F172A",borderRadius:12,padding:14,fontFamily:"'Courier New',monospace",fontSize:10,
      color:"#E2E8F0",minHeight:250,maxHeight:600,overflow:"auto",whiteSpace:"pre-wrap",border:"2px solid #1E293B"}}>
      {logs.length===0&&<span style={{color:"#475569"}}>Selectionnez un onglet et lancez un test...</span>}
      {logs.map((l,i)=><div key={i} style={{color:colorMap[l.type]||"#94A3B8",marginBottom:2,borderBottom:l.type==="title"?"1px solid #1E293B":"none",paddingBottom:l.type==="title"?3:0}}>
        <span style={{color:"#475569"}}>[{l.ts}]</span> {l.msg}
      </div>)}
    </div>
    <div style={{display:"flex",gap:8,marginTop:8}}>
      <Btn onClick={clearLogs} style={{height:36,background:"#334155",fontSize:11}}>Effacer logs</Btn>
      <Btn onClick={()=>{
        const text=logs.map(l=>`[${l.ts}] ${l.msg}`).join("\n");
        if(navigator.clipboard)navigator.clipboard.writeText(text).then(()=>addLog("Logs copies!","success"));
        else addLog("Clipboard non disponible","error");
      }} style={{height:36,background:"#334155",fontSize:11}}>Copier logs</Btn>
    </div>
  </div>);
}

function BackupPanel({notify,addAudit}){
  const[backups,setBackups]=useState([]);const[status,setStatus]=useState(null);const[loading,setLoading]=useState(true);const[triggering,setTriggering]=useState(false);
  const load=useCallback(async()=>{
    try{const[b,s]=await Promise.all([API.backup.list().catch(()=>({backups:[]})),API.backup.status().catch(()=>null)]);
      setBackups(b.backups||[]);setStatus(s);}catch(e){}finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);
  const triggerBackup=async()=>{
    setTriggering(true);
    try{await API.backup.trigger();notify("Backup lance en arriere-plan. Rafraichissez dans 1-2 min.","success");addAudit("BACKUP","Backup manuel declenche");}
    catch(e){notify("Erreur: "+e.message,"error");}finally{setTriggering(false);}
  };
  const deleteBackup=async(f)=>{
    if(!confirm("Supprimer "+f+" ?"))return;
    try{await API.backup.remove(f);notify("Backup supprime","info");load();}catch(e){notify("Erreur: "+e.message,"error");}
  };
  if(loading)return<div style={{padding:20,color:C.textMuted}}>Chargement...</div>;
  return<div style={{maxWidth:700}}>
    <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
      <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 4px"}}>Sauvegardes</h3>
      <p style={{fontSize:11,color:C.textMuted,margin:0}}>Backups automatiques quotidiens (3h) + backup manuel a la demande. Base de donnees + config + fichiers critiques.</p></div>

    {/* Status */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
      <div style={{background:C.surface,borderRadius:12,padding:14,border:`1.5px solid ${C.border}`,textAlign:"center"}}>
        <div style={{fontSize:10,fontWeight:600,color:C.textMuted,marginBottom:4}}>CRON</div>
        <div style={{fontSize:13,fontWeight:700,color:status?.cronConfigured?C.primary:C.danger}}>{status?.cronConfigured?"Actif":"Non configure"}</div></div>
      <div style={{background:C.surface,borderRadius:12,padding:14,border:`1.5px solid ${C.border}`,textAlign:"center"}}>
        <div style={{fontSize:10,fontWeight:600,color:C.textMuted,marginBottom:4}}>DERNIER BACKUP</div>
        <div style={{fontSize:13,fontWeight:700,color:status?.lastBackup?C.primary:C.textMuted}}>{status?.lastBackup?`il y a ${status.lastBackup.ageHours}h`:"Aucun"}</div>
        {status?.lastBackup&&<div style={{fontSize:9,color:C.textMuted}}>{status.lastBackup.size}</div>}</div>
      <div style={{background:C.surface,borderRadius:12,padding:14,border:`1.5px solid ${C.border}`,textAlign:"center"}}>
        <div style={{fontSize:10,fontWeight:600,color:C.textMuted,marginBottom:4}}>DISQUE</div>
        <div style={{fontSize:13,fontWeight:700,color:C.text}}>{status?.diskSpace?.percent||"?"}</div>
        <div style={{fontSize:9,color:C.textMuted}}>{status?.diskSpace?.available||"?"} libre</div></div></div>

    {/* Trigger */}
    <Btn onClick={triggerBackup} disabled={triggering} style={{width:"100%",height:44,background:C.primary,marginBottom:16}}>
      {triggering?"Backup en cours...":"Lancer un backup maintenant"}</Btn>

    {/* List */}
    <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>Backups disponibles ({backups.length})</div>
    {backups.length===0&&<div style={{padding:20,textAlign:"center",color:C.textMuted,fontSize:12,background:C.surface,borderRadius:12,border:`1.5px solid ${C.border}`}}>Aucun backup. Lancez-en un ou configurez le cron sur le serveur.</div>}
    {backups.map(b=>(<div key={b.filename} style={{display:"flex",alignItems:"center",gap:10,padding:10,borderBottom:`1px solid ${C.border}`,fontSize:11}}>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:12}}>{new Date(b.date).toLocaleString("fr-FR")}</div>
        <div style={{color:C.textMuted,fontSize:10}}>{b.filename}</div></div>
      <div style={{fontWeight:700,color:C.primary,minWidth:60,textAlign:"right"}}>{b.sizeHuman}</div>
      {b.hasChecksum&&<span style={{fontSize:8,background:C.primaryLight,color:C.primary,padding:"2px 6px",borderRadius:6,fontWeight:700}}>SHA256</span>}
      <a href={API.backup.downloadUrl(b.filename)} style={{fontSize:10,color:C.info,fontWeight:600,textDecoration:"none"}} target="_blank">Telecharger</a>
      <button onClick={()=>deleteBackup(b.filename)} style={{fontSize:10,color:C.danger,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Supprimer</button>
    </div>))}

    {!status?.configured&&<div style={{background:"#FEF2F2",borderRadius:12,padding:16,marginTop:16,border:"1.5px solid #FECACA"}}>
      <div style={{fontSize:12,fontWeight:700,color:"#991B1B",marginBottom:6}}>Configuration requise sur le VPS</div>
      <div style={{fontSize:11,color:"#7F1D1D",lineHeight:1.6}}>
        Le systeme de backup n'est pas encore configure sur le serveur. Executez :<br/>
        <code style={{background:"#FEE2E2",padding:"2px 6px",borderRadius:4,fontFamily:"monospace",fontSize:10}}>
          cd /var/www/caissepro-api && sudo bash scripts/setup-backup.sh
        </code><br/><br/>
        Cela installe le backup automatique quotidien a 3h, avec chiffrement AES-256 et rotation 30 jours.
      </div></div>}
  </div>;
}

function SettingsScreen(){
  const{settings,setSettings,saveSettingsToAPI,addAudit,theme,setTheme,clockEntries,priceHistory,printerConnected,printerType,connectPrinter,disconnectPrinter,thermalPrint,notify,users,hwId,hwProfile,switchHardware,hardwareProfiles,paymentId,paymentConfig,switchPayment,updatePaymentConfig,paymentProfiles,perm,effectiveStoreId,allCategories,products,updateProduct}=useApp();
  if(!perm().canSettings) return <div style={{padding:40,textAlign:"center",color:C.textMuted,fontSize:16,fontWeight:600}}>Accès refusé</div>;
  const[tab,setTab]=useState("general");
  const[printerBaud,setPrinterBaud]=useState("9600");
  const[printerWidth,setPrinterWidth]=useState("48");
  const[connecting,setConnecting]=useState(false);
  const[printerDiag,setPrinterDiag]=useState(null);
  const[diagLoading,setDiagLoading]=useState(false);
  return(<div style={{height:"100%",overflowY:"auto",padding:"var(--pad,16px)",background:C.bg}}>
    <h2 style={{fontSize:20,fontWeight:800,marginBottom:10}}>Paramètres</h2>
    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      {[{id:"general",l:"Général"},{id:"retouche",l:"✂️ Retouches"},{id:"pricing",l:"💰 Prix HT/TTC"},{id:"commission",l:"Commission"},{id:"stores",l:"Magasins"},{id:"printer",l:"Imprimante"},{id:"tpe",l:"Terminal paiement"},{id:"receipt",l:"Ticket"},{id:"screen2",l:"📺 Écran 2"},{id:"caticons",l:"🏷️ Catégories"},{id:"return",l:"Retours"},{id:"sizes",l:"📏 Ordre tailles"},{id:"theme",l:"Thème"},{id:"clock",l:"Pointages"},{id:"prices",l:"Historique prix"},{id:"backup",l:"Backup"},{id:"debug",l:"DEBUG"}].map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"5px 12px",borderRadius:8,border:`1.5px solid ${tab===t.id?C.primary:C.border}`,
          background:tab===t.id?C.primary:"transparent",color:tab===t.id?"#fff":C.text,fontSize:11,fontWeight:600,cursor:"pointer"}}>{t.l}</button>))}</div>

    {tab==="general"&&<div style={{maxWidth:500}}>
      {[{l:"Nom boutique",k:"name"},{l:"Adresse",k:"address"},{l:"Code postal",k:"postalCode"},{l:"Ville",k:"city"},{l:"SIRET",k:"siret"},{l:"N° TVA Intra",k:"tvaIntra"},{l:"Téléphone",k:"phone"},{l:"Message ticket",k:"footerMsg"}].map(f=>(
        <div key={f.k} style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>{f.l}</label>
          <Input value={settings[f.k]||""} onChange={e=>setSettings(s=>({...s,[f.k]:e.target.value}))}/></div>))}
      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Paramètres mis à jour");notify("Paramètres sauvegardés","success");}} style={{width:"100%",height:40,marginTop:8,background:C.primary}}><Save size={14}/> Enregistrer</Btn></div>}

    {tab==="retouche"&&<div style={{maxWidth:650}}>
      <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
          <Scissors size={20} color={C.primary}/>
          <div><h3 style={{fontSize:16,fontWeight:800,margin:0}}>Types de retouches</h3>
            <p style={{fontSize:11,color:C.textMuted,margin:0}}>Configurez les prestations de retouche proposées en caisse. Ces types apparaissent comme boutons rapides dans le bon de retouche.</p></div></div></div>

      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <h4 style={{fontSize:13,fontWeight:700,margin:0}}>Prestations ({(settings.retoucheTypes||[]).length || "8 par défaut"})</h4>
          <Btn variant="outline" onClick={()=>{const types=[...(settings.retoucheTypes||[{n:"Ourlet pantalon",p:15},{n:"Ourlet manches",p:10},{n:"Cintrer veste",p:20},{n:"Raccourcir robe",p:18},{n:"Changer fermeture",p:25},{n:"Reprendre taille",p:15},{n:"Doublure",p:30},{n:"Ajustement épaules",p:22}]),{n:"",p:""}];
            setSettings(s=>({...s,retoucheTypes:types}));}} style={{fontSize:10,padding:"4px 12px"}}><Plus size={11}/> Ajouter</Btn></div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {(settings.retoucheTypes||[{n:"Ourlet pantalon",p:15},{n:"Ourlet manches",p:10},{n:"Cintrer veste",p:20},{n:"Raccourcir robe",p:18},{n:"Changer fermeture",p:25},{n:"Reprendre taille",p:15},{n:"Doublure",p:30},{n:"Ajustement épaules",p:22}]).map((rt,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:10,borderRadius:12,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
              <span style={{fontSize:12,fontWeight:700,color:C.primary,width:24,textAlign:"center"}}>{i+1}</span>
              <Input value={rt.n} onChange={e=>{const types=[...(settings.retoucheTypes||[{n:"Ourlet pantalon",p:15},{n:"Ourlet manches",p:10},{n:"Cintrer veste",p:20},{n:"Raccourcir robe",p:18},{n:"Changer fermeture",p:25},{n:"Reprendre taille",p:15},{n:"Doublure",p:30},{n:"Ajustement épaules",p:22}])];types[i]={...types[i],n:e.target.value};setSettings(s=>({...s,retoucheTypes:types}));}}
                placeholder="Nom de la prestation" style={{flex:2,height:36}}/>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <Input type="number" step="0.5" value={rt.p} onChange={e=>{const types=[...(settings.retoucheTypes||[{n:"Ourlet pantalon",p:15},{n:"Ourlet manches",p:10},{n:"Cintrer veste",p:20},{n:"Raccourcir robe",p:18},{n:"Changer fermeture",p:25},{n:"Reprendre taille",p:15},{n:"Doublure",p:30},{n:"Ajustement épaules",p:22}])];types[i]={...types[i],p:parseFloat(e.target.value)||0};setSettings(s=>({...s,retoucheTypes:types}));}}
                  style={{width:80,height:36,textAlign:"right"}}/>
                <span style={{fontSize:11,color:C.textMuted}}>€</span></div>
              <Btn variant="ghost" onClick={()=>{const types=[...(settings.retoucheTypes||[{n:"Ourlet pantalon",p:15},{n:"Ourlet manches",p:10},{n:"Cintrer veste",p:20},{n:"Raccourcir robe",p:18},{n:"Changer fermeture",p:25},{n:"Reprendre taille",p:15},{n:"Doublure",p:30},{n:"Ajustement épaules",p:22}])];types.splice(i,1);setSettings(s=>({...s,retoucheTypes:types}));}}
                style={{padding:"4px 8px",color:C.danger}}><Trash2 size={14}/></Btn>
            </div>))}
        </div>
      </div>

      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <h4 style={{fontSize:13,fontWeight:700,marginBottom:8}}>Paramètres du bon de retouche</h4>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>TAUX DE TVA RETOUCHE (%)</label>
            <Input type="number" step="0.1" value={settings.retoucheTVA||20} onChange={e=>setSettings(s=>({...s,retoucheTVA:parseFloat(e.target.value)||20}))} style={{width:120}}/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>MESSAGE SUR LE BON</label>
            <Input value={settings.retoucheMsg||""} onChange={e=>setSettings(s=>({...s,retoucheMsg:e.target.value}))} placeholder="Ex: Retrait sous 5 jours ouvrés"/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>DÉLAI PAR DÉFAUT (jours)</label>
            <Input type="number" value={settings.retoucheDelay||5} onChange={e=>setSettings(s=>({...s,retoucheDelay:parseInt(e.target.value)||5}))} style={{width:120}}/></div>
        </div>
      </div>

      <div style={{background:C.warnLight,borderRadius:12,padding:14,border:`1px solid ${C.warn}33`,display:"flex",gap:10,alignItems:"start",marginBottom:14}}>
        <AlertTriangle size={16} color={C.warn} style={{flexShrink:0,marginTop:2}}/>
        <div style={{fontSize:11,color:"#92400E",lineHeight:1.5}}>
          <strong>Utilisation :</strong> En caisse, cliquez sur le bouton <strong>Retouche</strong> pour créer un bon. Les prestations configurées ici apparaissent comme boutons rapides. Le bon de retouche s'imprime au format ticket de caisse et les articles sont ajoutés au panier.</div></div>

      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Types de retouches mis à jour");notify("Paramètres retouches sauvegardés","success");}}
        style={{width:"100%",height:44,background:C.primary}}><Save size={14}/> Enregistrer</Btn>
    </div>}

    {tab==="pricing"&&<div style={{maxWidth:550}}>
      <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <Euro size={20} color={C.primary}/>
          <div><h3 style={{fontSize:16,fontWeight:800,margin:0}}>Mode de tarification</h3>
            <p style={{fontSize:11,color:C.textMuted,margin:0}}>Définissez comment vos prix de vente sont saisis</p></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[{id:"TTC",l:"Prix TTC",d:"Les prix saisis incluent la TVA. Le HT est calculé en soustrayant la TVA.",ex:"Prix saisi: 29.90€ TTC → HT: 24.92€ (TVA 20%)"},
            {id:"HT",l:"Prix HT",d:"Les prix saisis sont hors taxes. La TVA est ajoutée au total.",ex:"Prix saisi: 29.90€ HT → TTC: 35.88€ (TVA 20%)"}].map(m=>(
            <button key={m.id} onClick={()=>setSettings(s=>({...s,pricingMode:m.id}))}
              style={{padding:16,borderRadius:14,border:`2.5px solid ${(settings.pricingMode||"TTC")===m.id?C.primary:C.border}`,
                background:(settings.pricingMode||"TTC")===m.id?`${C.primary}08`:"#fff",cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <div style={{width:18,height:18,borderRadius:9,border:`2px solid ${(settings.pricingMode||"TTC")===m.id?C.primary:C.border}`,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {(settings.pricingMode||"TTC")===m.id&&<div style={{width:10,height:10,borderRadius:5,background:C.primary}}/>}</div>
                <span style={{fontSize:14,fontWeight:700,color:(settings.pricingMode||"TTC")===m.id?C.primary:C.text}}>{m.l}</span></div>
              <p style={{fontSize:11,color:C.textMuted,margin:"0 0 6px 0",lineHeight:1.4}}>{m.d}</p>
              <div style={{fontSize:10,color:C.info,background:C.infoLight,borderRadius:8,padding:"4px 8px",fontWeight:600}}>{m.ex}</div>
            </button>))}
        </div>
      </div>
      <div style={{background:C.warnLight,borderRadius:12,padding:14,border:`1px solid ${C.warn}33`,display:"flex",gap:10,alignItems:"start"}}>
        <AlertTriangle size={16} color={C.warn} style={{flexShrink:0,marginTop:2}}/>
        <div style={{fontSize:11,color:"#92400E",lineHeight:1.5}}>
          <strong>Important :</strong> Ce réglage s'applique à tous vos produits. Si vous changez de TTC à HT (ou inversement),
          vérifiez que vos prix sont bien cohérents. Les prix existants ne sont pas recalculés automatiquement —
          seul le calcul de la TVA sur les tickets change.</div></div>
    </div>}

    {tab==="commission"&&<div style={{maxWidth:550}}>
      <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
        <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 4px"}}>Taux de commission</h3>
        <p style={{fontSize:11,color:C.textMuted,margin:0}}>Configurez le taux de commission sur la marge pour chaque vendeur. Par défaut : {((settings.defaultCommissionRate||0.05)*100).toFixed(1)}%</p></div>
      <div style={{marginBottom:14}}>
        <label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>Taux par défaut (%)</label>
        <Input type="number" step="0.5" min="0" max="100" value={((settings.defaultCommissionRate||0.05)*100).toFixed(1)}
          onChange={e=>setSettings(s=>({...s,defaultCommissionRate:parseFloat(e.target.value)/100||0.05}))}
          style={{width:120}}/></div>
      <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Taux par vendeur</div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
        {(users||[]).map(u=>(<div key={u.id||u.name} style={{display:"flex",alignItems:"center",gap:10,padding:10,borderRadius:10,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
          <span style={{flex:1,fontSize:12,fontWeight:600}}>{u.name}</span>
          <Input type="number" step="0.5" min="0" max="100"
            value={settings.commissionRates?.[u.id||u.name]!=null?(settings.commissionRates[u.id||u.name]*100).toFixed(1):""}
            onChange={e=>{const val=e.target.value;const key=u.id||u.name;setSettings(s=>({...s,commissionRates:{...s.commissionRates,[key]:val?parseFloat(val)/100:undefined}}));}}
            placeholder={((settings.defaultCommissionRate||0.05)*100).toFixed(1)}
            style={{width:80,textAlign:"right"}}/><span style={{fontSize:11,color:C.textMuted}}>%</span></div>))}
      </div>
      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Taux de commission mis à jour");notify("Taux de commission sauvegardés","success");}} style={{width:"100%",height:40,background:C.primary}}><Save size={14}/> Enregistrer</Btn>
    </div>}

    {tab==="stores"&&<div style={{maxWidth:600}}>
      <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
        <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 4px"}}>Configuration multi-magasins</h3>
        <p style={{fontSize:11,color:C.textMuted,margin:0}}>Définissez les magasins de votre réseau. Utilisé pour les transferts de stock et les rapports consolidés.</p></div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
        {(settings.stores||[]).map((store,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:12,borderRadius:12,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
          <div style={{flex:1}}>
            <Input value={store.name} onChange={e=>{const stores=[...(settings.stores||[])];stores[i]={...stores[i],name:e.target.value};setSettings(s=>({...s,stores}));}}
              placeholder="Nom du magasin" style={{marginBottom:4,fontWeight:600}}/>
            <Input value={store.address||""} onChange={e=>{const stores=[...(settings.stores||[])];stores[i]={...stores[i],address:e.target.value};setSettings(s=>({...s,stores}));}}
              placeholder="Adresse" style={{fontSize:11}}/>
          </div>
          <Btn variant="outline" onClick={()=>{const stores=(settings.stores||[]).filter((_,j)=>j!==i);setSettings(s=>({...s,stores}));}}
            style={{height:36,width:36,padding:0,borderRadius:8,color:C.danger,borderColor:C.danger+"44"}}><Trash2 size={14}/></Btn>
        </div>))}
        {(settings.stores||[]).length===0&&<div style={{textAlign:"center",padding:20,color:C.textLight,fontSize:12}}>Aucun magasin configuré</div>}
      </div>
      <Btn variant="outline" onClick={()=>{const stores=[...(settings.stores||[]),{name:"",address:"",id:`store-${Date.now()}`}];setSettings(s=>({...s,stores}));}}
        style={{width:"100%",height:36,marginBottom:12,borderRadius:10,fontSize:11}}><Plus size={12}/> Ajouter un magasin</Btn>
      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Configuration magasins mise à jour");notify("Magasins sauvegardés","success");}}
        style={{width:"100%",height:40,background:C.primary}}><Save size={14}/> Enregistrer</Btn>
    </div>}

    {tab==="printer"&&<div style={{maxWidth:600}}>
      {/* Hardware selection */}
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.primary}22`,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <Monitor size={18} color={C.primary}/>
          <div><h3 style={{fontSize:14,fontWeight:700,margin:0}}>Type de caisse</h3>
            <p style={{fontSize:10,color:C.textMuted,margin:0}}>Selectionnez votre materiel pour activer les bons drivers (imprimante, ecran client, tiroir-caisse)</p></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {Object.entries(hardwareProfiles||{}).map(([id,p])=>(
            <button key={id} onClick={()=>switchHardware(id)} style={{padding:"12px 14px",borderRadius:12,textAlign:"left",cursor:"pointer",
              border:`2px solid ${hwId===id?C.primary:C.border}`,background:hwId===id?C.primaryLight:"transparent",transition:"all 0.15s"}}>
              <div style={{fontSize:12,fontWeight:700,color:hwId===id?C.primary:C.text,marginBottom:2}}>{p.name}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {p.hasPrinter&&<span style={{fontSize:9,background:C.primaryLight,color:C.primary,padding:"1px 6px",borderRadius:6,fontWeight:600}}>Imprimante</span>}
                {p.hasDualScreen&&<span style={{fontSize:9,background:"#DBEAFE",color:"#1D4ED8",padding:"1px 6px",borderRadius:6,fontWeight:600}}>Double ecran</span>}
                {p.hasCashDrawer&&<span style={{fontSize:9,background:"#FEF3C7",color:"#92400E",padding:"1px 6px",borderRadius:6,fontWeight:600}}>Tiroir</span>}
              </div>
            </button>))}
        </div>
        {hwProfile&&<div style={{marginTop:10,fontSize:11,color:C.textMuted,background:C.surfaceAlt,borderRadius:8,padding:10}}>
          Materiel actif: <strong style={{color:C.primary}}>{hwProfile.name}</strong>
          {hwProfile.hasPrinter?" — Imprimante integree ("+hwProfile.printerWidth+" car.)":""}
          {hwProfile.hasDualScreen?" — Ecran client integre":""}
        </div>}
      </div>

      {/* Printer status */}
      <div style={{background:printerConnected?C.primaryLight:C.surfaceAlt,borderRadius:14,padding:16,border:`1.5px solid ${printerConnected?C.primary+"44":C.border}`,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <div style={{width:12,height:12,borderRadius:6,background:printerConnected?"#059669":"#CCC",boxShadow:printerConnected?"0 0 8px #05966955":"none"}}/>
          <span style={{fontSize:14,fontWeight:700}}>{printerConnected?"Imprimante connectée":"Aucune imprimante"}</span>
          {printerConnected&&<Badge color={C.primary}>{printerType==="serial"?"Web Serial":"WebUSB"}</Badge>}</div>
        {printerConnected&&<div style={{fontSize:11,color:C.textMuted}}>L'impression ESC/POS est active. Les tickets seront envoyés directement a l'imprimante thermique.</div>}</div>

      {/* Diagnostic panel */}
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <Activity size={18} color={C.info}/>
          <div><h3 style={{fontSize:14,fontWeight:700,margin:0}}>Diagnostic imprimante</h3>
            <p style={{fontSize:10,color:C.textMuted,margin:0}}>Verifiez la detection, connexion et fonctionnement</p></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
          <Btn onClick={async()=>{
            setDiagLoading(true);
            try{
              const diag=await hardwareManager.printer?.getDiagnostics?.();
              const cap=!!window.Capacitor?.isNativePlatform?.();
              const plugins=Object.keys(window.Capacitor?.Plugins||{});
              setPrinterDiag({...diag,capacitor:cap,plugins,hwId,timestamp:new Date().toLocaleTimeString('fr-FR')});
            }catch(e){setPrinterDiag({error:e.message});}
            setDiagLoading(false);
          }} disabled={diagLoading} style={{height:40,background:C.info,fontSize:11}}>
            <Activity size={13}/> {diagLoading?"Analyse...":"Diagnostic"}</Btn>
          <Btn onClick={async()=>{
            setDiagLoading(true);
            try{
              await hardwareManager.connectPrinter();
              const diag=await hardwareManager.printer?.getDiagnostics?.();
              setPrinterDiag(prev=>({...prev,...diag,action:"connectPrinter",timestamp:new Date().toLocaleTimeString('fr-FR')}));
              notify(hardwareManager.printer?.connected?"Imprimante connectee":"Connexion echouee",hardwareManager.printer?.connected?"success":"warn");
            }catch(e){setPrinterDiag(prev=>({...prev,connectError:e.message}));notify("Erreur: "+e.message,"error");}
            setDiagLoading(false);
          }} disabled={diagLoading} style={{height:40,background:C.primary,fontSize:11}}>
            <Printer size={13}/> Connecter</Btn>
          <Btn onClick={async()=>{
            setDiagLoading(true);
            try{
              if(window.Capacitor?.Plugins?.SunmiPrinter){
                const r=await window.Capacitor.Plugins.SunmiPrinter.testPrint();
                setPrinterDiag(prev=>({...prev,testResult:r,action:"testPrint",timestamp:new Date().toLocaleTimeString('fr-FR')}));
                notify("Test impression envoye","success");
              }else{
                await thermalPrint("test");
                notify("Test impression envoye","success");
              }
            }catch(e){setPrinterDiag(prev=>({...prev,testError:e.message}));notify("Erreur test: "+e.message,"error");}
            setDiagLoading(false);
          }} disabled={diagLoading} style={{height:40,background:"#059669",fontSize:11}}>
            <Printer size={13}/> Test print</Btn>
        </div>
        {printerDiag&&<div style={{background:"#0F172A",borderRadius:10,padding:12,fontFamily:"monospace",fontSize:10,color:"#E2E8F0",maxHeight:300,overflow:"auto",whiteSpace:"pre-wrap"}}>
          {JSON.stringify(printerDiag,null,2)}
        </div>}
      </div>

      {/* Connect / Disconnect */}
      {!printerConnected?<>
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Connexion imprimante thermique</h3>
        <p style={{fontSize:11,color:C.textMuted,marginBottom:12}}>
          Connectez une imprimante ticket thermique ESC/POS (Epson TM-T20, Star TSP, Bixolon, etc.) via USB ou port série.
          Nécessite un navigateur compatible (Chrome, Edge, Opera).</p>

        {/* Serial settings */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>VITESSE SÉRIE (BAUD)</label>
            <select value={printerBaud} onChange={e=>setPrinterBaud(e.target.value)} style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
              {["9600","19200","38400","57600","115200"].map(b=>(<option key={b} value={b}>{b}</option>))}</select></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>LARGEUR PAPIER</label>
            <select value={printerWidth} onChange={e=>setPrinterWidth(e.target.value)} style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
              <option value="48">80mm (48 car.)</option>
              <option value="32">58mm (32 car.)</option></select></div></div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {!!navigator.serial&&<Btn onClick={async()=>{setConnecting(true);await connectPrinter("serial",{baudRate:parseInt(printerBaud),paperWidth:parseInt(printerWidth)});setConnecting(false);}}
            disabled={connecting} style={{height:44,background:C.primary}}>
            <Printer size={14}/> {connecting?"Connexion…":"Connecter (Port série)"}</Btn>}
          {!!navigator.usb&&<Btn onClick={async()=>{setConnecting(true);await connectPrinter("usb");setConnecting(false);}}
            disabled={connecting} style={{height:44,background:C.info}}>
            <Printer size={14}/> {connecting?"Connexion…":"Connecter (USB)"}</Btn>}
        </div>

        {/* Native POS printer (Sunmi/PAX/iMin) */}
        {(hwId==="sunmi"||hwId==="pax"||hwId==="imin")&&<div style={{marginTop:10}}>
          <Btn onClick={async()=>{setConnecting(true);await connectPrinter(hwId);setConnecting(false);}}
            disabled={connecting} style={{width:"100%",height:44,background:"#059669"}}>
            <Printer size={14}/> {connecting?"Connexion...":"Connecter imprimante "+hwProfile?.name}</Btn>
          <p style={{fontSize:10,color:C.textMuted,marginTop:6}}>Connexion directe a l'imprimante integree via le bridge natif. Necessite l'app Capacitor.</p>
        </div>}

        {!navigator.serial&&!navigator.usb&&hwId==="desktop"&&<div style={{background:C.warnLight,borderRadius:10,padding:12,marginTop:10,fontSize:11,color:"#92400E",border:`1px solid ${C.warn}33`}}>
          Votre navigateur ne supporte ni Web Serial ni WebUSB. Utilisez <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong> ou <strong>Opera</strong> pour connecter une imprimante thermique.</div>}
      </>:<>
        {/* Connected actions */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
          <Btn variant="outline" onClick={()=>thermalPrint("test")} style={{height:44}}><Printer size={14}/> Test impression</Btn>
          <Btn variant="outline" onClick={()=>thermalPrint("drawer")} style={{height:44}}><Box size={14}/> Ouvrir tiroir</Btn>
          <Btn variant="danger" onClick={async()=>{await disconnectPrinter();}} style={{height:44}}><XCircle size={14}/> Déconnecter</Btn></div>
      </>}

      {/* Label printer section */}
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginTop:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <ScanLine size={18} color={C.accent}/>
          <div><h3 style={{fontSize:14,fontWeight:700,margin:0}}>Imprimante étiquettes / Code-barres</h3>
            <p style={{fontSize:10,color:C.textMuted,margin:0}}>Imprimez des étiquettes code-barres EAN pour vos produits</p></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>FORMAT ÉTIQUETTE</label>
            <select value={settings.labelFormat||"50x30"} onChange={e=>setSettings(s=>({...s,labelFormat:e.target.value}))}
              style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
              <option value="50x30">50×30 mm</option><option value="40x25">40×25 mm</option><option value="60x40">60×40 mm</option><option value="30x20">30×20 mm</option></select></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>CONTENU ÉTIQUETTE</label>
            <select value={settings.labelContent||"ean+price"} onChange={e=>setSettings(s=>({...s,labelContent:e.target.value}))}
              style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
              <option value="ean+price">Code-barres + Prix</option><option value="ean+name">Code-barres + Nom</option><option value="ean+name+price">Code-barres + Nom + Prix</option><option value="ean">Code-barres seul</option></select></div></div>
        <p style={{fontSize:10,color:C.textMuted,marginBottom:10,lineHeight:1.5}}>
          Pour imprimer des étiquettes, allez dans <strong>Produits</strong>, cliquez sur un produit puis sur <strong>🏷️ Imprimer étiquettes</strong>. Vous pouvez imprimer par variante (taille/couleur) avec le nombre d'exemplaires souhaité.</p>
        <Btn onClick={()=>{saveSettingsToAPI(settings);notify("Paramètres étiquettes sauvegardés","success");}}
          style={{width:"100%",height:40,background:C.accent}}><Save size={14}/> Enregistrer les paramètres étiquettes</Btn>
      </div>

      {/* Info box */}
      <div style={{background:C.surfaceAlt,borderRadius:12,padding:14,marginTop:14,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>ℹ️ Imprimantes compatibles</div>
        <div style={{fontSize:10,color:C.textMuted,lineHeight:1.6}}>
          <strong>Tickets (Port série/USB):</strong> Epson TM-T20II/III, TM-T88V/VI, Star TSP100/TSP650, Bixolon SRP-350<br/>
          <strong>Étiquettes:</strong> Zebra ZD220/ZD420, Dymo LabelWriter, Brother QL-800, Godex, TSC (impression via navigateur)<br/>
          <strong>Protocole tickets:</strong> ESC/POS standard<br/>
          <strong>Protocole étiquettes:</strong> Impression PDF via le navigateur (compatible toutes imprimantes)<br/>
          <strong>Tiroir-caisse:</strong> Ouverture automatique via signal RJ11</div></div>
    </div>}

    {tab==="return"&&<div style={{maxWidth:600}}>
      <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <RotateCcw size={20} color={C.primary}/>
          <div><h3 style={{fontSize:16,fontWeight:800,margin:0}}>Politique de retour</h3>
            <p style={{fontSize:11,color:C.textMuted,margin:0}}>Configurez les règles de retour et d'échange</p></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>DÉLAI DE RETOUR (jours)</label>
            <Input type="number" value={settings.returnPolicy?.days||30} onChange={e=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,days:parseInt(e.target.value)||30}}))}/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>MONTANT MAX SANS APPROBATION (€)</label>
            <Input type="number" value={settings.returnPolicy?.maxNoApproval||100} onChange={e=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,maxNoApproval:parseFloat(e.target.value)||100}}))}/></div>
        </div>
        <div style={{marginBottom:12}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>CONDITIONS DE RETOUR</label>
          <textarea value={settings.returnPolicy?.conditions||""} onChange={e=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,conditions:e.target.value}}))}
            style={{width:"100%",height:70,padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit",resize:"vertical"}}
            placeholder="Article non porté, étiquette présente…"/></div>
        <div style={{marginBottom:12}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>MESSAGE SUR LE TICKET D'AVOIR</label>
          <Input value={settings.returnPolicy?.avoirMsg||""} onChange={e=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,avoirMsg:e.target.value}}))} placeholder="Merci de votre confiance. Avoir valable 12 mois."/></div>
      </div>

      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <h4 style={{fontSize:13,fontWeight:700,marginBottom:12}}>Modes de remboursement autorisés</h4>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[{k:"allowAvoir",l:"Avoir / Crédit magasin",d:"Émettre un bon d'avoir utilisable en magasin"},
            {k:"allowCashRefund",l:"Remboursement espèces",d:"Rembourser en espèces au client"},
            {k:"allowCardRefund",l:"Remboursement carte",d:"Rembourser sur la carte bancaire du client"},
            {k:"allowExchange",l:"Échange article",d:"Échanger contre un autre article"}].map(opt=>{
            const val=settings.returnPolicy?.[opt.k]!==false;
            return(<button key={opt.k} onClick={()=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,[opt.k]:!val}}))}
              style={{padding:12,borderRadius:12,border:`2px solid ${val?C.primary:C.border}`,background:val?`${C.primary}08`:"#fff",cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${val?C.primary:C.border}`,background:val?C.primary:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {val&&<Check size={10} color="#fff"/>}</div>
                <span style={{fontSize:12,fontWeight:600,color:val?C.primary:C.text}}>{opt.l}</span></div>
              <p style={{fontSize:10,color:C.textMuted,margin:0,paddingLeft:22}}>{opt.d}</p>
            </button>);})}
        </div>
      </div>

      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <h4 style={{fontSize:13,fontWeight:700,marginBottom:12}}>Options de retour</h4>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[{k:"autoRestock",l:"Remise en stock automatique",d:"Remettre automatiquement les articles retournés en stock"},
            {k:"requireReceipt",l:"Ticket obligatoire",d:"Exiger le ticket de caisse pour effectuer un retour (désactiver pour autoriser les retours libres)"},
            {k:"printAvoir",l:"Imprimer le ticket d'avoir",d:"Imprimer automatiquement un justificatif d'avoir"},
            {k:"requireReason",l:"Motif obligatoire",d:"Exiger un motif pour chaque retour"}].map(opt=>{
            const val=settings.returnPolicy?.[opt.k]!==false;
            return(<div key={opt.k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:10,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
              <div><div style={{fontSize:12,fontWeight:600}}>{opt.l}</div>
                <div style={{fontSize:10,color:C.textMuted}}>{opt.d}</div></div>
              <button onClick={()=>setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,[opt.k]:!val}}))}
                style={{width:40,height:22,borderRadius:11,border:"none",cursor:"pointer",background:val?C.primary:C.border,position:"relative",transition:"all 0.2s"}}>
                <div style={{width:16,height:16,borderRadius:8,background:"#fff",position:"absolute",top:3,left:val?21:3,transition:"all 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.15)"}}/></button>
            </div>);})}
        </div>
      </div>

      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <h4 style={{fontSize:13,fontWeight:700,marginBottom:8}}>Motifs de retour personnalisés</h4>
        <p style={{fontSize:10,color:C.textMuted,marginBottom:10}}>Ces motifs seront proposés dans la caisse lors d'un retour.</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {(settings.returnPolicy?.reasons||["Échange taille","Échange couleur","Défectueux","Ne convient pas","Erreur achat","Autre"]).map((r,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:8,background:C.surfaceAlt,border:`1px solid ${C.border}`,fontSize:11}}>
              {r}<button onClick={()=>{const reasons=[...(settings.returnPolicy?.reasons||["Échange taille","Échange couleur","Défectueux","Ne convient pas","Erreur achat","Autre"])];reasons.splice(i,1);setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,reasons}}));}}
                style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}><X size={12} color={C.textMuted}/></button></div>))}
          <input placeholder="Nouveau motif…" id="_newReason" onKeyDown={e=>{if(e.key==="Enter"&&e.target.value.trim()){const r=e.target.value.trim();const reasons=[...(settings.returnPolicy?.reasons||["Échange taille","Échange couleur","Défectueux","Ne convient pas","Erreur achat","Autre"]),r];setSettings(s=>({...s,returnPolicy:{...s.returnPolicy,reasons}}));e.target.value="";}}}
            style={{padding:"4px 10px",borderRadius:8,border:`1.5px dashed ${C.primary}`,background:"transparent",color:C.text,fontSize:11,width:140,outline:"none"}}/>
        </div>
      </div>

      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Politique de retour mise à jour");notify("Paramètres de retour sauvegardés","success");}} style={{width:"100%",height:44,background:C.primary}}><Save size={14}/> Enregistrer les paramètres de retour</Btn>
    </div>}

    {tab==="sizes"&&<SizeSettingsTab notify={notify}/>}

    {tab==="theme"&&<div style={{maxWidth:500}}>
      <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>COULEUR PRINCIPALE</label>
        <div style={{display:"flex",gap:8,alignItems:"center"}}><input type="color" value={theme.primaryColor} onChange={e=>setTheme(t=>({...t,primaryColor:e.target.value}))}
          style={{width:40,height:36,border:"none",cursor:"pointer",borderRadius:8}}/><span style={{fontSize:12}}>{theme.primaryColor}</span></div></div>
      <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>COULEUR ACCENT</label>
        <div style={{display:"flex",gap:8,alignItems:"center"}}><input type="color" value={theme.accentColor} onChange={e=>setTheme(t=>({...t,accentColor:e.target.value}))}
          style={{width:40,height:36,border:"none",cursor:"pointer",borderRadius:8}}/><span style={{fontSize:12}}>{theme.accentColor}</span></div></div>
      <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>URL DU LOGO</label>
        <Input value={settings.logo||""} onChange={e=>setSettings(s=>({...s,logo:e.target.value}))} placeholder="https://…"/></div>
      <div style={{marginTop:16,marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:6}}>ACCESSIBILITÉ</label>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>{setHighContrast(!isHighContrast());window.location.reload();}}
            style={{padding:"8px 16px",borderRadius:8,border:`1.5px solid ${C.border}`,background:isHighContrast()?C.primary:C.surface,
              color:isHighContrast()?"#fff":C.text,fontSize:12,fontWeight:600,cursor:"pointer"}}>
            {isHighContrast()?"Contraste élevé activé":"Activer contraste élevé"}</button>
          <span style={{fontSize:11,color:C.textMuted}}>Augmente le contraste des textes et bordures pour une meilleure lisibilité</span>
        </div></div>
      <p style={{fontSize:10,color:C.textMuted}}>Les changements de thème seront appliqués au prochain rechargement.</p></div>}

    {tab==="clock"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Pointages récents</h3>
      {clockEntries.length===0&&<div style={{textAlign:"center",padding:20,color:C.textLight}}>Aucun pointage</div>}
      {clockEntries.slice(0,30).map(e=>(<div key={e.id} style={{display:"flex",alignItems:"center",gap:8,padding:6,borderBottom:`1px solid ${C.border}`,fontSize:11}}>
        <Badge color={e.type==="IN"?"#059669":C.danger}>{e.type}</Badge>
        <span style={{flex:1,fontWeight:600}}>{e.userName}</span>
        <span style={{color:C.textMuted}}>{new Date(e.date).toLocaleString("fr-FR")}</span></div>))}</div>}

    {tab==="prices"&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Historique des changements de prix</h3>
      {priceHistory.length===0&&<div style={{textAlign:"center",padding:20,color:C.textLight}}>Aucun changement</div>}
      {priceHistory.slice(0,30).map(e=>(<div key={e.id} style={{display:"flex",alignItems:"center",gap:8,padding:6,borderBottom:`1px solid ${C.border}`,fontSize:11}}>
        <span style={{flex:1,fontWeight:600}}>{e.productName}</span>
        <span style={{color:C.danger,textDecoration:"line-through"}}>{e.oldPrice.toFixed(2)}€</span>
        <span>→</span>
        <span style={{color:"#059669",fontWeight:700}}>{e.newPrice.toFixed(2)}€</span>
        <span style={{color:C.textMuted,fontSize:9}}>{e.user} — {new Date(e.date).toLocaleDateString("fr-FR")}</span></div>))}</div>}

    {tab==="tpe"&&<div style={{maxWidth:600}}>
      {/* Payment terminal selection */}
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.primary}22`,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <CreditCard size={18} color={C.primary}/>
          <div><h3 style={{fontSize:14,fontWeight:700,margin:0}}>Terminal de paiement (TPE)</h3>
            <p style={{fontSize:10,color:C.textMuted,margin:0}}>Selectionnez votre solution de paiement par carte. Le montant sera envoye automatiquement au TPE.</p></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {Object.entries(paymentProfiles||{}).map(([id,p])=>(
            <button key={id} onClick={()=>switchPayment(id)} style={{padding:"12px 14px",borderRadius:12,textAlign:"left",cursor:"pointer",
              border:`2px solid ${paymentId===id?C.primary:C.border}`,background:paymentId===id?C.primaryLight:"transparent",transition:"all 0.15s"}}>
              <div style={{fontSize:12,fontWeight:700,color:paymentId===id?C.primary:C.text,marginBottom:2}}>{p.name}</div>
              <div style={{fontSize:9,color:C.textMuted}}>{p.description}</div>
            </button>))}
        </div>
      </div>

      {/* TPE Configuration fields */}
      {paymentProfiles[paymentId]?.requiresConfig&&<div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <h4 style={{fontSize:13,fontWeight:700,marginBottom:10}}>Configuration {paymentProfiles[paymentId]?.name}</h4>
        {(paymentProfiles[paymentId]?.configFields||[]).map(f=>(
          <div key={f.key} style={{marginBottom:10}}>
            <label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>{f.label}</label>
            {f.type==="select"?
              <select value={paymentConfig[f.key]||""} onChange={e=>updatePaymentConfig({[f.key]:e.target.value})}
                style={{width:"100%",padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit"}}>
                <option value="">-- Choisir --</option>
                {(f.options||[]).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            :<Input value={paymentConfig[f.key]||""} onChange={e=>updatePaymentConfig({[f.key]:e.target.value})}
                placeholder={f.placeholder||""} type={f.type||"text"}/>}
          </div>))}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Btn onClick={()=>{notify("Configuration TPE sauvegardee","success");}} style={{height:40,background:C.primary}}>
            <Save size={14}/> Sauvegarder</Btn>
          {paymentId==="concert"&&<Btn onClick={async()=>{
            setDiagLoading(true);
            try{
              const adapter=hardwareManager.payment;
              if(adapter?.testConnection){
                const r=await adapter.testConnection();
                setPrinterDiag({tpe:true,concertTest:r,timestamp:new Date().toLocaleTimeString('fr-FR')});
                notify(r.success?"TPE accessible: "+r.message:"TPE injoignable: "+r.error,r.success?"success":"error");
              }else{
                notify("Adaptateur Concert non actif — sauvegardez d'abord la config","warn");
              }
            }catch(e){notify("Erreur: "+e.message,"error");}
            setDiagLoading(false);
          }} disabled={diagLoading} style={{height:40,background:C.info}}>
            <Activity size={14}/> {diagLoading?"Test...":"Tester connexion TPE"}</Btn>}
        </div>
        {paymentId==="concert"&&<div style={{marginTop:10,background:C.infoLight,borderRadius:10,padding:12,border:`1px solid ${C.info}22`,fontSize:11,color:C.text,lineHeight:1.6}}>
          <strong>Configuration du Ingenico Desk/5000 :</strong><br/>
          1. Sur le TPE: Menu Technique &gt; Communication &gt; Ethernet &gt; notez l'adresse IP<br/>
          2. Entrez cette IP ci-dessus (ex: 192.168.1.50)<br/>
          3. Port par defaut: 8888 (varie selon config)<br/>
          4. Le TPE doit etre en <strong>mode caisse/ECR</strong> (demandez a votre prestataire monetique)<br/>
          5. Cliquez "Tester connexion" pour verifier
        </div>}
      </div>}

      {/* TPE Diagnostic */}
      <div style={{background:C.surface,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <Activity size={18} color={C.info}/>
          <div><h3 style={{fontSize:14,fontWeight:700,margin:0}}>Diagnostic TPE</h3>
            <p style={{fontSize:10,color:C.textMuted,margin:0}}>Verifiez la detection du terminal de paiement</p></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <Btn onClick={async()=>{
            setDiagLoading(true);
            try{
              const cap=!!window.Capacitor?.isNativePlatform?.();
              const plugins=Object.keys(window.Capacitor?.Plugins||{});
              const bridge=window.Capacitor?.Plugins?.PaymentTerminal;
              let hwInfo=null;
              if(bridge){try{hwInfo=await bridge.detectHardware();}catch(e){hwInfo={error:e.message};}}
              setPrinterDiag({tpe:true,capacitor:cap,plugins,hasPaymentPlugin:!!bridge,hwInfo,paymentId,timestamp:new Date().toLocaleTimeString('fr-FR')});
            }catch(e){setPrinterDiag({tpe:true,error:e.message});}
            setDiagLoading(false);
          }} disabled={diagLoading} style={{height:40,background:C.info,fontSize:11}}>
            <Activity size={13}/> {diagLoading?"Analyse...":"Diagnostic TPE"}</Btn>
          <Btn onClick={async()=>{
            setDiagLoading(true);
            try{
              const result=await hardwareManager.charge(0.01,{currency:'EUR',reference:'TEST-'+Date.now(),method:'card'});
              setPrinterDiag(prev=>({...prev,testCharge:result,timestamp:new Date().toLocaleTimeString('fr-FR')}));
              notify("Test TPE: "+(result?.success?"OK":"echec - "+(result?.error||result?.status)),"info");
            }catch(e){setPrinterDiag(prev=>({...prev,testChargeError:e.message}));notify("Erreur test: "+e.message,"error");}
            setDiagLoading(false);
          }} disabled={diagLoading} style={{height:40,background:C.primary,fontSize:11}}>
            <CreditCard size={13}/> Test paiement (0.01 EUR)</Btn>
        </div>
        {printerDiag?.tpe&&<div style={{background:"#0F172A",borderRadius:10,padding:12,fontFamily:"monospace",fontSize:10,color:"#E2E8F0",maxHeight:300,overflow:"auto",whiteSpace:"pre-wrap"}}>
          {JSON.stringify(printerDiag,null,2)}
        </div>}
      </div>

      {/* Payment status info */}
      <div style={{background:C.surfaceAlt,borderRadius:14,padding:16,border:`1.5px solid ${C.border}`}}>
        <h4 style={{fontSize:13,fontWeight:700,marginBottom:8}}>Fonctionnement</h4>
        <div style={{fontSize:11,color:C.textMuted,lineHeight:1.6}}>
          {paymentId==="manual"&&<>Mode manuel: le caissier encaisse sur le TPE separement puis confirme le paiement dans CaissePro. Aucune connexion au TPE necessaire.</>}
          {paymentId==="concert"&&<>Le protocole Concert envoie automatiquement le montant au pinpad. Le client presente sa carte, et la reponse (accepte/refuse) revient dans CaissePro. Standard francais compatible Ingenico, Verifone, Worldline.</>}
          {paymentId==="sumup"&&<>CaissePro ouvre l'app SumUp avec le montant pre-rempli. Le paiement se fait sur le lecteur SumUp, puis le resultat revient dans CaissePro.</>}
          {paymentId==="stripe"&&<>Stripe Terminal se connecte au lecteur (BBPOS Chipper, Verifone P400) via Internet. Le paiement est traite par Stripe avec retour automatique dans CaissePro.</>}
          {paymentId==="zettle"&&<>CaissePro ouvre l'app Zettle avec le montant. Le paiement se fait sur le lecteur Zettle, compatible CB, Amex, Apple Pay.</>}
          {paymentId==="worldline"&&<>Connexion directe au TPE Worldline (VALINA, YOMANI, LANE) via le protocole NEXO ou l'API REST locale.</>}
          {paymentId==="pax_pay"&&<>Paiement integre sur le terminal PAX. Le montant est envoye directement au module de paiement interne.</>}
          {paymentId==="sunmi_pay"&&<>Paiement integre sur Sunmi P-series. Le module NFC/puce de la Sunmi traite le paiement directement.</>}
        </div>
      </div>
    </div>}

    {tab==="receipt"&&<div style={{maxWidth:550}}>
      <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
        <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 4px"}}>Personnalisation du ticket</h3>
        <p style={{fontSize:11,color:C.textMuted,margin:0}}>Configurez l'apparence et les informations affichées sur vos tickets de caisse.</p></div>
      <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>Logo du ticket</label>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
          {settings.receiptLogo&&<img src={settings.receiptLogo} alt="Logo" style={{maxHeight:40,maxWidth:120,objectFit:"contain",borderRadius:6,border:`1px solid ${C.border}`,padding:4}}/>}
          <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:10,border:`1.5px solid ${C.border}`,cursor:"pointer",fontSize:11,fontWeight:600,color:C.text,background:C.surface,transition:"all 0.15s"}}>
            <Upload size={14}/> Importer une image
            <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
              const file=e.target.files?.[0];if(!file)return;
              if(file.size>500000){notify("Image trop lourde (max 500 Ko)","error");return;}
              const reader=new FileReader();
              reader.onload=ev=>{setSettings(s=>({...s,receiptLogo:ev.target.result}));notify("Logo importé","success");};
              reader.readAsDataURL(file);
            }}/></label>
          {settings.receiptLogo&&<button onClick={()=>setSettings(s=>({...s,receiptLogo:""}))} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${C.danger}30`,background:"transparent",cursor:"pointer",fontSize:10,fontWeight:600,color:C.danger}}>Supprimer</button>}
        </div>
        <Input value={settings.receiptLogo&&!settings.receiptLogo.startsWith("data:")?settings.receiptLogo:""} onChange={e=>setSettings(s=>({...s,receiptLogo:e.target.value}))} placeholder="Ou collez une URL : https://example.com/logo.png" style={{fontSize:10}}/></div>
      <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>Message d'en-tête</label>
        <Input value={settings.receiptHeader||""} onChange={e=>setSettings(s=>({...s,receiptHeader:e.target.value}))} placeholder="Merci pour votre achat !"/></div>
      <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>Message de remerciement (affiché en gros)</label>
        <Input value={settings.footerMsg||""} onChange={e=>setSettings(s=>({...s,footerMsg:e.target.value}))} placeholder="Merci de votre visite !"/></div>
      <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>Texte libre en bas du ticket (multiligne)</label>
        <textarea value={settings.ticketFreeText||""} onChange={e=>setSettings(s=>({...s,ticketFreeText:e.target.value}))} placeholder={"Ex: Échange sous 30 jours sur présentation du ticket.\nSuivez-nous sur Instagram @maboutique"}
          style={{width:"100%",minHeight:70,padding:10,borderRadius:10,border:`2px solid ${C.border}`,fontSize:12,fontFamily:"inherit",resize:"vertical"}}/></div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Champs affichés sur le ticket</div>
        {[{k:"showShopName",l:"Nom de la boutique"},{k:"showAddress",l:"Adresse"},{k:"showSiret",l:"SIRET"},{k:"showPhone",l:"Téléphone"},{k:"showTvaDetails",l:"Détails TVA"},{k:"showSellerName",l:"Nom du vendeur"},{k:"showDateTime",l:"Date et heure"}].map(f=>{
          const rf=settings.receiptFields||{showShopName:true,showAddress:true,showSiret:true,showPhone:true,showTvaDetails:true,showSellerName:true,showDateTime:true};
          const checked=rf[f.k]!==false;
          return(<div key={f.k} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:8,background:C.surfaceAlt,marginBottom:4,cursor:"pointer"}}
            onClick={()=>setSettings(s=>({...s,receiptFields:{...(s.receiptFields||{showShopName:true,showAddress:true,showSiret:true,showPhone:true,showTvaDetails:true,showSellerName:true,showDateTime:true}),[f.k]:!checked}}))}>
            <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${checked?C.primary:C.border}`,background:checked?C.primary:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {checked&&<Check size={12} color="#fff"/>}</div>
            <span style={{fontSize:12,fontWeight:500}}>{f.l}</span></div>);})}</div>
      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Paramètres ticket mis à jour");notify("Paramètres ticket sauvegardés","success");}} style={{width:"100%",height:40,background:C.primary}}><Save size={14}/> Enregistrer</Btn>
    </div>}

    {tab==="screen2"&&<div style={{maxWidth:600}}>
      <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
        <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 4px"}}>Personnalisation Écran 2</h3>
        <p style={{fontSize:11,color:C.textMuted,margin:0}}>Configurez l'apparence de l'écran client (affichage secondaire).</p></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>Couleur de fond</label>
          <div style={{display:"flex",gap:6,alignItems:"center"}}><input type="color" value={settings.screen2BgColor||"#1A2830"} onChange={e=>setSettings(s=>({...s,screen2BgColor:e.target.value}))} style={{width:36,height:36,border:"none",borderRadius:8,cursor:"pointer"}}/>
            <Input value={settings.screen2BgColor||"#1A2830"} onChange={e=>setSettings(s=>({...s,screen2BgColor:e.target.value}))} style={{flex:1}}/></div></div>
        <div><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>Couleur d'accent</label>
          <div style={{display:"flex",gap:6,alignItems:"center"}}><input type="color" value={settings.screen2AccentColor||C.primary} onChange={e=>setSettings(s=>({...s,screen2AccentColor:e.target.value}))} style={{width:36,height:36,border:"none",borderRadius:8,cursor:"pointer"}}/>
            <Input value={settings.screen2AccentColor||C.primary} onChange={e=>setSettings(s=>({...s,screen2AccentColor:e.target.value}))} style={{flex:1}}/></div></div></div>
      <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>URL du logo</label>
        <Input value={settings.screen2Logo||""} onChange={e=>setSettings(s=>({...s,screen2Logo:e.target.value}))} placeholder="https://example.com/logo.png"/></div>
      <div style={{marginBottom:14}}><label style={{fontSize:10,fontWeight:600,color:C.textMuted,display:"block",marginBottom:3}}>Message d'accueil</label>
        <Input value={settings.screen2WelcomeMsg||""} onChange={e=>setSettings(s=>({...s,screen2WelcomeMsg:e.target.value}))} placeholder="Bienvenue"/></div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Aperçu</div>
        <div style={{width:"100%",height:180,borderRadius:14,background:settings.screen2BgColor||"#1A2830",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,border:`1.5px solid ${C.border}`}}>
          {settings.screen2Logo&&<img src={settings.screen2Logo} alt="logo" style={{maxHeight:40,maxWidth:120,objectFit:"contain"}}/>}
          <div style={{fontSize:20,fontWeight:800,color:settings.screen2AccentColor||C.primary}}>{settings.screen2WelcomeMsg||"Bienvenue"}</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>Aperçu de l'écran client</div></div></div>
      <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Paramètres Écran 2 mis à jour");notify("Paramètres Écran 2 sauvegardés","success");}} style={{width:"100%",height:40,background:C.primary}}><Save size={14}/> Enregistrer</Btn>

      <div style={{background:C.surface,borderRadius:16,padding:20,border:`1.5px solid ${C.border}`,marginTop:20}}>
        <h3 style={{fontSize:14,fontWeight:800,margin:"0 0 4px"}}>Configuration Sunmi T2 / D2</h3>
        <p style={{fontSize:11,color:C.textMuted,marginBottom:12}}>Pour afficher l'ecran client sur le second ecran Sunmi, installez l'APK "CaissePro Display" et renseignez ces informations :</p>
        <div style={{background:C.bg,borderRadius:10,padding:12,marginBottom:8}}>
          <div style={{fontSize:10,fontWeight:600,color:C.textMuted,marginBottom:2}}>URL FRONTEND</div>
          <div style={{fontSize:12,fontWeight:700,fontFamily:"monospace",wordBreak:"break-all",cursor:"pointer",color:C.primary}}
            onClick={()=>{navigator.clipboard.writeText(window.location.origin).then(()=>notify("Copie !","info"));}}>{window.location.origin} <span style={{fontSize:9,color:C.textMuted}}>(cliquer pour copier)</span></div></div>
        <div style={{background:C.bg,borderRadius:10,padding:12,marginBottom:8}}>
          <div style={{fontSize:10,fontWeight:600,color:C.textMuted,marginBottom:2}}>URL API BACKEND</div>
          <div style={{fontSize:12,fontWeight:700,fontFamily:"monospace",wordBreak:"break-all",cursor:"pointer",color:C.primary}}
            onClick={()=>{const u=(import.meta.env.VITE_API_URL||"https://api.techincash.app");navigator.clipboard.writeText(u).then(()=>notify("Copie !","info"));}}>{import.meta.env.VITE_API_URL||"https://api.techincash.app"} <span style={{fontSize:9,color:C.textMuted}}>(cliquer pour copier)</span></div></div>
        <div style={{background:C.bg,borderRadius:10,padding:12,marginBottom:8}}>
          <div style={{fontSize:10,fontWeight:600,color:C.textMuted,marginBottom:2}}>ID MAGASIN</div>
          <div style={{fontSize:12,fontWeight:700,fontFamily:"monospace",wordBreak:"break-all",cursor:"pointer",color:C.primary}}
            onClick={()=>{navigator.clipboard.writeText(effectiveStoreId||"").then(()=>notify("Copie !","info"));}}>{effectiveStoreId||"Non configure"} <span style={{fontSize:9,color:C.textMuted}}>(cliquer pour copier)</span></div></div>
        <div style={{background:C.bg,borderRadius:10,padding:12,marginBottom:8}}>
          <div style={{fontSize:10,fontWeight:600,color:C.textMuted,marginBottom:2}}>TOKEN ECRAN (securite)</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div id="displayTokenValue" style={{fontSize:12,fontWeight:700,fontFamily:"monospace",wordBreak:"break-all",cursor:"pointer",color:C.primary,flex:1}}
              onClick={()=>{const el=document.getElementById("displayTokenValue");if(el&&el.textContent&&el.textContent!=="Cliquez Generer")navigator.clipboard.writeText(el.textContent.replace(/ \(cliquer.*$/,"")).then(()=>notify("Token copie !","info"));}}>
              {effectiveStoreId?"Cliquez Generer":"Selectionnez un magasin d'abord"}</div>
            <Btn size="sm" style={{background:C.primary,fontSize:11,whiteSpace:"nowrap"}} onClick={async()=>{
              if(!effectiveStoreId){notify("Selectionnez un magasin d'abord","warn");return;}
              try{const r=await API.customerDisplay.getToken(effectiveStoreId);
                const el=document.getElementById("displayTokenValue");
                if(el)el.textContent=r.token;
                navigator.clipboard.writeText(r.token).then(()=>notify("Token genere et copie !","success"));
              }catch(e){notify("Erreur: "+e.message,"error");}
            }}>Generer</Btn></div></div>
        <div style={{fontSize:10,color:C.textMuted,marginTop:8,lineHeight:1.5}}>
          1. Sur l'ecran secondaire, ouvrez la page ecran client<br/>
          2. Renseignez l'URL API, l'ID magasin et le Token ci-dessus<br/>
          3. Le second ecran affiche le panier client en temps reel</div>
      </div>
    </div>}

    {tab==="caticons"&&(()=>{
      const EMOJI_GRID=["👕","👖","👗","🧶","👔","🧥","👟","👜","👒","🧣","🧤","👙","👠","🥿","👞","👢","🎒","💍","⌚","🕶️","👚","🩳","🩱","🧢","📦","🎀","✂️","🪡","🧵","💎","🛍️","👘","🥋","🧸","🎁","🏷️"];
      const allCats=allCategories.filter(c=>c!=="Tous");
      const customCats=settings.customCategories||[];
      const defaultCatNames=["T-shirts","Jeans","Robes","Pulls","Chemises","Vestes"];
      // Products count per category
      const prodCountByCat={};products.forEach(p=>{if(p.category)prodCountByCat[p.category]=(prodCountByCat[p.category]||0)+1;});
      return(<div style={{maxWidth:650}}>
        <div style={{background:C.primaryLight,borderRadius:16,padding:20,border:`1.5px solid ${C.primary}22`,marginBottom:16}}>
          <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 4px"}}>Gestion des catégories</h3>
          <p style={{fontSize:11,color:C.textMuted,margin:0}}>Ajoutez, modifiez et personnalisez les catégories et leurs icônes. Les icônes s'affichent sur les cartes produit en caisse.</p></div>

        {/* Add new category */}
        <div style={{background:C.surface,borderRadius:12,padding:14,border:`1.5px dashed ${C.primary}44`,marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Ajouter une catégorie</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <Input id="newCatName" placeholder="Nom de la catégorie" style={{flex:1,height:36,fontSize:12}}/>
            <Btn onClick={()=>{
              const inp=document.getElementById("newCatName");const name=(inp?.value||"").trim();
              if(!name){notify("Entrez un nom de catégorie","error");return;}
              if(allCats.includes(name)){notify("Cette catégorie existe déjà","error");return;}
              const newCat={name,icon:"📦"};
              setSettings(s=>({...s,customCategories:[...(s.customCategories||[]),newCat]}));
              inp.value="";notify(`Catégorie "${name}" ajoutée`,"success");
            }} style={{height:36,padding:"0 16px",background:C.primary}}><Plus size={14}/> Ajouter</Btn>
          </div>
        </div>

        {/* Categories list */}
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
          {allCats.map(c=>{
            const isCustom=customCats.some(cc=>cc.name===c);
            const isDefault=defaultCatNames.includes(c);
            const icon=(settings.categoryIcons||{})[c]||DEFAULT_CAT_ICONS[c]||"📦";
            const count=prodCountByCat[c]||0;
            return(<div key={c} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,background:C.surface,border:`1.5px solid ${C.border}`,transition:"all 0.15s"}}>
              {/* Emoji picker dropdown */}
              <div style={{position:"relative"}}>
                <button onClick={e=>{const dd=e.currentTarget.nextElementSibling;dd.style.display=dd.style.display==="none"?"block":"none";}}
                  style={{width:40,height:40,borderRadius:10,border:`1.5px solid ${C.border}`,background:C.surfaceAlt,cursor:"pointer",fontSize:22,display:"flex",alignItems:"center",justifyContent:"center"}}>{icon}</button>
                <div style={{display:"none",position:"absolute",top:44,left:0,zIndex:50,background:C.surface,borderRadius:12,padding:8,border:`1.5px solid ${C.border}`,boxShadow:`0 8px 24px ${C.shadowLg}`,width:220}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:4}}>
                    {EMOJI_GRID.map(em=>(
                      <button key={em} onClick={e=>{
                        setSettings(s=>({...s,categoryIcons:{...(s.categoryIcons||{}),[c]:em}}));
                        e.currentTarget.closest("div[style*='position: absolute']").style.display="none";
                      }} style={{width:32,height:32,borderRadius:6,border:"none",background:icon===em?C.primaryLight:"transparent",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.1s"}}
                        onMouseEnter={e=>e.currentTarget.style.background=C.surfaceAlt} onMouseLeave={e=>e.currentTarget.style.background=icon===em?C.primaryLight:"transparent"}>{em}</button>))}
                  </div>
                  <div style={{marginTop:6,borderTop:`1px solid ${C.border}`,paddingTop:6}}>
                    <Input placeholder="Ou tapez un emoji..." onChange={e=>{if(e.target.value)setSettings(s=>({...s,categoryIcons:{...(s.categoryIcons||{}),[c]:e.target.value}}));}} style={{width:"100%",height:28,fontSize:14,textAlign:"center"}}/></div>
                </div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700}}>{c}</div>
                <div style={{fontSize:10,color:C.textMuted}}>{count} produit{count>1?"s":""}{isDefault?" — par défaut":""}{isCustom?" — personnalisée":""}</div>
              </div>
              {isCustom&&<Btn variant="ghost" onClick={()=>{
                if(count>0){notify(`Impossible de supprimer: ${count} produit(s) utilisent cette catégorie`,"error");return;}
                setSettings(s=>({...s,customCategories:(s.customCategories||[]).filter(cc=>cc.name!==c),categoryIcons:(()=>{const ic={...(s.categoryIcons||{})};delete ic[c];return ic;})()}));
                notify(`Catégorie "${c}" supprimée`);
              }} style={{padding:"4px 8px",color:C.danger,fontSize:10}}><Trash2 size={12}/></Btn>}
            </div>);
          })}
        </div>

        {/* Bulk reassign category for products */}
        <div style={{background:C.surfaceAlt,borderRadius:12,padding:14,border:`1px solid ${C.border}`,marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Changer la catégorie de produits existants</div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            <select id="bulkCatFrom" style={{height:34,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:11,padding:"0 8px",fontFamily:"inherit",background:C.surface}}>
              <option value="">De (catégorie actuelle)</option>{allCats.map(c=><option key={c} value={c}>{c} ({prodCountByCat[c]||0})</option>)}</select>
            <span style={{fontSize:11,color:C.textMuted,fontWeight:600}}>vers</span>
            <select id="bulkCatTo" style={{height:34,borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:11,padding:"0 8px",fontFamily:"inherit",background:C.surface}}>
              <option value="">Vers (nouvelle catégorie)</option>{allCats.map(c=><option key={c} value={c}>{c}</option>)}</select>
            <Btn variant="outline" onClick={async()=>{
              const from=document.getElementById("bulkCatFrom")?.value;const to=document.getElementById("bulkCatTo")?.value;
              if(!from||!to){notify("Sélectionnez les deux catégories","error");return;}
              if(from===to){notify("Les catégories sont identiques","error");return;}
              const toMove=products.filter(p=>p.category===from);
              if(!toMove.length){notify(`Aucun produit dans "${from}"`,"error");return;}
              let ok=0;for(const p of toMove){try{await updateProduct(p.id,{category:to});ok++;}catch(e){}}
              notify(`${ok}/${toMove.length} produit(s) déplacés de "${from}" vers "${to}"`,"success");
              addAudit("CONFIG",`Catégorie bulk: ${from} → ${to} (${ok} produits)`);
            }} style={{height:34,fontSize:11,padding:"0 14px"}}>Déplacer</Btn>
          </div>
        </div>

        <Btn onClick={()=>{saveSettingsToAPI(settings);addAudit("CONFIG","Catégories et icônes mis à jour");notify("Catégories sauvegardées","success");}} style={{width:"100%",height:44,background:C.primary,fontSize:13}}><Save size={14}/> Enregistrer les catégories</Btn>
      </div>);})()}

    {tab==="backup"&&<BackupPanel notify={notify} addAudit={addAudit}/>}

    {tab==="debug"&&<DebugPanel/>}

  </div>);
}

/* ══════════ NAVIGATION ══════════ */
/* ══════════ GIFT CARDS ══════════ */

export default SettingsScreen;
export { SettingsScreen };
