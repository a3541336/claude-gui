import { useCallback, useEffect, useState } from "react";
import { skillsApi, type Skill } from "../../shared/api/skills";

export type { Skill };

/** Saved skills, persisted to a file by the backend. */
export function useSkills() {
  const [items, setItems] = useState<Skill[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    skillsApi.list().then(setItems, (e) => setError(String(e)));
  }, []);

  const save = useCallback(async (skill: Skill) => {
    try {
      await skillsApi.save(skill);
      setItems((prev) => [skill, ...prev.filter((s) => s.id !== skill.id)]);
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

  return { items, error, save, remove };
}

export type SkillsController = ReturnType<typeof useSkills>;
