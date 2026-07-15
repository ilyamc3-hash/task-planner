import { useRef, useState } from "react";
import { AlertTriangle, Bell, Check, CheckCircle2, Circle, Clock, Trash2, X } from "lucide-react";
import { styles } from "../styles";
import { PRIORITY, CONTEXT_ICONS, DEFAULT_CONTEXT_ICON } from "../constants";
import { deadlineState, formatDate, formatDuration, formatReminder } from "../utils";
import ReminderPicker from "./ReminderPicker";

export default function TaskCard({
  task,
  contextMeta,
  projectName,
  showContextTag,
  isTopUrgent,
  onToggleDone,
  onRemove,
  onSaveText,
  onSetReminder,
}) {
  const [swipeX, setSwipeX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [showReminderEditor, setShowReminderEditor] = useState(false);
  const dragStart = useRef(0);

  const dState = deadlineState(task.deadline);
  const CtxIcon = contextMeta ? CONTEXT_ICONS[contextMeta.id] || DEFAULT_CONTEXT_ICON : null;

  const onTouchStart = (e) => {
    dragStart.current = e.touches[0].clientX;
    setDragging(true);
  };
  const onTouchMove = (e) => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - dragStart.current;
    setSwipeX(Math.max(-90, Math.min(90, dx)));
  };
  const onTouchEnd = () => {
    if (swipeX <= -60) onRemove(task.id);
    else if (swipeX >= 60) onToggleDone(task.id);
    setSwipeX(0);
    setDragging(false);
  };

  const startEdit = () => {
    setEditText(task.text);
    setIsEditing(true);
  };
  const saveEdit = () => {
    const clean = editText.trim();
    if (clean && clean !== task.text) onSaveText(task.id, clean);
    setIsEditing(false);
  };

  return (
    <div style={styles.swipeWrap}>
      <div style={styles.swipeActionLeft}>
        <Check size={15} strokeWidth={2.5} />
      </div>
      <div style={styles.swipeActionRight}>
        <Trash2 size={15} strokeWidth={2.5} />
      </div>

      <div
        style={{
          ...styles.card,
          borderLeftColor: contextMeta?.color || "#C9BFA8",
          opacity: task.done ? 0.5 : 1,
          ...(isTopUrgent ? styles.cardUrgent : {}),
          transform: `translateX(${swipeX}px)`,
          transition: dragging ? "none" : "transform 0.2s ease",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <button onClick={() => onToggleDone(task.id)} style={styles.checkBtn} aria-label="Переключить статус">
          {task.done ? (
            <CheckCircle2 size={18} color="#8B9D7A" strokeWidth={2} />
          ) : (
            <Circle size={18} color="#C9BFA8" strokeWidth={2} />
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          {isEditing ? (
            <input
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => e.key === "Enter" && saveEdit()}
              style={styles.editInput}
            />
          ) : (
            <div
              onClick={() => !task.done && startEdit()}
              style={{
                ...styles.cardText,
                textDecoration: task.done ? "line-through" : "none",
                fontWeight: isTopUrgent ? 600 : 400,
                cursor: task.done ? "default" : "text",
              }}
            >
              {task.text}
            </div>
          )}
          <div style={styles.metaRow}>
            {showContextTag && contextMeta && CtxIcon && (
              <span style={{ ...styles.metaTag, color: contextMeta.color }}>
                <CtxIcon size={10} strokeWidth={2} /> {contextMeta.name}
              </span>
            )}
            {projectName && <span style={styles.projectTag}>{projectName}</span>}
            <span style={{ ...styles.metaTag, color: PRIORITY[task.priority].color }}>
              ● {PRIORITY[task.priority].label}
            </span>
            {task.durationMinutes && (
              <span style={styles.metaTag}>
                <Clock size={10} strokeWidth={2} /> {formatDuration(task.durationMinutes)}
              </span>
            )}
            {task.deadline && (
              <span
                style={{
                  ...styles.deadline,
                  color: dState === "overdue" ? "#B5654A" : dState === "today" ? "#6E8B99" : "#A69C86",
                }}
              >
                {dState === "overdue" && <AlertTriangle size={10} strokeWidth={2} />}
                {formatDate(task.deadline)}
              </span>
            )}
            {!task.done && (
              <button
                type="button"
                onClick={() => setShowReminderEditor((v) => !v)}
                style={{ ...styles.bellBtn, ...(task.reminderAt ? styles.bellBtnActive : {}) }}
              >
                <Bell size={11} strokeWidth={2} />
                {task.reminderAt ? formatReminder(task.reminderAt) : "Напоминание"}
              </button>
            )}
          </div>

          {showReminderEditor && (
            <div style={styles.reminderPopover} onClick={(e) => e.stopPropagation()}>
              <ReminderPicker
                valueISO={task.reminderAt}
                deadline={task.deadline}
                onChange={(reminderAt) => onSetReminder(task.id, reminderAt)}
              />
            </div>
          )}
        </div>

        <button onClick={() => onRemove(task.id)} style={styles.removeBtn} aria-label="Удалить">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
