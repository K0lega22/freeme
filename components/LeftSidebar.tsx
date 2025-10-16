import { Calendar, CheckSquare, BarChart3, Settings, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LeftSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export default function LeftSidebar({ activeView, onViewChange }: LeftSidebarProps) {
  const navItems = [
    { icon: Menu, label: "Menu", value: "menu" },
    { icon: Calendar, label: "Calendar", value: "calendar" },
    { icon: CheckSquare, label: "Tasks", value: "tasks" },
    { icon: BarChart3, label: "Analytics", value: "analytics" },
    { icon: Settings, label: "Settings", value: "settings" },
  ];

  return (
    <div className="w-16 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4 gap-2">
      {navItems.map((item) => (
        <Button
          key={item.value}
          onClick={() => onViewChange(item.value)}
          data-testid={`button-nav-${item.value}`}
          className="h-10 w-10"
        >
          <item.icon className="h-5 w-5" />
        </Button>
      ))}
    </div>
  );
}
