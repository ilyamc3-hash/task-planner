import { Clock } from "lucide-react";
import { styles } from "../styles";
import { DURATIONS, PRIORITY, QUICK_DATES } from "../constants";
import { shiftDate } from "../utils";
import ReminderPicker from "./ReminderPicker";

export default function TaskForm({ draft, setDraft, contexts, projectsForContext, showContextSelect, onCancel, onSave }) {
  return (
    <div style={styles.form}>
      <input
        autoFocus
        placeholder="Что нужно сделать?"
        value={draft.text}
        onChange={(e) => setDraft({ ...draft, text: e.target.value })}
        style={styles.input}
        onKeyDown={(e) => e.key === "Enter" && onSave()}
      />
      <div style={styles.formRow}>
        {showContextSelect && (
          <select
            value={draft.contextId}
            onChange={(e) => setDraft({ ...draft, contextId: e.target.value, projectId: "" })}
            style={styles.select}
          >
            {contexts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {projectsForContext.length > 0 && (
          <select
            value={draft.projectId}
            onChange={(e) => setDraft({ ...draft, projectId: e.target.value })}
            style={styles.select}
          >
            <option value="">Без проекта</option>
            {projectsForContext.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })} style={styles.select}>
          {Object.entries(PRIORITY).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.quickDates}>
        {QUICK_DATES.map((q) => {
          const value = shiftDate(q.offset);
          return (
            <button
              key={q.label}
              type="button"
              onClick={() => setDraft({ ...draft, deadline: value })}
              style={{ ...styles.quickChip, ...(draft.deadline === value ? styles.quickChipActive : {}) }}
            >
              {q.label}
            </button>
          );
        })}
        <input
          type="date"
          value={draft.deadline}
          onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
          style={styles.dateInput}
        />
      </div>

      <div style={styles.quickDates}>
        <Clock size={12} color="#A69C86" style={{ marginRight: -2 }} />
        {DURATIONS.map((d) => (
          <button
            key={d.label}
            type="button"
            onClick={() => setDraft({ ...draft, durationMinutes: draft.durationMinutes === d.minutes ? null : d.minutes })}
            style={{ ...styles.quickChip, ...(draft.durationMinutes === d.minutes ? styles.quickChipActive : {}) }}
          >
            {d.label}
          </button>
        ))}
      </div>

      <ReminderPicker
        valueISO={draft.reminderAt}
        deadline={draft.deadline}
        onChange={(reminderAt) => setDraft({ ...draft, reminderAt })}
      />

      <div style={styles.formActions}>
        <button style={styles.cancelBtn} onClick={onCancel}>
          Отмена
        </button>
        <button style={styles.saveBtn} onClick={onSave}>
          Записать
        </button>
      </div>
    </div>
  );
}
