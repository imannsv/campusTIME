import { useEffect, useRef, useState } from "react";
import { DateTime } from "luxon";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

export default function MiniCalendar({
  value,
  zone,
  onChange,
}: {
  value: string;
  zone: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(value);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const month = DateTime.fromISO(cursor, { zone }).startOf("month");
  const first = month.startOf("week");
  const count = Math.ceil((month.daysInMonth! + month.weekday - 1) / 7) * 7;
  const today = DateTime.now().setZone(zone).toISODate();
  useEffect(() => {
    if (!open) return;
    container.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${cursor}"]`)
      ?.focus();
  }, [open, cursor]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="mini-calendar" ref={container}>
      <button
        ref={trigger}
        className="button secondary"
        aria-label="Datum auswählen"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setCursor(value);
          setOpen((current) => !current);
        }}
      >
        <CalendarDays size={17} />
        {DateTime.fromISO(value, { zone })
          .setLocale("de")
          .toFormat("dd. MMM yyyy")}
      </button>
      {open && (
        <div
          className="mini-calendar-popup"
          role="dialog"
          aria-label="Kalender"
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const buttons = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                "button:not([tabindex='-1'])",
              ),
            );
            if (event.shiftKey && document.activeElement === buttons[0]) {
              event.preventDefault();
              buttons.at(-1)?.focus();
            } else if (
              !event.shiftKey &&
              document.activeElement === buttons.at(-1)
            ) {
              event.preventDefault();
              buttons[0]?.focus();
            }
          }}
        >
          <header>
            <button
              className="icon-button"
              aria-label="Vorheriger Monat"
              onClick={() => setCursor(month.minus({ months: 1 }).toISODate()!)}
            >
              <ChevronLeft size={18} />
            </button>
            <strong aria-live="polite">
              {month.setLocale("de").toFormat("LLLL yyyy")}
            </strong>
            <button
              className="icon-button"
              aria-label="Nächster Monat"
              onClick={() => setCursor(month.plus({ months: 1 }).toISODate()!)}
            >
              <ChevronRight size={18} />
            </button>
          </header>
          <div className="mini-calendar-weekdays" aria-hidden="true">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mini-calendar-days" role="group" aria-label="Tage">
            {Array.from({ length: count }, (_, index) =>
              first.plus({ days: index }),
            ).map((day) => {
              const date = day.toISODate()!;
              return (
                <button
                  key={date}
                  data-date={date}
                  tabIndex={date === cursor ? 0 : -1}
                  aria-label={day
                    .setLocale("de")
                    .toFormat("cccc, dd. LLLL yyyy")}
                  aria-pressed={date === value}
                  aria-current={date === today ? "date" : undefined}
                  className={`${day.month !== month.month ? "outside" : ""} ${date === value ? "selected" : ""}`}
                  onClick={() => {
                    onChange(date);
                    setOpen(false);
                    trigger.current?.focus();
                  }}
                  onKeyDown={(event) => {
                    const offsets: Record<string, number> = {
                      ArrowLeft: -1,
                      ArrowRight: 1,
                      ArrowUp: -7,
                      ArrowDown: 7,
                      Home: 1 - day.weekday,
                      End: 7 - day.weekday,
                    };
                    if (event.key in offsets) {
                      event.preventDefault();
                      setCursor(
                        day.plus({ days: offsets[event.key] }).toISODate()!,
                      );
                    }
                    if (["PageUp", "PageDown"].includes(event.key)) {
                      event.preventDefault();
                      setCursor(
                        day
                          .plus({ months: event.key === "PageUp" ? -1 : 1 })
                          .toISODate()!,
                      );
                    }
                  }}
                >
                  {day.day}
                </button>
              );
            })}
          </div>
          <button
            className="text-button"
            onClick={() => {
              onChange(today!);
              setOpen(false);
              trigger.current?.focus();
            }}
          >
            Heute auswählen
          </button>
        </div>
      )}
    </div>
  );
}
