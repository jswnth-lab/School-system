/** Black or white text, whichever is readable on `hex` (WCAG relative luminance). */
export function readableOn(hex: string): "#111111" | "#ffffff" {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#111111" : "#ffffff";
}
export const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
