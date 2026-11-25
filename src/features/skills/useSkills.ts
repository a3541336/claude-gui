import { useCallback, useEffect, useState } from "react";
import { skillsApi, type Skill } from "../../shared/api/skills";

export type { Skill };

/** Skills of one category, in the order they are listed. */
export interface SkillGroup {
  /** Empty for skills without a category. */
  name: string;
  items: Skill[];
}

export const groupOf = (skill: Skill) => skill.group?.trim() ?? "";

/** Uncategorized skills first, then each category where its first skill appears. */
export function groupSkills(items: Skill[]): SkillGroup[] {
  const groups = new Map<string, Skill[]>([["", []]]);
  for (const skill of items) {
    const name = groupOf(skill);
    groups.set(name, [...(groups.get(name) ?? []), skill]);
  }
  return [...groups].map(([name, items]) => ({ name, items })).filter((g) => g.items.length > 0);
}

/** Saved skills, persisted to a file by the backend in the order the user arranged them. */
export function useSkills() {
  const [items, setItems] = useState<Skill[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    skillsApi.list().then(setItems, (e) => setError(String(e)));
  }, []);

  const save = useCallback(async (skill: Skill) => {
    try {
      await skillsApi.save(skill);
      // Edited skills keep their place; new ones go on top, as in the backend.
      setItems((prev) =>
        prev.some((s) => s.id === skill.id)
          ? prev.map((s) => (s.id === skill.id ? skill : s))
          : [skill, ...prev],
      );
      setError(null);
      return true;
    } catch (e) {
      setError(`技能儲存失敗：${e}`);
      return false;
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      await skillsApi.delete(id);
      setItems((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(`技能刪除失敗：${e}`);
    }
  }, []);

  /** Lists the skills in this order. */
  const reorder = useCallback(async (ordered: Skill[]) => {
    setItems(ordered);
    try {
      await skillsApi.reorder(ordered.map((s) => s.id));
      setError(null);
    } catch (e) {
      setError(`技能排序失敗：${e}`);
    }
  }, []);

  /** Moves skills into a category; an empty name removes them from theirs. */
  const setGroup = useCallback(
    async (skills: Skill[], group: string) => {
      for (const skill of skills) {
        if (groupOf(skill) === group.trim()) continue;
        if (!(await save({ ...skill, group: group.trim() }))) return;
      }
    },
    [save],
  );

  return { items, error, save, remove, reorder, setGroup };
}

export type SkillsController = ReturnType<typeof useSkills>;
