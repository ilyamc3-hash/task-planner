export const todayISO = () => new Date().toISOString().slice(0, 10);

export function shiftDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

export function formatDuration(min) {
  if (!min) return null;
  if (min < 60) return `${min} мин`;
  const h = min / 60;
  return Number.isInteger(h) ? `${h} ч` : `${h.toFixed(1)} ч`;
}

export function deadlineState(iso) {
  if (!iso) return "none";
  const today = todayISO();
  if (iso < today) return "overdue";
  if (iso === today) return "today";
  return "future";
}

export function buildSections(list) {
  const groups = { overdue: [], today: [], future: [], none: [], done: [] };
  list.forEach((t) => {
    if (t.done) {
      groups.done.push(t);
      return;
    }
    groups[deadlineState(t.deadline)].push(t);
  });
  ["overdue", "today", "future"].forEach((k) =>
    groups[k].sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""))
  );
  return groups;
}

export const dayLabel = () => {
  const days = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const months = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const now = new Date();
  return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
};
