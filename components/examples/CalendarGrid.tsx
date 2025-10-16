import CalendarGrid from "../CalendarGrid";

export default function CalendarGridExample() {
  const currentDate = new Date(2025, 9, 1);
  
  const mockEvents = [
    {
      id: "1",
      title: "Team Meeting",
      startTime: new Date(2025, 9, 1, 10, 0),
      endTime: new Date(2025, 9, 1, 11, 0),
      color: "#3B82F6",
    },
    {
      id: "2",
      title: "Lunch Break",
      startTime: new Date(2025, 9, 2, 12, 0),
      endTime: new Date(2025, 9, 2, 13, 0),
      color: "#10B981",
    },
  ];

  return <CalendarGrid currentDate={currentDate} view="week" events={mockEvents} />;
}
