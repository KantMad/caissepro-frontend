// ════════════════════════════════════════════════════════════
//  Visuel produit par défaut (quand l'article n'a pas de photo) :
//  silhouette SVG du vêtement, déduite du nom puis de la catégorie,
//  teintée avec la couleur de la variante (« Bleu marine » → #1F2A44).
// ════════════════════════════════════════════════════════════

const strip = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Ordre = priorité : la première famille trouvée dans le nom OU la catégorie gagne
// (ex. « Bemuda chino » mal orthographié, catégorie « Bermuda chino » → short, pas pantalon).
const KINDS = [
  ["shoe", /basket|sneaker|chaussure|mocassin|derby|boots?\b|bottine|sandale|espadrille|soulier/],
  ["short", /bermuda|short/],
  ["pants", /pantalon|jean|chino|jogging|jogger|legging/],
  ["dress", /robe/],
  ["skirt", /jupe/],
  ["jacket", /veste|blazer|manteau|blouson|parka|trench|doudoune|caban|gilet de costume/],
  ["hoodie", /sweat|hoodie|capuche/],
  ["sweater", /pull|cardigan|gilet|maille|tricot/],
  ["tshirt", /t-?shirt|\btee\b|polo|debardeur|top\b/],
  ["shirt", /chemise|surchemise|blouse/],
  ["belt", /ceinture/],
  ["scarf", /echarpe|foulard|etole|cheche/],
  ["cap", /casquette|bonnet|chapeau|bob\b/],
  ["bag", /sac|pochette|besace|tote|cabas|portefeuille/],
];

export const productKind = (name, category) => {
  const n = strip(name), c = strip(category);
  for (const [kind, re] of KINDS) if (re.test(n) || re.test(c)) return kind;
  return "tag";
};

// Couleurs usuelles du prêt-à-porter (noms FR) — du plus précis au plus général.
const COLORS = [
  [/bleu marine|marine|navy/, "#1F2A44"], [/bleu ciel|ciel/, "#9CC3E6"], [/bleu roi/, "#2F54C4"],
  [/brut|denim|indigo/, "#2E3F63"], [/bleu/, "#3B6FB6"], [/anthracite/, "#3A3D42"],
  [/gris chine|chine/, "#9A9EA5"], [/gris clair/, "#C9CCD1"], [/gris/, "#8A8F98"],
  [/noir|black/, "#26272B"], [/blanc casse|ecru|ivoire|creme/, "#EFE8DA"], [/blanc|white/, "#F7F7F5"],
  [/beige|sable|mastic/, "#D8C6A5"], [/camel|cognac|caramel|fauve/, "#B07A45"], [/kaki|olive/, "#6F7247"],
  [/vert sapin|sapin|bouteille/, "#2F5140"], [/vert/, "#4F8A5B"], [/marron|chocolat|brun|tabac/, "#6B4A33"],
  [/bordeaux|lie de vin/, "#6E1F2F"], [/terracotta|rouille/, "#B5553C"], [/rouge/, "#C0392B"],
  [/rose poudre|poudre/, "#E8C3C3"], [/rose|fuchsia/, "#D9779B"], [/moutarde|curry/, "#C99A2E"],
  [/jaune/, "#E9C94A"], [/orange/, "#E07B39"], [/violet|prune|lilas|mauve/, "#7A5595"],
  [/dore|or\b/, "#C9A54A"], [/argent/, "#B8BCC2"],
];

export const colorHex = (colorName, fallback) => {
  const s = strip(colorName);
  if (/^#[0-9a-f]{6}$/i.test(String(colorName || "").trim())) return String(colorName).trim();
  for (const [re, hex] of COLORS) if (re.test(s)) return hex;
  return fallback || "#8A8F98";
};

// Assombrit/éclaircit une couleur hex (pour contours et détails lisibles sur toutes les teintes).
const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + amt)));
  return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map((c) => c.toString(16).padStart(2, "0")).join("");
};
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

// Silhouettes (viewBox 64×64) : forme principale + détails.
const SHAPES = {
  tshirt: { body: "M23 9 L13 13 L5 24 L12 30 L17 26 L17 57 L47 57 L47 26 L52 30 L59 24 L51 13 L41 9 C39 13 36 15 32 15 C28 15 25 13 23 9 Z",
    details: ["M23 9 C25 13 28 15 32 15 C36 15 39 13 41 9"] },
  shirt: { body: "M24 8 L13 12 L7 52 L14 53 L17 28 L17 58 L47 58 L47 28 L50 53 L57 52 L51 12 L40 8 L32 14 Z",
    details: ["M24 8 L28 17 L32 14 L36 17 L40 8", "M32 17 L32 58", "M31 24 h2 M31 32 h2 M31 40 h2 M31 48 h2"] },
  sweater: { body: "M23 9 L12 13 L6 50 L13 52 L17 28 L17 56 L47 56 L47 28 L51 52 L58 50 L52 13 L41 9 C39 12 36 13 32 13 C28 13 25 12 23 9 Z",
    details: ["M17 52 L47 52", "M8 46 L14 47 M56 46 L50 47"] },
  hoodie: { body: "M22 10 C22 3 42 3 42 10 L52 14 L58 50 L51 52 L47 30 L47 57 L17 57 L17 30 L13 52 L6 50 L12 14 Z",
    details: ["M24 11 C26 18 38 18 40 11", "M29 17 L29 26 M35 17 L35 26", "M23 40 h18 v9 h-18 Z"] },
  jacket: { body: "M24 8 L13 12 L7 53 L14 54 L17 28 L17 58 L31 58 L31 22 L33 22 L33 58 L47 58 L47 28 L50 54 L57 53 L51 12 L40 8 L32 20 Z",
    details: ["M24 8 L27 24 L31 30 M40 8 L37 24 L33 30", "M20 44 h7 M37 44 h7"] },
  pants: { body: "M18 6 L46 6 L49 58 L36 58 L32 24 L28 58 L15 58 Z",
    details: ["M18 11 L46 11", "M32 11 L32 24", "M22 11 C22 16 25 17 27 17 M42 11 C42 16 39 17 37 17"] },
  short: { body: "M16 12 L48 12 L51 44 L35 46 L32 28 L29 46 L13 44 Z",
    details: ["M16 17 L48 17", "M32 17 L32 28", "M13.5 40 L29.5 42 M34.5 42 L50.5 40"] },
  dress: { body: "M25 5 L39 5 L38 17 L44 23 L53 58 L11 58 L20 23 L26 17 Z",
    details: ["M25 5 C27 10 37 10 39 5", "M20 23 L44 23"] },
  skirt: { body: "M21 12 L43 12 L53 56 L11 56 Z", details: ["M21 17 L43 17", "M27 17 L22 56 M37 17 L42 56"] },
  shoe: { body: "M5 44 C5 36 9 31 14 31 L23 31 L29 22 C31 21 35 21 38 23 C42 29 49 32 56 34 C59 35 60 38 60 42 L60 46 C60 48 58 49 56 49 L8 49 C6 49 5 47 5 44 Z",
    details: ["M5 44 L60 44", "M28 26 L33 29 M26 29 L31 32 M31 23 L36 26"] },
  belt: { body: "M4 26 L60 26 L60 38 L4 38 Z", details: ["M40 23 h12 v18 h-12 Z", "M46 32 L56 32", "M12 32 h2 M20 32 h2 M28 32 h2"] },
  scarf: { body: "M18 6 L46 6 L46 20 C46 26 40 28 36 30 L40 58 L28 58 L30 30 C24 28 18 26 18 20 Z",
    details: ["M28 54 L28 58 M31 54 L31 58 M34 54 L34 58 M37 54 L37 58", "M18 16 C24 20 40 20 46 16"] },
  cap: { body: "M12 38 C12 22 20 14 32 14 C44 14 52 22 52 38 Z M8 38 L60 38 C60 43 54 45 46 45 L8 45 C6 45 6 38 8 38 Z",
    details: ["M32 14 L32 38", "M32 12 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0"] },
  bag: { body: "M10 24 L54 24 L50 58 L14 58 Z", details: ["M22 24 C22 10 42 10 42 24", "M10 32 L54 32"] },
  tag: { body: "M8 30 L30 8 L56 8 L56 34 L34 56 Z", details: ["M46 18 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0"] },
};

/**
 * <ProductIcon name category color size />
 *  - name/category : servent à choisir la silhouette
 *  - color : nom de couleur de la variante (ou hex) ; fallback = couleur de catégorie
 */
export function ProductIcon({ name, category, color, fallbackColor, size = 48, style }) {
  const kind = productKind(name, category);
  const fill = colorHex(color, fallbackColor);
  const light = luminance(fill) > 0.72;
  const stroke = light ? shade(fill, -90) : shade(fill, -45);
  const detail = light ? shade(fill, -70) : shade(fill, 55);
  const shp = SHAPES[kind] || SHAPES.tag;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} style={{ display: "block", ...style }} aria-hidden="true">
      <path d={shp.body} fill={fill} stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
      {shp.details.map((d, k) => (
        <path key={k} d={d} fill="none" stroke={detail} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      ))}
    </svg>
  );
}
