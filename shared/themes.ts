export const themePalettes = {
  simple: {
    label: "シンプル",
    bg: "#ffffff",
    fg: "#242424",
    sub: "#575766",
    line: "#d8d8dc",
  },
  pastel: {
    label: "パステル",
    bg: "#f3effa",
    fg: "#342e48",
    sub: "#625975",
    line: "#d1c8e2",
  },
  dark: {
    label: "ダーク",
    bg: "#252530",
    fg: "#ffffff",
    sub: "#ccccdf",
    line: "#666674",
  },
  notebook: {
    label: "ノート",
    bg: "#fffbed",
    fg: "#35352d",
    sub: "#66614f",
    line: "#d6d0bb",
  },
  mono: {
    label: "モノクロ",
    bg: "#ffffff",
    fg: "#000000",
    sub: "#444444",
    line: "#888888",
  },
  sage: {
    label: "セージ",
    bg: "#edf4ee",
    fg: "#283d31",
    sub: "#536659",
    line: "#b5cbbb",
  },
  rose: {
    label: "ローズ",
    bg: "#fcf0f2",
    fg: "#4c303b",
    sub: "#785967",
    line: "#dcc0ca",
  },
} as const;
export type ThemeName = keyof typeof themePalettes;
