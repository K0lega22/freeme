import { useState, useMemo } from "react";
import { format, startOfWeek, addDays, isSameDay, isToday } from "date-fns";

interface Event {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  color?: string;
}

interface CalendarGridProps {
  currentDate: Date;
  view: "day" | "3-day" | "week";
  events?: Event[];
}

export default function CalendarGrid({ currentDate, view, events = [] }: CalendarGridProps) {
  const timeSlots = Array.from({ length: 24 }, (_, i) => i);
  
  const days = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const dayCount = view === "day" ? 1 : view === "3-day" ? 3 : 7;
    return Array.from({ length: dayCount }, (_, i) => addDays(start, i));
  }, [currentDate, view]);

  const getEventsForDayAndTime = (day: Date, hour: number) => {
    return events.filter((event) => {
      const eventHour = event.startTime.getHours();
      return isSameDay(event.startTime, day) && eventHour === hour;
    });
  };

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="flex border-b border-border">
        <div className="w-16 border-r border-border" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`flex-1 text-center py-3 border-r border-border ${
              isToday(day) ? "bg-primary/10" : ""
            }`}
            data-testid={`header-day-${format(day, "yyyy-MM-dd")}`}
          >
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {format(day, "EEE")}
            </div>
            <div
              className={`text-2xl font-semibold mt-1 ${
                isToday(day) ? "text-primary" : ""
              }`}
            >
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      <div className="flex">
        <div className="w-16 border-r border-border">
          {timeSlots.map((hour) => (
            <div
              key={hour}
              className="h-16 flex items-start justify-center pt-1 text-xs text-muted-foreground font-mono border-b border-border"
              data-testid={`time-${hour}`}
            >
              {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
            </div>
          ))}
        </div>

        {days.map((day) => (
          <div key={day.toISOString()} className="flex-1 border-r border-border">
            {timeSlots.map((hour) => {
              const dayEvents = getEventsForDayAndTime(day, hour);
              return (
                <div
                  key={hour}
                  className="h-16 border-b border-border relative hover-elevate"
                  data-testid={`cell-${format(day, "yyyy-MM-dd")}-${hour}`}
                >
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className="absolute inset-x-1 top-1 bottom-1 rounded-md px-2 py-1 text-xs font-medium text-white overflow-hidden"
                      style={{
                        backgroundColor: event.color || "#3B82F6",
                        borderLeft: `4px solid ${event.color || "#3B82F6"}`,
                      }}
                      data-testid={`event-${event.id}`}
                    >
                      {event.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
