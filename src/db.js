import { openDB } from "idb";

const DB_NAME = "task-planner";
const DB_VERSION = 1;

const nowISO = () => new Date().toISOString();
const uuid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const DEFAULT_CONTEXTS = [
  { id: "gazprom", name: "Газпром", color: "#8B9D7A", sortOrder: 0 },
  { id: "freelance", name: "Фриланс", color: "#7B92B3", sortOrder: 1 },
  { id: "personal", name: "Личное", color: "#B97C8C", sortOrder: 2 },
];

const DEFAULT_PROJECTS = [
  { id: "proj-football-lab", contextId: "freelance", name: "Football Lab" },
  { id: "proj-ot-navigator", contextId: "freelance", name: "ОТ Навигатор" },
];

let dbPromise;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("contexts")) {
          db.createObjectStore("contexts", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("projects")) {
          const store = db.createObjectStore("projects", { keyPath: "id" });
          store.createIndex("contextId", "contextId");
        }
        if (!db.objectStoreNames.contains("tasks")) {
          const store = db.createObjectStore("tasks", { keyPath: "id" });
          store.createIndex("contextId", "contextId");
          store.createIndex("projectId", "projectId");
        }
      },
    });
  }
  return dbPromise;
}

export async function seedIfEmpty() {
  const db = await getDB();
  const contextCount = await db.count("contexts");
  if (contextCount === 0) {
    const tx = db.transaction("contexts", "readwrite");
    await Promise.all(DEFAULT_CONTEXTS.map((c) => tx.store.put(c)));
    await tx.done;
  }
  const projectCount = await db.count("projects");
  if (projectCount === 0) {
    const tx = db.transaction("projects", "readwrite");
    await Promise.all(
      DEFAULT_PROJECTS.map((p) =>
        tx.store.put({ ...p, createdAt: nowISO() })
      )
    );
    await tx.done;
  }
}

export async function getAllContexts() {
  const db = await getDB();
  const contexts = await db.getAll("contexts");
  return contexts.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getAllProjects() {
  const db = await getDB();
  return db.getAll("projects");
}

export async function addProject(contextId, name) {
  const db = await getDB();
  const project = {
    id: uuid(),
    contextId,
    name: name.trim(),
    createdAt: nowISO(),
  };
  await db.put("projects", project);
  return project;
}

export async function getAllTasks() {
  const db = await getDB();
  return db.getAll("tasks");
}

export async function addTask(task) {
  const db = await getDB();
  const record = {
    id: uuid(),
    contextId: task.contextId ?? null,
    projectId: task.projectId ?? null,
    text: task.text,
    priority: task.priority ?? "med",
    deadline: task.deadline ?? null,
    durationMinutes: task.durationMinutes ?? null,
    reminderAt: task.reminderAt ?? null,
    done: false,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  await db.put("tasks", record);
  return record;
}

export async function updateTask(id, patch) {
  const db = await getDB();
  const existing = await db.get("tasks", id);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: nowISO() };
  await db.put("tasks", updated);
  return updated;
}

export async function deleteTask(id) {
  const db = await getDB();
  await db.delete("tasks", id);
}

export async function exportAll() {
  const db = await getDB();
  const [contexts, projects, tasks] = await Promise.all([
    db.getAll("contexts"),
    db.getAll("projects"),
    db.getAll("tasks"),
  ]);
  return {
    dbName: DB_NAME,
    version: DB_VERSION,
    exportedAt: nowISO(),
    contexts,
    projects,
    tasks,
  };
}

export async function importAll(data) {
  if (!data || !Array.isArray(data.tasks)) {
    throw new Error("Некорректный файл резервной копии");
  }
  const db = await getDB();
  const tx = db.transaction(["contexts", "projects", "tasks"], "readwrite");
  await Promise.all([
    tx.objectStore("contexts").clear(),
    tx.objectStore("projects").clear(),
    tx.objectStore("tasks").clear(),
  ]);
  await Promise.all([
    ...(data.contexts || []).map((c) => tx.objectStore("contexts").put(c)),
    ...(data.projects || []).map((p) => tx.objectStore("projects").put(p)),
    ...(data.tasks || []).map((t) => tx.objectStore("tasks").put(t)),
  ]);
  await tx.done;
}
