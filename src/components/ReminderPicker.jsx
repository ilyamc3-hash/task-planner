import { Bell, X } from "lucide-react";
import { styles } from "../styles";
import { REMINDER_PRESETS, DEADLINE_NOMINAL_HOUR } from "../constants";
import { datetimeLocalToISO, reminderPresetValue, toDatetimeLocalValue } from "../utils";
import { pushSupported } from "../push";

export default function ReminderPicker({ valueISO, deadline, onChange }) {
  const localValue = valueISO ? toDatetimeLocalValue(new Date(valueISO)) : "";
  const notificationsBlocked =
    pushSupported() && typeof Notification !== "undefined" && Notification.permission === "denied";
  const notificationsUnsupported = !pushSupported();

  return (
    <div style={styles.reminderRow}>
      <Bell size={12} color="#A69C86" style={{ marginRight: -2 }} />
      {REMINDER_PRESETS.map((preset) => {
        const presetValue = deadline
          ? reminderPresetValue(deadline, preset.minutesBeforeDeadline, DEADLINE_NOMINAL_HOUR)
          : null;
        const active = Boolean(presetValue) && presetValue === localValue;
        return (
          <button
            key={preset.label}
            type="button"
            disabled={!presetValue}
            onClick={() => presetValue && onChange(datetimeLocalToISO(presetValue))}
            style={{
              ...styles.quickChip,
              ...(active ? styles.quickChipActive : {}),
              ...(!presetValue ? styles.quickChipDisabled : {}),
            }}
            title={!presetValue ? "Сначала укажите дедлайн" : undefined}
          >
            {preset.label}
          </button>
        );
      })}
      <input
        type="datetime-local"
        value={localValue}
        onChange={(e) => onChange(datetimeLocalToISO(e.target.value))}
        style={styles.dateInput}
      />
      {valueISO && (
        <button type="button" onClick={() => onChange(null)} style={styles.removeBtn} aria-label="Убрать напоминание">
          <X size={13} />
        </button>
      )}
      {valueISO && notificationsUnsupported && (
        <div style={styles.reminderHint}>Push-уведомления не поддерживаются в этом браузере</div>
      )}
      {valueISO && notificationsBlocked && (
        <div style={styles.reminderHint}>Уведомления заблокированы в браузере — время сохранится, но пуш не придёт</div>
      )}
    </div>
  );
}
