import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__panel" role="dialog" aria-label={title}>
        <div className="modal__header">
          <span>{title}</span>
          <button className="modal__close button--icon" title="關閉" aria-label="關閉" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
