import { ask } from "@tauri-apps/plugin-dialog";
import {
  ArrowDownAZ,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Pencil,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { loadString, saveString } from "../../shared/storage";
import { groupOf, groupSkills, type Skill, type SkillGroup } from "./useSkills";

const COLLAPSED_KEY = "flowloom.skillGroupsCollapsed";
const NEW_GROUP = "\u0000new";

interface Props {
  items: Skill[];
  error: string | null;
  onRun: (skill: Skill) => void;
  onEdit: (skill: Skill) => void;
  onDelete: (id: string) => void;
  /** Lists the skills in this order. */
  onReorder: (ordered: Skill[]) => void;
  /** Moves skills into a category; empty removes them from theirs. */
  onSetGroup: (skills: Skill[], group: string) => void;
}

export function SkillsPanel({ items, error, onRun, onEdit, onDelete, onReorder, onSetGroup }: Props) {
  const [organizing, setOrganizing] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>(() => {
    try {
      return JSON.parse(loadString(COLLAPSED_KEY) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  useEffect(
    () => saveString(COLLAPSED_KEY, collapsed.length > 0 ? JSON.stringify(collapsed) : null),
    [collapsed],
  );
  // The skill whose category is being typed in organize mode.
  const [newGroupFor, setNewGroupFor] = useState<string | null>(null);

  const groups = groupSkills(items);
  const groupNames = groups.map((g) => g.name).filter(Boolean);
  const flatten = (gs: SkillGroup[]) => gs.flatMap((g) => g.items);

  const confirmDelete = async (skill: Skill) => {
    if (await ask(`刪除技能「${skill.name}」？`, { title: "刪除技能", kind: "warning" })) {
      onDelete(skill.id);
    }
  };

  const toggleGroup = (name: string) =>
    setCollapsed((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  /** Swaps a skill with its neighbour in the same category. */
  const moveSkill = (group: SkillGroup, index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= group.items.length) return;
    const moved = [...group.items];
    [moved[index], moved[target]] = [moved[target], moved[index]];
    onReorder(flatten(groups.map((g) => (g === group ? { ...g, items: moved } : g))));
  };

  /** Moves a whole category; the uncategorized skills always stay on top. */
  const moveGroup = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= groups.length || !groups[target].name) return;
    const moved = [...groups];
    [moved[index], moved[target]] = [moved[target], moved[index]];
    onReorder(flatten(moved));
  };

  const sortByName = () =>
    onReorder(
      flatten(
        groups.map((g) => ({
          ...g,
          items: [...g.items].sort((a, b) => a.name.localeCompare(b.name, "zh-Hant")),
        })),
      ),
    );

  const renameGroup = (group: SkillGroup, name: string) => {
    const trimmed = name.trim();
    if (trimmed === group.name) return;
    onSetGroup(group.items, trimmed);
    setCollapsed((prev) => prev.filter((n) => n !== group.name));
  };

  const chooseGroup = (skill: Skill, value: string) => {
    if (value === NEW_GROUP) setNewGroupFor(skill.id);
    else onSetGroup([skill], value);
  };

  const renderSkill = (skill: Skill, group: SkillGroup, index: number) =>
    organizing ? (
      <li key={skill.id} className="history__item skills__item--organizing" title={skill.name}>
        <span className="skills__move">
          <button
            className="history__icon-button"
            title="上移"
            aria-label="上移"
            disabled={index === 0}
            onClick={() => moveSkill(group, index, -1)}
          >
            <ChevronUp size={13} />
          </button>
          <button
            className="history__icon-button"
            title="下移"
            aria-label="下移"
            disabled={index === group.items.length - 1}
            onClick={() => moveSkill(group, index, 1)}
          >
            <ChevronDown size={13} />
          </button>
        </span>
        <span className="history__title">{skill.name}</span>
        {newGroupFor === skill.id ? (
          <input
            className="skills__group-input"
            autoFocus
            placeholder="新分類名稱"
            onBlur={(e) => {
              if (e.target.value.trim()) onSetGroup([skill], e.target.value);
              setNewGroupFor(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setNewGroupFor(null);
            }}
          />
        ) : (
          <select
            className="skills__group-select"
            title="分類"
            value={groupOf(skill)}
            onChange={(e) => chooseGroup(skill, e.target.value)}
          >
            <option value="">未分類</option>
            {groupNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value={NEW_GROUP}>新分類…</option>
          </select>
        )}
      </li>
    ) : (
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
            aria-label="編輯"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(skill);
            }}
          >
            <Pencil size={14} />
          </button>
          <button
            className="history__icon-button"
            title="刪除"
            aria-label="刪除"
            onClick={(e) => {
              e.stopPropagation();
              void confirmDelete(skill);
            }}
          >
            <Trash2 size={14} />
          </button>
        </span>
      </li>
    );

  return (
    <section className="skills">
      <div className="history__header skills__header">
        <span>技能</span>
        {items.length > 0 &&
          (organizing ? (
            <span className="skills__header-actions">
              <button className="history__icon-button" title="各分類內依名稱排序" onClick={sortByName}>
                <ArrowDownAZ size={14} />
              </button>
              <button
                className="history__icon-button skills__done"
                title="完成整理"
                onClick={() => {
                  setOrganizing(false);
                  setNewGroupFor(null);
                }}
              >
                <Check size={14} />
                完成
              </button>
            </span>
          ) : (
            <button
              className="history__icon-button"
              title="整理：調整順序與分類"
              aria-label="整理技能"
              onClick={() => setOrganizing(true)}
            >
              <SlidersHorizontal size={14} />
            </button>
          ))}
      </div>
      {error && <p className="history__error">{error}</p>}

      {organizing && items.length > 0 && (
        <p className="history__empty skills__hint">用箭頭調整順序，右側選單設定分類；分類名稱可直接修改</p>
      )}
      {groups.map((group, gi) => {
        // Organizing shows everything, so collapsed categories can be arranged too.
        const open = organizing || !group.name || !collapsed.includes(group.name);
        return (
          <div key={group.name || "\u0000"} className="skills__group">
            {group.name &&
              (organizing ? (
                <div className="skills__group-header skills__group-header--organizing">
                  <input
                    className="skills__group-name-input"
                    defaultValue={group.name}
                    key={group.name}
                    title="修改分類名稱；清空即取消分類"
                    onBlur={(e) => renameGroup(group, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                  <button
                    className="history__icon-button"
                    title="分類上移"
                    aria-label="分類上移"
                    disabled={gi === 0 || !groups[gi - 1].name}
                    onClick={() => moveGroup(gi, -1)}
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    className="history__icon-button"
                    title="分類下移"
                    aria-label="分類下移"
                    disabled={gi === groups.length - 1}
                    onClick={() => moveGroup(gi, 1)}
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>
              ) : (
                <button className="skills__group-header" onClick={() => toggleGroup(group.name)}>
                  {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span className="history__title">{group.name}</span>
                  <span className="skills__count">{group.items.length}</span>
                </button>
              ))}
            {open && <ul>{group.items.map((skill, i) => renderSkill(skill, group, i))}</ul>}
          </div>
        );
      })}
    </section>
  );
}
