import CalendarHeader from "../CalendarHeader";
import { useState } from "react";

export default function CalendarHeaderExample() {
  const [currentDate] = useState(new Date(2025, 9, 1));
  const [view, setView] = useState<"day" | "3-day" | "week">("week");

  return (
    <CalendarHeader
      currentDate={currentDate}
      onPrevMonth={() => console.log("Previous month")}
      onNextMonth={() => console.log("Next month")}
      view={view}
      onViewChange={setView}
      onCreateEvent={() => console.log("Create event")}
      onCreateTask={() => console.log("Create task")}
    />
  );
}
