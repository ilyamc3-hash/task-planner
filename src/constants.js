import { Factory, Code2, Home, LayoutGrid } from "lucide-react";

export const ALL_CONTEXT = { id: "all", name: "Все", color: "#8A8370" };

export const CONTEXT_ICONS = {
  all: LayoutGrid,
  gazprom: Factory,
  freelance: Code2,
  personal: Home,
};
export const DEFAULT_CONTEXT_ICON = LayoutGrid;

export const DURATIONS = [
  { label: "15 мин", minutes: 15 },
  { label: "30 мин", minutes: 30 },
  { label: "1 час", minutes: 60 },
  { label: "2 часа", minutes: 120 },
  { label: "Полдня", minutes: 240 },
];

export const PRIORITY = {
  high: { label: "Высокий", color: "#C9A227" },
  med: { label: "Средний", color: "#93A0AE" },
  low: { label: "Низкий", color: "#B7AE99" },
};

export const TODAY_COLOR = "#6E8B99";
export const OVERDUE_COLOR = "#B5654A";

export const SECTION_LABELS = {
  overdue: "Просрочено",
  today: "Сегодня",
  future: "Позже",
  none: "Без даты",
  done: "Готово",
};

export const SECTION_ORDER = ["overdue", "today", "future", "none", "done"];

export const QUICK_DATES = [
  { label: "Сегодня", offset: 0 },
  { label: "Завтра", offset: 1 },
  { label: "Через 3 дня", offset: 3 },
  { label: "Через неделю", offset: 7 },
];

// "Дедлайн" хранится как дата без времени — для чипсов "до дедлайна"
// считаем условным временем дедлайна 09:00 того дня.
export const DEADLINE_NOMINAL_HOUR = 9;

export const REMINDER_PRESETS = [
  { label: "За 30 мин до дедлайна", minutesBeforeDeadline: 30, needsDeadline: true },
  { label: "За 1 час до дедлайна", minutesBeforeDeadline: 60, needsDeadline: true },
  { label: "Утром в день дедлайна (09:00)", minutesBeforeDeadline: 0, needsDeadline: true },
];
