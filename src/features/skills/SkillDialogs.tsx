import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Plus, X } from "lucide-react";
import { useState } from "react";
import type { ParamType, Skill, SkillParam } from "../../shared/api/skills";
import { Modal } from "../../shared/components/Modal";
import {
  CURRENT,
  formatValue,
  initialValue,
  isTemporal,
  NO,
  optionsOf,
  PARAM_TYPES,
  ParamInput,
  paramProblem,
  typeOf,
  valueProblem,
  YES,
} from "./paramTypes";
import { PARAM_NAME, placeholdersOf, renderPrompt } from "./template";

/** Shown while claude turns the conversation into a skill. */
export function SkillDrafting({ error, onClose }: { error: string | null; onClose: () => void }) {
  return (
    <Modal title="轉成技能" onClose={onClose}>
      <div className="modal__body">
        {error ? (
          <p className="skill-form__error">{error}</p>
        ) : (
          <p className="skill-form__hint">AI 正在整理這段對話的流程與參數，可能需要一點時間…</p>
        )}
      </div>
      <div className="modal__footer">
        <button onClick={onClose}>{error ? "關閉" : "取消"}</button>
      </div>
    </Modal>
  );
}

interface EditorProps {
  skill: Skill;
  isNew: boolean;
  /** Existing categories, offered as suggestions. */
  groups: string[];
  onSave: (skill: Skill) => void;
  onClose: () => void;
}

/** Everything claude drafted can be changed before it is saved. */
export function SkillEditor({ skill: initial, isNew, groups, onSave, onClose }: EditorProps) {
  const [skill, setSkill] = useState(initial);
  const set = (patch: Partial<Skill>) => setSkill((prev) => ({ ...prev, ...patch }));
  const setParam = (i: number, patch: Partial<SkillParam>) =>
    set({ params: skill.params.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const addParam = (name = "") =>
    set({
      params: [
        ...skill.params,
        { name, label: name, description: "", defaultValue: "", type: "text", options: [] },
      ],
    });
  /** Keeps the default only where it still fits the new type. */
  const setType = (i: number, type: ParamType) => {
    const param = { ...skill.params[i], type };
    const fits =
      param.defaultValue === CURRENT ? isTemporal(type) : valueProblem(param, param.defaultValue) === null;
    const defaultValue = type === "boolean" ? NO : fits ? param.defaultValue : "";
    setParam(i, { type, defaultValue, options: type === "select" ? (param.options ?? []) : [] });
  };

  const names = skill.params.map((p) => p.name);
  const used = placeholdersOf(skill.prompt);
  const missing = used.filter((name) => !names.includes(name));
  const unused = names.filter((name) => name && !used.includes(name));
  const problem = !skill.name.trim()
    ? "請輸入名稱"
    : !skill.prompt.trim()
      ? "請輸入提示詞"
      : names.some((name) => !PARAM_NAME.test(name))
        ? "參數名稱只能用英文字母、數字與底線，且不能以數字開頭"
        : new Set(names).size !== names.length
          ? "參數名稱不能重複"
          : (skill.params.map(paramProblem).find((p) => p !== null) ?? null);

  return (
    <Modal title={isNew ? "儲存為技能" : "編輯技能"} onClose={onClose}>
      <div className="modal__body skill-form">
        <label>
          名稱
          <input value={skill.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label>
          說明
          <input value={skill.description} onChange={(e) => set({ description: e.target.value })} />
        </label>
        <label>
          分類（選填）
          <input
            list="skill-groups"
            placeholder="例如：部署、報表"
            value={skill.group ?? ""}
            onChange={(e) => set({ group: e.target.value })}
          />
          <datalist id="skill-groups">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>

        <div className="skill-form__section">
          <span>參數</span>
          <button className="button--icon" onClick={() => addParam()}>
            <Plus size={14} />
            新增參數
          </button>
        </div>
        {skill.params.length === 0 && <p className="skill-form__hint">沒有參數，每次執行內容都相同。</p>}
        {skill.params.map((param, i) => (
          <div key={i} className="skill-form__param">
            <input
              className="skill-form__mono"
              placeholder="name"
              value={param.name}
              onChange={(e) => setParam(i, { name: e.target.value })}
            />
            <input
              placeholder="顯示名稱"
              value={param.label}
              onChange={(e) => setParam(i, { label: e.target.value })}
            />
            <select
              title="輸入型態"
              value={typeOf(param)}
              onChange={(e) => setType(i, e.target.value as ParamType)}
            >
              {PARAM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              className="button--icon"
              title="移除參數"
              aria-label="移除參數"
              onClick={() => set({ params: skill.params.filter((_, j) => j !== i) })}
            >
              <X size={14} />
            </button>
            {typeOf(param) === "select" && (
              <label className="skill-form__param-wide">
                <small>選項（一行一個）</small>
                <textarea
                  rows={3}
                  value={(param.options ?? []).join("\n")}
                  onChange={(e) => {
                    const options = e.target.value.split("\n");
                    const kept = options.map((o) => o.trim()).filter(Boolean);
                    setParam(i, {
                      options,
                      defaultValue: kept.includes(param.defaultValue) ? param.defaultValue : (kept[0] ?? ""),
                    });
                  }}
                  onBlur={() =>
                    setParam(i, { options: (param.options ?? []).map((o) => o.trim()).filter(Boolean) })
                  }
                />
              </label>
            )}
            <div className="skill-form__param-wide skill-form__param-default">
              <small>預設值</small>
              {isTemporal(typeOf(param)) && param.defaultValue === CURRENT ? (
                <span className="skill-form__hint">
                  執行時自動填入當下的{typeOf(param) === "date" ? "日期" : "時間"}
                </span>
              ) : (
                <ParamInput
                  param={param}
                  value={typeOf(param) === "boolean" && param.defaultValue !== YES ? NO : param.defaultValue}
                  onChange={(defaultValue) => setParam(i, { defaultValue })}
                  dir={skill.sourceCwd}
                />
              )}
              {isTemporal(typeOf(param)) && (
                <label className="skill-form__check">
                  <input
                    type="checkbox"
                    checked={param.defaultValue === CURRENT}
                    onChange={(e) => setParam(i, { defaultValue: e.target.checked ? CURRENT : "" })}
                  />
                  預設為執行當下
                </label>
              )}
            </div>
            <input
              className="skill-form__param-desc"
              placeholder="說明（執行時顯示）"
              value={param.description}
              onChange={(e) => setParam(i, { description: e.target.value })}
            />
          </div>
        ))}

        <label>
          提示詞（用 {"{{參數名稱}}"} 引用參數）
          <textarea
            className="skill-form__mono"
            rows={14}
            value={skill.prompt}
            onChange={(e) => set({ prompt: e.target.value })}
          />
        </label>
        {missing.length > 0 && (
          <p className="skill-form__warning">
            提示詞用到未定義的參數：
            {missing.map((name) => (
              <button key={name} className="button--icon" onClick={() => addParam(name)} title="新增此參數">
                <Plus size={12} />
                {name}
              </button>
            ))}
          </p>
        )}
        {unused.length > 0 && (
          <p className="skill-form__warning">提示詞沒有用到：{unused.join("、")}</p>
        )}
      </div>
      <div className="modal__footer">
        {problem && <span className="skill-form__error">{problem}</span>}
        <button onClick={onClose}>取消</button>
        <button
          className="button--primary"
          disabled={problem !== null}
          onClick={() =>
            onSave({
              ...skill,
              params: skill.params.map((p) => ({ ...p, type: typeOf(p), options: optionsOf(p) })),
              name: skill.name.trim(),
              group: skill.group?.trim() ?? "",
              updatedAt: Date.now(),
            })
          }
        >
          儲存
        </button>
      </div>
    </Modal>
  );
}

interface RunnerProps {
  skill: Skill;
  cwd: string | null;
  /** Why claude can't run right now, if it can't. */
  unavailableReason: string | null;
  /** A null `cwd` runs it as a chat without a project. */
  onRun: (prompt: string, cwd: string | null) => void;
  onClose: () => void;
}

export function SkillRunner({ skill, cwd, unavailableReason, onRun, onClose }: RunnerProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(skill.params.map((p) => [p.name, initialValue(p)])),
  );
  const [dir, setDir] = useState(cwd ?? skill.sourceCwd);
  const prompt = renderPrompt(
    skill.prompt,
    Object.fromEntries(skill.params.map((p) => [p.name, formatValue(p, values[p.name] ?? "")])),
  );
  const invalid = skill.params.map((p) => valueProblem(p, values[p.name] ?? "")).find((p) => p !== null);
  const reason = unavailableReason ?? invalid ?? null;

  const pickDirectory = async () => {
    const picked = await open({
      directory: true,
      multiple: false,
      title: "選擇要套用技能的工作目錄",
      defaultPath: dir ?? undefined,
    });
    if (typeof picked === "string") setDir(picked);
  };

  return (
    <Modal title={skill.name} onClose={onClose}>
      <div className="modal__body skill-form">
        {skill.description && <p className="skill-form__hint">{skill.description}</p>}
        {skill.params.map((param) => {
          // A label would press the first 是／否 button when its text is clicked.
          const Field = typeOf(param) === "boolean" ? "div" : "label";
          return (
            <Field key={param.name} className="skill-form__field">
              {param.label || param.name}
              {param.description && <small>{param.description}</small>}
              <ParamInput
                param={param}
                value={values[param.name] ?? ""}
                onChange={(value) => setValues((prev) => ({ ...prev, [param.name]: value }))}
                dir={dir}
              />
            </Field>
          );
        })}
        <div className="skill-form__dir">
          <span>工作目錄：</span>
          <span className="skill-form__mono" title={dir ?? ""}>
            {dir ?? "（閒聊，不指定工作目錄）"}
          </span>
          {skill.sourceCwd && dir !== skill.sourceCwd && (
            <button onClick={() => setDir(skill.sourceCwd)} title={skill.sourceCwd}>
              改用建立時的目錄
            </button>
          )}
          {cwd && dir !== cwd && <button onClick={() => setDir(cwd)}>改用目前目錄</button>}
          <button className="button--icon" onClick={() => void pickDirectory()}>
            <FolderOpen size={14} />
            選擇其他目錄…
          </button>
          {dir && <button onClick={() => setDir(null)}>改為閒聊</button>}
        </div>
        <details>
          <summary>預覽送出的內容</summary>
          <pre className="skill-form__preview">{prompt}</pre>
        </details>
      </div>
      <div className="modal__footer">
        {reason && <span className="skill-form__error">{reason}</span>}
        <button onClick={onClose}>取消</button>
        <button
          className="button--primary"
          disabled={reason !== null}
          onClick={() => onRun(prompt, dir)}
        >
          在新對話執行
        </button>
      </div>
    </Modal>
  );
}
