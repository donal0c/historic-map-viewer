import type { ViewMode, BlendMode } from "../types";

export interface ViewModeOption {
  id: ViewMode;
  label: string;
  icon: string;
  description: string;
}

export const viewModes: ViewModeOption[] = [
  {
    id: "overlay",
    label: "Overlay",
    icon: "◻",
    description: "Adjustable opacity overlay",
  },
  {
    id: "swipe",
    label: "Swipe",
    icon: "⇔",
    description: "Drag divider to compare",
  },
  {
    id: "side-by-side",
    label: "Side by Side",
    icon: "◫",
    description: "Two synced maps",
  },
  {
    id: "spyglass",
    label: "Spyglass",
    icon: "◎",
    description: "Circular lens follows cursor",
  },
];

export interface BlendModeOption {
  id: BlendMode;
  label: string;
}

export const blendModes: BlendModeOption[] = [
  { id: "normal", label: "Normal" },
  { id: "multiply", label: "Multiply" },
  { id: "screen", label: "Screen" },
  { id: "overlay", label: "Overlay" },
  { id: "soft-light", label: "Soft Light" },
];
