import { CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  description?: string;
}

interface TaskSidebarProps {
  tasks: Task[];
  onToggleTask: (id: string) => void;
}

export default function TaskSidebar({ tasks, onToggleTask }: TaskSidebarProps) {
  return (
    <div className="w-80 bg-card border-l border-card-border flex flex-col">
      <div className="p-4 border-b border-card-border">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          This Week
        </h2>
        <h3 className="text-xl font-semibold mt-1">Tasks</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => onToggleTask(task.id)}
              className="w-full flex items-start gap-3 p-3 rounded-md hover-elevate active-elevate-2 text-left transition-colors"
              data-testid={`task-${task.id}`}
            >
              {task.completed ? (
                <CheckCircle2 className="h-5 w-5 text-chart-3 flex-shrink-0 mt-0.5" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    task.completed
                      ? "line-through text-muted-foreground"
                      : "text-card-foreground"
                  }`}
                >
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {task.description}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
