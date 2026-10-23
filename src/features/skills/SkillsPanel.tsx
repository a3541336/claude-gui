import { ask } from "@tauri-apps/plugin-dialog";
import type { Skill } from "./useSkills";

interface Props {
  items: Skill[];
  error: string | null;
  onRun: (skill: Skill) => void;
  onEdit: (skill: Skill) => void;
  onDelete: (id: string) => void;
}

export function SkillsPanel({ items, error, onRun, onEdit, onDelete }: Props) {
  const confirmDelete = async (skill: Skill) => {
    if (await ask(`刪除技能「${skill.name}」？`, { title: "刪除技能", kind: "warning" })) {
      onDelete(skill.id);
    }
  };

  return (
    <section className="skills">
      <div className="history__header">技能</div>
      {error && <p className="history__error">{error}</p>}
      {items.length === 0 && (
        <p className="history__empty">對話完成後按「轉成技能」，之後就能一鍵重做</p>
      )}
      <ul>
        {items.map((skill) => (
          <li
            key={skill.id}
            className="history__item"
            onClick={() => onRun(skill)}
            title={skill.description || skill.name}
          >
            <span className="history__title">{skill.name}</span>
            <span className="skills__actions">
              <button
                className="history__icon-button"
                title="編輯"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(skill);
                }}
              >
                ✎
              </button>
              <button
                className="history__icon-button"
                title="刪除"
                onClick={(e) => {
                  e.stopPropagation();
                  void confirmDelete(skill);
                }}
              >
                ×
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
