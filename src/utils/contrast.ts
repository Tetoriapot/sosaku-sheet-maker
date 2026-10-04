function rgb(hex: string) {
  const valid = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#7566d8";
  return [1, 3, 5].map((i) => parseInt(valid.slice(i, i + 2), 16));
}
function luminance(hex: string) {
  return rgb(hex)
    .map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrastRatio(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function readableAccent(color: string, background: string) {
  if (contrastRatio(color, background) >= 4.5) return color;
  const original = rgb(color);
  const target =
    contrastRatio("#000000", background) > contrastRatio("#ffffff", background)
      ? 0
      : 255;
  for (let step = 1; step <= 100; step++) {
    const candidate =
      "#" +
      original
        .map((v) =>
          Math.round(v + ((target - v) * step) / 100)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
    if (contrastRatio(candidate, background) >= 4.5) return candidate;
  }
  return target === 0 ? "#000000" : "#ffffff";
}
