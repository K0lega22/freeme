import LeftSidebar from "../LeftSidebar";
import { useState } from "react";

export default function LeftSidebarExample() {
  const [activeView, setActiveView] = useState("calendar");

  return <LeftSidebar activeView={activeView} onViewChange={setActiveView} />;
}
