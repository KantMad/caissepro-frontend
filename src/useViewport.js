import { useState, useEffect } from "react";

// ════════════════════════════════════════════════════════════
//  useViewport — hook responsive central
//  Paliers : Téléphone ≤640px · Tablette 641–1024px · Desktop >1024px
//  Renvoie aussi l'orientation pour adapter le split-screen tablette.
// ════════════════════════════════════════════════════════════
const PHONE_MAX = 640;
const TABLET_MAX = 1024;

function read() {
  const w = typeof window !== "undefined" ? window.innerWidth : 1280;
  const h = typeof window !== "undefined" ? window.innerHeight : 800;
  return {
    width: w,
    height: h,
    isMobile: w <= PHONE_MAX,
    isTablet: w > PHONE_MAX && w <= TABLET_MAX,
    isDesktop: w > TABLET_MAX,
    isTouch: w <= TABLET_MAX,
    isPortrait: h >= w,
  };
}

export function useViewport() {
  const [vp, setVp] = useState(read);
  useEffect(() => {
    let raf = null;
    const onChange = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setVp(read()));
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);
  return vp;
}

export default useViewport;
