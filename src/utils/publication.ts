import type { Answer, Sheet } from "../types";
import type { ShareKind } from "../../shared/validation";
export interface PublicationOptions {
  name: boolean;
  author: boolean;
  description: boolean;
  comments: boolean;
}
export function publicationData(
  kind: ShareKind,
  data: Sheet | Answer,
  options: PublicationOptions,
): Sheet | Answer {
  const copy = structuredClone(data);
  const sheet = kind === "sheet" ? (copy as Sheet) : (copy as Answer).sheet;
  if (!options.author) sheet.author = "";
  if (!options.description) sheet.description = "";
  if (kind === "answer") {
    const answer = copy as Answer;
    if (!options.name) answer.respondentName = "";
    if (!options.comments) answer.comments = {};
  }
  return copy;
}
