import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, Plus, Upload } from "lucide-react";
import {
  addProject,
  addTask,
  deleteTask,
  exportAll,
  getAllContexts,
  getAllProjects,
  getAllTasks,
  importAll,
  seedIfEmpty,
  updateTask,
} from "./db";
import TaskCard from "./components/TaskCard";
import TaskForm from "./components/TaskForm";
import { fontImport, styles } from "./styles";
import { ALL_CONTEXT, CONTEXT_ICONS, SECTION_LABELS, SECTION_ORDER, TODAY_COLOR, OVERDUE_COLOR } from "./constants";
import { buildSections, dayLabel, deadlineState } from "./utils";
import { deleteReminder, upsertReminder } from "./push";

const emptyDraft = () => ({
  text: "",
  contextId: "",
  projectId: "",
  priority: "med",
  deadline: "",
  durationMinutes: null,
  reminderAt: null,
});

export default function App() {
  const [loading, setLoading] = useState(true);
  const [contexts, setContexts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeCtx, setActiveCtx] = useState("all");
  const [activeProject, setActiveProject] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);
  const toastTimer = useRef(null);

  const showToast = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const reload = async () => {
    const [ctxs, projs, tsks] = await Promise.all([getAllContexts(), getAllProjects(), getAllTasks()]);
    setContexts(ctxs);
    setProjects(projs);
    setTasks(tsks);
  };

  useEffect(() => {
    (async () => {
      await seedIfEmpty();
      await reload();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    setActiveProject("all");
  }, [activeCtx]);

  useEffect(() => {
    if (!draft.contextId && contexts.length > 0) {
      setDraft((d) => ({ ...d, contextId: contexts[0].id }));
    }
  }, [contexts, draft.contextId]);

  const tabList = useMemo(() => [ALL_CONTEXT, ...contexts], [contexts]);

  const availableProjects = useMemo(
    () => (activeCtx === "all" ? [] : projects.filter((p) => p.contextId === activeCtx)),
    [projects, activeCtx]
  );

  const handleAddProject = async () => {
    const clean = newProjectName.trim();
    if (!clean) {
      setAddingProject(false);
      return;
    }
    const project = await addProject(activeCtx, clean);
    setProjects((prev) => [...prev, project]);
    setNewProjectName("");
    setAddingProject(false);
  };

  const filtered = useMemo(() => {
    let list = activeCtx === "all" ? tasks : tasks.filter((t) => t.contextId === activeCtx);
    if (activeCtx !== "all" && activeProject !== "all") {
      list = list.filter((t) => t.projectId === activeProject);
    }
    return list;
  }, [tasks, activeCtx, activeProject]);

  const sections = useMemo(() => buildSections(filtered), [filtered]);
  const isEmpty = SECTION_ORDER.every((k) => sections[k].length === 0);

  const stats = useMemo(() => {
    const active = tasks.filter((t) => !t.done);
    const overdue = active.filter((t) => deadlineState(t.deadline) === "overdue").length;
    const today = active.filter((t) => deadlineState(t.deadline) === "today").length;
    return { overdue, today };
  }, [tasks]);

  const contextCounts = useMemo(() => {
    const map = { all: 0 };
    contexts.forEach((c) => (map[c.id] = 0));
    tasks.forEach((t) => {
      if (!t.done) {
        map.all += 1;
        if (t.contextId in map) map[t.contextId] += 1;
      }
    });
    return map;
  }, [tasks, contexts]);

  const projectCounts = useMemo(() => {
    const map = {};
    availableProjects.forEach((p) => (map[p.id] = 0));
    tasks.forEach((t) => {
      if (!t.done && t.contextId === activeCtx && t.projectId) map[t.projectId] = (map[t.projectId] || 0) + 1;
    });
    return map;
  }, [tasks, activeCtx, availableProjects]);

  const toggleDone = async (id) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    await updateTask(id, { done: !target.done });
    if (!target.done && target.reminderAt) {
      deleteReminder(id).catch(() => {});
    }
  };

  const removeTask = async (id) => {
    const target = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await deleteTask(id);
    if (target?.reminderAt) {
      deleteReminder(id).catch(() => {});
    }
  };

  const saveText = async (id, text) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));
    await updateTask(id, { text });
    const target = tasks.find((t) => t.id === id);
    if (target?.reminderAt) {
      upsertReminder({ id, text, remindAt: target.reminderAt }).catch((err) => showToast(err.message));
    }
  };

  const setReminder = async (id, reminderAt) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, reminderAt } : t)));
    const updated = await updateTask(id, { reminderAt });
    try {
      if (reminderAt) {
        await upsertReminder({ id, text: updated.text, remindAt: reminderAt });
      } else {
        await deleteReminder(id);
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleAddTask = async () => {
    if (!draft.text.trim()) return;
    const contextId = activeCtx === "all" ? draft.contextId : activeCtx;
    const record = await addTask({
      text: draft.text.trim(),
      contextId: contextId || null,
      projectId: draft.projectId || null,
      priority: draft.priority,
      deadline: draft.deadline || null,
      durationMinutes: draft.durationMinutes || null,
      reminderAt: draft.reminderAt || null,
    });
    setTasks((prev) => [...prev, record]);
    setDraft({ ...emptyDraft(), contextId: contexts[0]?.id || "" });
    setShowForm(false);
    if (record.reminderAt) {
      try {
        await upsertReminder({ id: record.id, text: record.text, remindAt: record.reminderAt });
      } catch (err) {
        showToast(err.message);
      }
    }
  };

  const handleExport = async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `task-planner-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Резервная копия сохранена");
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const confirmed = window.confirm(
        "Импорт полностью заменит текущие данные приложения загруженной резервной копией. Продолжить?"
      );
      if (!confirmed) return;
      await importAll(data);
      await reload();
      showToast("Данные восстановлены из копии");
    } catch (err) {
      showToast("Не удалось импортировать файл: " + err.message);
    }
  };

  const formContextId = activeCtx === "all" ? draft.contextId : activeCtx;
  const formProjects = projects.filter((p) => p.contextId === formContextId);

  if (loading) {
    return (
      <div style={styles.app}>
        <style>{fontImport}</style>
        <div style={styles.loading}>Загрузка…</div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <style>{fontImport}</style>

      <div style={styles.eyebrowRow}>
        <div style={styles.eyebrow}>{dayLabel()}</div>
        <div style={styles.backupLinks}>
          <button style={styles.backupBtn} onClick={handleExport} title="Скачать резервную копию JSON">
            <Download size={13} strokeWidth={2.2} /> Экспорт
          </button>
          <button style={styles.backupBtn} onClick={handleImportClick} title="Загрузить резервную копию JSON">
            <Upload size={13} strokeWidth={2.2} /> Импорт
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />
        </div>
      </div>

      <div style={styles.header}>
        <h1 style={styles.title}>Что по плану</h1>
        <div style={styles.readout}>
          <ReadoutStat label="сегодня" value={stats.today} color={TODAY_COLOR} />
          <ReadoutStat label="горит" value={stats.overdue} color={OVERDUE_COLOR} />
        </div>
      </div>
      <div style={styles.rule} />

      <div style={styles.tabs}>
        {tabList.map((c) => {
          const Icon = CONTEXT_ICONS[c.id];
          const active = activeCtx === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCtx(c.id)}
              style={{ ...styles.tab, ...(active ? { ...styles.tabActive, borderColor: c.color } : {}) }}
            >
              <Icon size={13} strokeWidth={2} color={active ? c.color : "#A69C86"} />
              <span style={{ color: active ? "#2E2A22" : "#A69C86" }}>{c.name}</span>
              <span style={styles.tabCount}>{contextCounts[c.id] || 0}</span>
            </button>
          );
        })}
      </div>

      {activeCtx !== "all" && (
        <div style={styles.projectRow}>
          {availableProjects.length > 0 && (
            <button
              onClick={() => setActiveProject("all")}
              style={{ ...styles.projectChip, ...(activeProject === "all" ? styles.projectChipActive : {}) }}
            >
              Все проекты
            </button>
          )}
          {availableProjects.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveProject(p.id)}
              style={{ ...styles.projectChip, ...(activeProject === p.id ? styles.projectChipActive : {}) }}
            >
              {p.name} <span style={styles.projectChipCount}>{projectCounts[p.id] || 0}</span>
            </button>
          ))}

          {addingProject ? (
            <input
              autoFocus
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddProject()}
              onBlur={handleAddProject}
              placeholder="Название проекта"
              style={styles.projectInput}
            />
          ) : (
            <button onClick={() => setAddingProject(true)} style={styles.projectAddChip}>
              <Plus size={11} strokeWidth={2.5} /> Проект
            </button>
          )}
        </div>
      )}

      <div style={styles.list}>
        {isEmpty && (
          <div style={styles.empty}>
            <CheckCircle2 size={20} color="#C9BFA8" strokeWidth={2} style={{ marginBottom: 6 }} />
            <div>Контекст закрыт. Ничего не висит.</div>
          </div>
        )}

        {SECTION_ORDER.map((key) => {
          const items = sections[key];
          if (items.length === 0) return null;
          return (
            <div key={key}>
              <div style={styles.sectionDivider}>
                <span
                  style={{
                    ...styles.sectionLabel,
                    color: key === "overdue" ? OVERDUE_COLOR : key === "today" ? TODAY_COLOR : "#A69C86",
                  }}
                >
                  {SECTION_LABELS[key]}
                </span>
                <span style={styles.sectionCount}>{items.length}</span>
              </div>

              {items.map((t, i) => {
                const contextMeta = contexts.find((c) => c.id === t.contextId);
                const project = projects.find((p) => p.id === t.projectId);
                return (
                  <TaskCard
                    key={t.id}
                    task={t}
                    contextMeta={contextMeta}
                    projectName={project?.name}
                    showContextTag={activeCtx === "all"}
                    isTopUrgent={key === "overdue" && i === 0}
                    onToggleDone={toggleDone}
                    onRemove={removeTask}
                    onSaveText={saveText}
                    onSetReminder={setReminder}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {!showForm ? (
        <button style={styles.addBtn} onClick={() => setShowForm(true)}>
          <Plus size={15} strokeWidth={2.5} /> Записать задачу
        </button>
      ) : (
        <TaskForm
          draft={draft}
          setDraft={setDraft}
          contexts={contexts}
          projectsForContext={formProjects}
          showContextSelect={activeCtx === "all"}
          onCancel={() => setShowForm(false)}
          onSave={handleAddTask}
        />
      )}

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

function ReadoutStat({ label, value, color }) {
  return (
    <div style={styles.readoutStat}>
      <div style={{ ...styles.readoutValue, color }}>{value}</div>
      <div style={styles.readoutLabel}>{label}</div>
    </div>
  );
}
