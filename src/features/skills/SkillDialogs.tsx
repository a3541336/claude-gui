import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Plus, X } from "lucide-react";
import { useState } from "react";
import type { Skill, SkillParam } from "../../shared/api/skills";
import { Modal } from "../../shared/components/Modal";
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
  onSave: (skill: Skill) => void;
  onClose: () => void;
}

/** Everything claude drafted can be changed before it is saved. */
export function SkillEditor({ skill: initial, isNew, onSave, onClose }: EditorProps) {
  const [skill, setSkill] = useState(initial);
  const set = (patch: Partial<Skill>) => setSkill((prev) => ({ ...prev, ...patch }));
  const setParam = (i: number, patch: Partial<SkillParam>) =>
    set({ params: skill.params.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const addParam = (name = "") =>
    set({ params: [...skill.params, { name, label: name, description: "", defaultValue: "" }] });

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
          : null;

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
            <input
              placeholder="預設值"
              value={param.defaultValue}
              onChange={(e) => setParam(i, { defaultValue: e.target.value })}
            />
            <button
              className="button--icon"
              title="移除參數"
              aria-label="移除參數"
              onClick={() => set({ params: skill.params.filter((_, j) => j !== i) })}
            >
              <X size={14} />
            </button>
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
          onClick={() => onSave({ ...skill, name: skill.name.trim(), updatedAt: Date.now() })}
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
    Object.fromEntries(skill.params.map((p) => [p.name, p.defaultValue])),
  );
  const [dir, setDir] = useState(cwd ?? skill.sourceCwd);
  const prompt = renderPrompt(skill.prompt, values);
  const reason = unavailableReason;

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
        {skill.params.map((param) => (
          <label key={param.name}>
            {param.label || param.name}
            {param.description && <small>{param.description}</small>}
            {param.defaultValue.includes("\n") ? (
              <textarea
                rows={4}
                value={values[param.name]}
                onChange={(e) => setValues({ ...values, [param.name]: e.target.value })}
              />
            ) : (
              <input
                value={values[param.name]}
                onChange={(e) => setValues({ ...values, [param.name]: e.target.value })}
              />
            )}
          </label>
        ))}
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
