export type QuestionType =
  | "four_level"
  | "five_level"
  | "slider"
  | "single"
  | "multiple"
  | "short"
  | "long"
  | "yes_no";
export type Theme = import("../shared/themes").ThemeName;
export interface Option {
  value: string;
  label: string;
}
export interface Question {
  id: string;
  text: string;
  description: string;
  type: QuestionType;
  required: boolean;
  options: Option[];
}
export interface Section {
  id: string;
  title: string;
  description: string;
  icon: string;
  questions: Question[];
}
export interface Sheet {
  id: string;
  title: string;
  description: string;
  author: string;
  category: string;
  color: string;
  theme: Theme;
  sections: Section[];
  createdAt: string;
  updatedAt: string;
}
export interface Template extends Sheet {
  emoji: string;
  tagline: string;
}
export type Value = string | string[] | number;
export interface Answer {
  id: string;
  sheetId: string;
  respondentName: string;
  answers: Record<string, Value>;
  comments: Record<string, string>;
  createdAt: string;
  sheet: Sheet;
}
