import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/formatting";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

interface CalendarMonthProps {
  monthDate: Date;
  onMonthChange: (next: Date) => void;
  /** Anything with a YYYY-MM-DD `date`; days that have one get a dot. */
  events?: { date: string }[];
  selectedDate: string;
  onSelectDate: (isoDate: string) => void;
  dotClassName?: string;
}

export default function CalendarMonth({
  monthDate,
  onMonthChange,
  events = [],
  selectedDate,
  onSelectDate,
  dotClassName = "bg-primary",
}: CalendarMonthProps) {
  const month = dayjs(monthDate);
  const gridEnd = month.endOf("month").endOf("week");

  // Every day shown in the grid, from the Sunday before the 1st to the Saturday after the last.
  const days: dayjs.Dayjs[] = [];
  for (let cursor = month.startOf("month").startOf("week"); !cursor.isAfter(gridEnd, "day"); cursor = cursor.add(1, "day")) {
    days.push(cursor);
  }

  const eventsByDay = events.reduce<Record<string, number>>((acc, item) => {
    if (item.date) acc[item.date] = (acc[item.date] ?? 0) + 1;
    return acc;
  }, {});

  const today = todayISO();

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-base font-semibold tracking-tight">{month.format("MMMM YYYY")}</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous month"
            onClick={() => onMonthChange(month.subtract(1, "month").toDate())}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next month"
            onClick={() => onMonthChange(month.add(1, "month").toDate())}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {WEEKDAYS.map((day, index) => (
          <span key={`${day}-${index}`} className="py-1">
            {day}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = day.format("YYYY-MM-DD");
          const inMonth = day.month() === month.month();
          const isToday = key === today;
          const isSelected = key === selectedDate;
          const count = eventsByDay[key] ?? 0;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(key)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors",
                inMonth ? "text-foreground" : "text-muted-foreground/40",
                !isSelected && "hover:bg-muted",
                isSelected && "bg-primary font-semibold text-primary-foreground shadow-sm",
                !isSelected && isToday && "font-semibold text-primary ring-1 ring-inset ring-primary/40"
              )}
            >
              {day.date()}
              {count > 0 && (
                <span
                  className={cn(
                    "absolute bottom-1.5 h-1.5 w-1.5 rounded-full",
                    isSelected ? "bg-primary-foreground" : dotClassName
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
