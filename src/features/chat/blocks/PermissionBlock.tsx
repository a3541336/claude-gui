import type { PermissionResponse } from "../../../shared/types/claude";
import type { ChatEntry, PermissionStatus } from "../chatReducer";
import { summarizeInput } from "./ToolBlock";

export type PermissionEntry = Extract<ChatEntry, { kind: "permission" }>;

export type RespondFn = (requestId: string, response: PermissionResponse) => void;

export const STATUS_TEXT: Record<Exclude<PermissionStatus, "pending">, string> = {
  allowed: "已允許",
  denied: "已拒絕",
  cancelled: "已取消",
};

export function PermissionBlock({ entry, onRespond }: { entry: PermissionEntry; onRespond: RespondFn }) {
  const { request, status } = entry;
  const summary = summarizeInput(request.tool_name, request.input);
  // Other suggestions (e.g. switching the whole session to acceptEdits) go further than this one call.
  const rules = (request.permission_suggestions ?? []).filter((s) => s.type === "addRules");

  const allow = (updatedPermissions?: typeof rules) =>
    onRespond(entry.id, {
      behavior: "allow",
      updatedInput: request.input,
      ...(updatedPermissions && { updatedPermissions }),
    });
  const deny = () => onRespond(entry.id, { behavior: "deny", message: "使用者拒絕了這個操作" });

  return (
    <div className={`entry permission permission--${status}`}>
      <div className="permission__title">
        Claude 想要使用 <strong>{request.display_name ?? request.tool_name}</strong>
      </div>
      {request.description && <div>{request.description}</div>}
      {summary && <code className="permission__summary">{summary}</code>}
      {request.decision_reason && (
        <div className="permission__reason">{request.decision_reason}</div>
      )}
      <details>
        <summary>完整參數</summary>
        <pre>{JSON.stringify(request.input, null, 2)}</pre>
      </details>
      {status === "pending" ? (
        <div className="permission__actions">
          <button className="permission__primary" onClick={() => allow()}>
            允許
          </button>
          {rules.length > 0 && (
            <button
              onClick={() => allow(rules)}
              title="規則會寫入此專案的 .claude/settings.local.json"
            >
              允許，且不再詢問
            </button>
          )}
          <button onClick={deny}>拒絕</button>
        </div>
      ) : (
        <div className="permission__status">{STATUS_TEXT[status]}</div>
      )}
    </div>
  );
}
