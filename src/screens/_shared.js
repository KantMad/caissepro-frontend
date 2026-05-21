// ── Shared helpers for screen components ──
import { getSizeRank } from "../utils.jsx";

function sortSizes(a,b){return getSizeRank(a)-getSizeRank(b);}
function sortVariantsBySize(variants){return[...variants].sort((a,b)=>{
  const ca=(a.color||"").toLowerCase(),cb=(b.color||"").toLowerCase();
  if(ca!==cb)return ca<cb?-1:1;
  return getSizeRank(a.size)-getSizeRank(b.size);
});}

export { sortSizes, sortVariantsBySize };
