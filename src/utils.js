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

// datetime-local inputs use "YYYY-MM-DDTHH:mm" in the browser's local time.
export function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function datetimeLocalToISO(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function reminderPresetValue(deadlineISO, minutesBeforeDeadline, nominalHour) {
  if (!deadlineISO) return null;
  const [y, m, d] = deadlineISO.split("-").map(Number);
  const base = new Date(y, m - 1, d, nominalHour, 0, 0);
  base.setMinutes(base.getMinutes() - minutesBeforeDeadline);
  return toDatetimeLocalValue(base);
}

export function formatReminder(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const datePart = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  const timePart = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

export const dayLabel = () => {
  const days = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const months = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const now = new Date();
  return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
};
