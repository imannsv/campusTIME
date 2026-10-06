import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="work-page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="work-page-actions">{actions}</div>}
    </header>
  );
}

export function ActionMenu({
  label,
  shortLabel,
  children,
}: {
  label: string;
  shortLabel?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    container.current?.addEventListener("keydown", escape);
    const element = container.current;
    return () => {
      document.removeEventListener("pointerdown", outside);
      element?.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="action-menu" ref={container}>
      <button
        ref={trigger}
        className="button secondary"
        aria-expanded={open}
        aria-label={label}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {shortLabel || label}
        <ChevronDown size={16} />
      </button>
      {open && (
        <div
          id={id}
          className="action-menu-items"
          onClick={(event) => {
            const button = (event.target as HTMLElement).closest("button");
            if (button && !button.disabled) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** A non-modal dock on wide screens and a focus-contained sheet below it. */
export function DetailPanel({
  title,
  subtitle,
  children,
  onClose,
  editing = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  editing?: boolean;
}) {
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [docked, setDocked] = useState(
    () => window.matchMedia("(min-width: 1440px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1440px)");
    const update = () => setDocked(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const controls = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        ) || [],
      ).filter((element) => element.offsetParent !== null);
    panel.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        (!docked || panel.current?.contains(event.target as Node))
      ) {
        event.preventDefault();
        close.current();
      }
      if (!docked && event.key === "Tab") {
        const elements = controls();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === panel.current)
        ) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [docked]);
  return (
    <>
      {!docked && (
        <div className="detail-panel-scrim" onClick={() => close.current()} />
      )}
      <aside
        ref={panel}
        className={`detail-panel ${editing ? "editing" : "reading"}`}
        role={editing || !docked ? "dialog" : "region"}
        aria-modal={!docked || undefined}
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="detail-panel-header">
          <div>
            <span className="detail-panel-eyebrow">
              {editing ? "Bearbeiten" : "Details"}
            </span>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Schließen"
            onClick={() => close.current()}
          >
            <X size={20} />
          </button>
        </header>
        <div className="detail-panel-content">{children}</div>
      </aside>
    </>
  );
}
