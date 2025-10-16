import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CalendarHeaderProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  view: "day" | "3-day" | "week";
  onViewChange: (view: "day" | "3-day" | "week") => void;
  onCreateEvent: () => void;
  onCreateTask: () => void;
}

export default function CalendarHeader({
  currentDate,
  onPrevMonth,
  onNextMonth,
  view,
  onViewChange,
  onCreateEvent,
  onCreateTask,
}: CalendarHeaderProps) {
  const monthYear = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border">
      <div className="flex items-center gap-4">
        <Button
          size="icon"
          variant="ghost"
          onClick={onPrevMonth}
          data-testid="button-prev-month"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-semibold min-w-[200px] text-center" data-testid="text-month-year">
          {monthYear}
        </h1>
        <Button
          size="icon"
          variant="ghost"
          onClick={onNextMonth}
          data-testid="button-next-month"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-muted/50 rounded-md p-1">
          <Button
            size="sm"
            variant={view === "day" ? "secondary" : "ghost"}
            onClick={() => onViewChange("day")}
            data-testid="button-view-day"
            className="h-8"
          >
            Day
          </Button>
          <Button
            size="sm"
            variant={view === "3-day" ? "secondary" : "ghost"}
            onClick={() => onViewChange("3-day")}
            data-testid="button-view-3day"
            className="h-8"
          >
            3-Day
          </Button>
          <Button
            size="sm"
            variant={view === "week" ? "secondary" : "ghost"}
            onClick={() => onViewChange("week")}
            data-testid="button-view-week"
            className="h-8"
          >
            Week
          </Button>
        </div>

        <Button
          variant="default"
          onClick={onCreateEvent}
          data-testid="button-create-event"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Event
        </Button>

        <Button
          variant="outline"
          onClick={onCreateTask}
          data-testid="button-create-task"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>
    </header>
  );
}
