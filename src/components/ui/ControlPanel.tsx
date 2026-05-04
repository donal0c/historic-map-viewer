import type { ReactNode } from "react";

interface ControlPanelProps {
  children: ReactNode;
}

export default function ControlPanel({ children }: ControlPanelProps) {
  return (
    <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2 rounded-xl bg-white/80 p-3 shadow-lg backdrop-blur-md max-w-[280px]">
      {children}
    </div>
  );
}
