// Saved skills and one-off structured questions to claude.
// Command names must match `src-tauri/src/lib.rs`.

import { invoke } from "@tauri-apps/api/core";

/** How a parameter's value is entered when the skill runs. */
export type ParamType =
  | "text"
  | "multiline"
  | "number"
  | "date"
  | "datetime"
  | "time"
  | "select"
  | "boolean"
  | "file"
  | "directory";

export interface SkillParam {
  /** Referenced in the prompt as `{{name}}`. */
  name: string;
  label: string;
  description: string;
  defaultValue: string;
  /** Missing in skills saved before types existed; see `typeOf`. */
  type?: ParamType;
  /** Choices of a `select` parameter. */
  options?: string[];
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  params: SkillParam[];
  prompt: string;
  /** Directory of the conversation it was made from. */
  sourceCwd: string | null;
  /** Category shown as a group in the sidebar; empty is ungrouped. Missing in older saves. */
  group?: string;
  /** In ms. */
  updatedAt: number;
}

export interface StructuredQuery {
  /** Omitted for a chat without a project. */
  cwd?: string;
  /** Answers with this claude session's context, without changing it. */
  resume?: string;
  model?: string;
  prompt: string;
  /** JSON Schema the answer must match. */
  schema: object;
}

export const skillsApi = {
  list: () => invoke<Skill[]>("list_skills"),
  save: (skill: Skill) => invoke<void>("save_skill", { skill }),
  delete: (id: string) => invoke<void>("delete_skill", { id }),
  /** Saves the order the skills are listed in. */
  reorder: (ids: string[]) => invoke<void>("reorder_skills", { ids }),
  askStructured: <T>(query: StructuredQuery) => invoke<T>("ask_structured", { query }),
};
