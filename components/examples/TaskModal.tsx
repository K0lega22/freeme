import TaskModal from "../TaskModal";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function TaskModalExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Task Modal</Button>
      <TaskModal
        open={open}
        onOpenChange={setOpen}
        onCreateTask={(task) => console.log("Task created:", task)}
      />
    </div>
  );
}
