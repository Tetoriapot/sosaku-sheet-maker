import type { Answer, Theme } from "../types";
import { valueLabel } from "./model";
import { themePalettes } from "../../shared/themes";
import { readableAccent } from "./contrast";
export interface ExportSettings {
  size: "square" | "portrait" | "story" | "auto";
  theme: Theme;
  name: boolean;
  description: boolean;
  comments: boolean;
}
const WIDTH = 1080,
  MARGIN = 72,
  CONTENT = WIDTH - 2 * MARGIN,
  FOOTER = 64;
interface Line {
  text: string;
  size: number;
  color: string;
  bold?: boolean;
  space?: number;
  rule?: boolean;
}
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
) {
  const result: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const char of Array.from(paragraph)) {
      if (line && ctx.measureText(line + char).width > width) {
        result.push(line);
        line = char;
      } else line += char;
    }
    result.push(line);
  }
  return result;
}
export async function exportImages(
  answer: Answer,
  settings: ExportSettings,
): Promise<Blob[]> {
  await document.fonts.ready;
  const palette = themePalettes[settings.theme];
  const accent =
    settings.theme === "mono"
      ? palette.fg
      : readableAccent(answer.sheet.color, palette.bg);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画像を生成できません");
  const font = (size: number, bold = false) =>
    `${bold ? "600" : "400"} ${size}px "Yu Gothic UI", "Hiragino Sans", sans-serif`;
  const lines: Line[] = [];
  const add = (
    text: string,
    size: number,
    color: string,
    bold = false,
    space = 12,
  ) => {
    ctx.font = font(size, bold);
    const wrapped = wrapText(ctx, text, CONTENT);
    wrapped.forEach((t, i) =>
      lines.push({
        text: t,
        size,
        color,
        bold,
        space: i === wrapped.length - 1 ? space : 0,
      }),
    );
  };
  add("CREATIVE SHEET", 20, accent, true, 20);
  add(answer.sheet.title, 46, palette.fg, true, 24);
  if (settings.description && answer.sheet.description)
    add(answer.sheet.description, 26, palette.sub, false, 24);
  if (settings.name && answer.respondentName)
    add(`回答：${answer.respondentName}`, 26, palette.fg, false, 24);
  for (const section of answer.sheet.sections) {
    add(`${section.icon} ${section.title}`, 32, accent, true, 16);
    if (settings.description && section.description)
      add(section.description, 24, palette.sub, false, 14);
    for (const q of section.questions) {
      add(q.text, 28, palette.fg, true, 8);
      if (settings.description && q.description)
        add(q.description, 23, palette.sub, false, 8);
      add(valueLabel(q, answer.answers[q.id]), 28, palette.fg, false, 12);
      if (settings.comments && answer.comments[q.id])
        add(answer.comments[q.id], 24, palette.sub, false, 12);
      lines.push({
        text: "",
        size: 0,
        color: palette.line,
        space: 20,
        rule: true,
      });
    }
  }
  const heightFor = (line: Line) => line.size * 1.55 + (line.space ?? 0);
  const requested =
    settings.size === "square"
      ? 1080
      : settings.size === "portrait"
        ? 1350
        : settings.size === "story"
          ? 1920
          : 0;
  const total =
    lines.reduce((v, l) => v + heightFor(l), 0) + MARGIN * 2 + FOOTER;
  const pageHeight =
    requested || Math.min(Math.max(400, Math.ceil(total)), 12000);
  const limit = pageHeight - MARGIN - FOOTER;
  const pages: Line[][] = [[]];
  let y = MARGIN;
  for (const line of lines) {
    if (y + heightFor(line) > limit && pages.at(-1)!.length) {
      pages.push([]);
      y = MARGIN;
    }
    pages.at(-1)!.push(line);
    y += heightFor(line);
  }
  const blobs: Blob[] = [];
  for (let page = 0; page < pages.length; page++) {
    canvas.width = WIDTH;
    canvas.height = pageHeight;
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, WIDTH, pageHeight);
    if (settings.theme === "notebook") {
      ctx.strokeStyle = palette.line;
      ctx.lineWidth = 1;
      for (let ly = 44; ly < pageHeight; ly += 44) {
        ctx.beginPath();
        ctx.moveTo(MARGIN, ly);
        ctx.lineTo(WIDTH - MARGIN, ly);
        ctx.stroke();
      }
    }
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, WIDTH, 10);
    ctx.textBaseline = "top";
    let y = MARGIN;
    for (const line of pages[page]) {
      ctx.font = font(line.size, line.bold);
      ctx.fillStyle = line.color;
      if (line.rule) {
        ctx.strokeStyle = palette.line;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(MARGIN, y);
        ctx.lineTo(WIDTH - MARGIN, y);
        ctx.stroke();
      } else ctx.fillText(line.text, MARGIN, y);
      y += heightFor(line);
    }
    ctx.font = font(20);
    ctx.fillStyle = palette.sub;
    ctx.fillText(
      `創作シートメーカー${pages.length > 1 ? ` · ${page + 1} / ${pages.length}` : ""}`,
      MARGIN,
      pageHeight - FOOTER,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("画像を生成できません"))),
        "image/png",
      ),
    );
    blobs.push(blob);
  }
  return blobs;
}
