import { useState, useMemo, useCallback } from "react";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { getCalendarGrid, isSameDay, isToday, isCurrentMonth, formatMonthYear } from "~/lib/calendar";

type DateTimePickerProps = {
  value: string; // "YYYY-MM-DDTHH:mm" format
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  id?: string;
};

function parseValue(value: string) {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  if (!datePart) return null;
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart ? timePart.split(":").map(Number) : [0, 0];
  return { year: y, month: m - 1, day: d, hour: h, minute: min };
}

function formatDisplay(value: string): string {
  const parsed = parseValue(value);
  if (!parsed) return "";
  const date = new Date(parsed.year, parsed.month, parsed.day);
  const dateStr = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const h = String(parsed.hour).padStart(2, "0");
  const m = String(parsed.minute).padStart(2, "0");
  return `${dateStr} ${h}:${m}`;
}

function buildValue(year: number, month: number, day: number, hour: number, minute: number): string {
  const y = String(year);
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  const h = String(hour).padStart(2, "0");
  const min = String(minute).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Select date and time",
  required,
  id,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);

  const parsed = useMemo(() => parseValue(value), [value]);

  const now = new Date();
  const [viewYear, setViewYear] = useState(() => parsed?.year ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parsed?.month ?? now.getMonth());

  // Sync view when popover opens
  const handleOpenChange = useCallback(
    (o: boolean) => {
      if (o && parsed) {
        setViewYear(parsed.year);
        setViewMonth(parsed.month);
      } else if (o) {
        const n = new Date();
        setViewYear(n.getFullYear());
        setViewMonth(n.getMonth());
      }
      setOpen(o);
    },
    [parsed],
  );

  const grid = useMemo(() => getCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const selectedDate = parsed ? new Date(parsed.year, parsed.month, parsed.day) : null;
  const currentHour = parsed?.hour ?? now.getHours();
  const currentMinute = parsed?.minute ?? Math.floor(now.getMinutes() / 5) * 5;

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function selectDay(date: Date) {
    const h = parsed?.hour ?? currentHour;
    const m = parsed?.minute ?? currentMinute;
    onChange(buildValue(date.getFullYear(), date.getMonth(), date.getDate(), h, m));
  }

  function selectHour(h: number) {
    if (!parsed) {
      // No date selected yet — use today
      const t = new Date();
      onChange(buildValue(t.getFullYear(), t.getMonth(), t.getDate(), h, currentMinute));
    } else {
      onChange(buildValue(parsed.year, parsed.month, parsed.day, h, parsed.minute));
    }
  }

  function selectMinute(m: number) {
    if (!parsed) {
      const t = new Date();
      onChange(buildValue(t.getFullYear(), t.getMonth(), t.getDate(), currentHour, m));
    } else {
      onChange(buildValue(parsed.year, parsed.month, parsed.day, parsed.hour, m));
    }
  }

  const displayText = formatDisplay(value);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-start font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="size-4 opacity-50" />
          <span className="truncate">{displayText || placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto min-w-[280px] max-w-[calc(100vw-2rem)] p-0"
        align="start"
      >
        {/* Calendar */}
        <div className="p-3">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={prevMonth}
              aria-label="Previous month"
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="text-sm font-medium">
              {formatMonthYear(viewYear, viewMonth)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={nextMonth}
              aria-label="Next month"
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="text-center text-xs text-muted-foreground font-medium py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {grid.map((date, i) => {
              const inMonth = isCurrentMonth(date, viewYear, viewMonth);
              const today = isToday(date);
              const selected = selectedDate ? isSameDay(date, selectedDate) : false;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDay(date)}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md text-sm h-9 w-9 transition-colors",
                    !inMonth && "text-muted-foreground/40",
                    inMonth && !selected && "hover:bg-accent",
                    today && !selected && "ring-1 ring-primary/30",
                    selected && "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                  aria-label={date.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  aria-selected={selected}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time picker */}
        <div className="border-t px-3 py-2 flex items-center gap-2">
          <ClockIcon className="size-4 text-muted-foreground shrink-0" />
          <select
            value={currentHour}
            onChange={(e) => selectHour(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            aria-label="Hour"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground">:</span>
          <select
            value={currentMinute}
            onChange={(e) => selectMinute(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            aria-label="Minute"
          >
            {MINUTES.map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
