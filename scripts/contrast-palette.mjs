// Contrast for the studio dark palette. Run: node scripts/contrast-palette.mjs
function oklchToLin(L, C = 0, H = 0) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const cube = (x) => Math.sign(x) * Math.abs(x) ** 3;
  const l = cube(l_);
  const m = cube(m_);
  const s = cube(s_);
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
function hexToLin(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
}
const Y = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
const ratio = (a, b) => {
  const y1 = Y(a);
  const y2 = Y(b);
  return (Math.max(y1, y2) + 0.05) / (Math.min(y1, y2) + 0.05);
};
const over = (fg, alpha, bg) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));
const page = oklchToLin(0.2);
const card = oklchToLin(0.25);
const muted = oklchToLin(0.31);
const field = oklchToLin(0.23);
const side = oklchToLin(0.17);
const fg = oklchToLin(0.97);
const label = oklchToLin(0.8);
const white = oklchToLin(0.99);
const button = oklchToLin(0.55, 0.17, 255);
const link = oklchToLin(0.74, 0.14, 255);
const brand = hexToLin("#3b82f6");
const border = over([1, 1, 1], 0.18, page);
const borderOnCard = over([1, 1, 1], 0.18, card);
const input = over([1, 1, 1], 0.24, field);
function line(name, value, need) {
  const mark = value >= need ? "pass" : "low";
  console.log(`${value.toFixed(2).padStart(5)}  ${mark.padEnd(4)}  ${need}:1  ${name}`);
}
line("body on page", ratio(fg, page), 4.5);
line("body on card", ratio(fg, card), 4.5);
line("body on muted", ratio(fg, muted), 4.5);
line("label on page", ratio(label, page), 4.5);
line("label on card", ratio(label, card), 4.5);
line("label on muted", ratio(label, muted), 4.5);
line("label on field", ratio(label, field), 4.5);
line("white on button oklch(0.55 0.17 255)", ratio(white, button), 4.5);
line("link oklch(0.74 0.14 255) on page", ratio(link, page), 4.5);
line("link on card", ratio(link, card), 4.5);
line("link on muted", ratio(link, muted), 4.5);
line("brand #3b82f6 on page (today)", ratio(brand, page), 4.5);
line("border 18% white vs page", ratio(border, page), 3);
line("border 18% white vs card", ratio(borderOnCard, card), 3);
line("input 24% white vs field", ratio(input, field), 3);
line("card vs page (fill only)", ratio(card, page), 3);
line("sidebar vs page (fill only)", ratio(side, page), 3);
function chip(name, textL, textC, textH, washL, washC, washH) {
  const text = oklchToLin(textL, textC, textH);
  const wash = oklchToLin(washL, washC, washH);
  const mix = over(wash, 0.18, card);
  line(`${name} chip text on 18% wash over card`, ratio(text, mix), 4.5);
}
chip("posted", 0.86, 0.12, 155, 0.55, 0.12, 155);
chip("scheduled", 0.86, 0.1, 255, 0.55, 0.14, 255);
chip("needs", 0.86, 0.12, 85, 0.55, 0.12, 85);
chip("failed", 0.86, 0.14, 25, 0.55, 0.14, 25);
const draft = over(oklchToLin(0.45), 0.18, card);
line("draft label on 18% gray wash over card", ratio(label, draft), 4.5);
