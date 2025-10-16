import EventModal from "../EventModal";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function EventModalExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Event Modal</Button>
      <EventModal
        open={open}
        onOpenChange={setOpen}
        onCreateEvent={(event) => console.log("Event created:", event)}
      />
    </div>
  );
}
