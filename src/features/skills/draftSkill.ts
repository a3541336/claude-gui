import { skillsApi, type SkillParam } from "../../shared/api/skills";

export interface SkillDraft {
  name: string;
  description: string;
  params: SkillParam[];
  prompt: string;
}

const SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "簡短的技能名稱" },
    description: { type: "string", description: "一句話說明這個技能做什麼、何時使用" },
    params: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_]*$" },
          label: { type: "string" },
          description: { type: "string" },
          defaultValue: { type: "string" },
        },
        required: ["name", "label", "description", "defaultValue"],
      },
    },
    prompt: { type: "string" },
  },
  required: ["name", "description", "params", "prompt"],
};

const INSTRUCTIONS = `請不要繼續執行任務。把我們到目前為止的這段對話整理成一個可重複使用的「技能」，讓我之後換一組輸入就能重做同樣的事。

要求：
- 找出這次流程中「下次會不一樣」的輸入（例如檔案路徑、名稱、網址、數字、日期、要處理的對象），每個做成一個參數。params[].name 用英文 snake_case，label 用繁體中文，defaultValue 填這次對話實際用的值。只對真的會變的東西開參數，不要過度參數化。
- prompt 是一份完整、可獨立執行的指令：之後會在全新的對話中送出，看不到這段對話。用 {{參數名稱}} 引用參數，每個參數至少用到一次。
- prompt 要寫清楚目標、依序的步驟、這次過程中發現的注意事項與踩過的坑（直接寫成正確做法，不要重蹈覆轍）、以及完成時應該產出什麼。
- 寫法要通用，不要提到「上次」「剛才的對話」。
- name、description、prompt 都用繁體中文。`;

/** Asks claude to turn a finished conversation into a skill; the conversation itself is left unchanged. */
export function draftSkill(cwd: string, claudeSessionId: string, model: string) {
  return skillsApi.askStructured<SkillDraft>({
    cwd,
    resume: claudeSessionId,
    model: model || undefined,
    prompt: INSTRUCTIONS,
    schema: SCHEMA,
  });
}
