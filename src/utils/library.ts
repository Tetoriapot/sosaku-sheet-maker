import type { QuestionType } from "../types";
export interface LibraryEntry {
  text: string;
  type: QuestionType;
  categories: string[];
}
type RawLibrary = Record<
  string,
  Array<string | { text: string; type: string }>
>;
export const normalizeSearch = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase("ja-JP").trim();
export function buildLibrary(...sources: RawLibrary[]): LibraryEntry[] {
  const entries = new Map<string, LibraryEntry>();
  for (const source of sources)
    for (const [category, items] of Object.entries(source))
      for (const item of items) {
        const text = typeof item === "string" ? item : item.text;
        const key = normalizeSearch(text);
        const existing = entries.get(key);
        if (existing) {
          if (!existing.categories.includes(category))
            existing.categories.push(category);
          continue;
        }
        const type = (
          typeof item === "string"
            ? /[？?]$/.test(text)
              ? "long"
              : "four_level"
            : item.type
        ) as QuestionType;
        entries.set(key, { text, type, categories: [category] });
      }
  return [...entries.values()];
}
export function filterLibrary(
  entries: LibraryEntry[],
  category: string,
  search: string,
) {
  const words = normalizeSearch(search).split(/\s+/).filter(Boolean);
  return entries.filter(
    (entry) =>
      (category === "all" || entry.categories.includes(category)) &&
      words.every((word) =>
        normalizeSearch(`${entry.text} ${entry.categories.join(" ")}`).includes(
          word,
        ),
      ),
  );
}
