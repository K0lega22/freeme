import TaskSidebar from "../TaskSidebar";
import { useState } from "react";

export default function TaskSidebarExample() {
  const [tasks, setTasks] = useState([
    { id: "1", title: "Review Q2 Report", completed: false },
    { id: "2", title: "Update project timeline", completed: true },
    { id: "3", title: "Prepare client presentation", completed: false },
    { id: "4", title: "Send follow-up emails to new leads", completed: false },
    { id: "5", title: "Research new AI tools for efficiency", completed: true },
    { id: "6", title: "Schedule team building activity for July", completed: false },
    { id: "7", title: "Draft marketing campaign brief", completed: false },
  ]);

  const handleToggleTask = (id: string) => {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  return <TaskSidebar tasks={tasks} onToggleTask={handleToggleTask} />;
}
