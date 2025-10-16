import { Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface AICommandBarProps {
  onSubmit: (command: string) => void;
}

export default function AICommandBar({ onSubmit }: AICommandBarProps) {
  const [command, setCommand] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      onSubmit(command);
      setCommand("");
    }
  };

  return (
    <div className="border-t border-border bg-card/50 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="flex items-center gap-3 px-6 py-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <Input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Ask AuraFlow to schedule, find, or manage..."
          className="flex-1 bg-background/50 border-input"
          data-testid="input-ai-command"
        />
        <Button
          type="submit"
          size="icon"
          variant="default"
          data-testid="button-ai-submit"
          className="h-10 w-10"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
