// `{{name}}` placeholders in a skill's prompt.

const PLACEHOLDER = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/** Names used in the prompt, in order of first use. */
export function placeholdersOf(prompt: string): string[] {
  return [...new Set([...prompt.matchAll(PLACEHOLDER)].map((m) => m[1]))];
}

/** Unknown placeholders are left as they are. */
export function renderPrompt(prompt: string, values: Record<string, string>): string {
  return prompt.replace(PLACEHOLDER, (whole, name: string) =>
    name in values ? values[name] : whole,
  );
}

export const PARAM_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
