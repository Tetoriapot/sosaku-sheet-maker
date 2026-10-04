import { useEffect, useRef, useId, type ReactNode } from "react";
export function Modal({
  title,
  children,
  close,
  dismissible = true,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  dismissible?: boolean;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const previous = document.activeElement as HTMLElement;
    el.showModal();
    return () => {
      el.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            if (dismissible) close();
        }
      }}
      className="modal"
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          disabled={!dismissible}
          onClick={close}
          aria-label="閉じる"
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
