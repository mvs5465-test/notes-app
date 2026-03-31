const bodyElement = document.body;
const editorPanel = document.querySelector("[data-editor-panel]");
const backButton = document.querySelector("[data-back-button]");
const themeToggle = document.querySelector("[data-theme-toggle]");
const themeLabel = document.querySelector("[data-theme-label]");
const searchInput = document.querySelector("[data-note-search]");
const notesList = document.querySelector("[data-notes-list]");
const emptyNotes = document.querySelector("[data-empty-notes]");
const newNoteButtons = Array.from(document.querySelectorAll("[data-new-note]"));
const deleteButton = document.querySelector("[data-delete-note]");
const noteForm = document.getElementById("note-form");
const hiddenBodyInput = document.getElementById("body-input");
const activeNoteIdInput = document.getElementById("active-note-id");
const editorTitle = document.querySelector("[data-editor-title]");
const editorMeta = document.querySelector("[data-editor-meta]");
const emptySearchMessage = document.querySelector("[data-empty-search]");
const trixEditorElement = document.querySelector("trix-editor");
const saveStatus = document.querySelector("[data-save-status]");
const saveNowButton = document.querySelector("[data-save-now]");

let currentNoteId = bodyElement.dataset.selectedNoteId || "";
let notes = [];
let currentNote = null;
let saveTimer = null;
let lastSavedBody = hiddenBodyInput.value || "";
let suppressAutosave = false;
let isSaving = false;

function snippetFromBody(body) {
  return body.replace(/\s+/g, " ").trim().slice(0, 140);
}

function noteTitleFromBody(body) {
  const firstLine = body
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine || "New note";
}

function plainTextToTrixHtml(text) {
  return text
    .split("\n")
    .map((line) => {
      const div = document.createElement("div");
      div.textContent = line;
      return div.outerHTML;
    })
    .join("") || "<div></div>";
}

function setEditorBody(text) {
  suppressAutosave = true;
  hiddenBodyInput.value = text;
  trixEditorElement.editor.loadHTML(plainTextToTrixHtml(text));
  lastSavedBody = text;
  queueMicrotask(() => {
    suppressAutosave = false;
  });
}

function updateEditorMeta(note) {
  editorTitle.textContent = note ? note.title : "New note";
  editorMeta.textContent = note
    ? `Updated ${note.updated_at}`
    : "Create a note with the first line as the title.";
}

function setSaveStatus(text, state = "") {
  saveStatus.textContent = text;
  saveStatus.classList.toggle("is-saving", state === "saving");
  saveStatus.classList.toggle("is-error", state === "error");
}

function renderNotes() {
  const query = searchInput.value.trim().toLowerCase();
  const filteredNotes = notes.filter((note) => {
    const haystack = `${note.title} ${note.snippet || ""}`.toLowerCase();
    return !query || haystack.includes(query);
  });

  notesList.innerHTML = "";

  filteredNotes.forEach((note) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "note-link";
    if (String(note.id) === currentNoteId) {
      button.classList.add("is-active");
    }
    button.dataset.noteId = String(note.id);

    const title = document.createElement("span");
    title.className = "note-link-title";
    title.textContent = note.title;

    const snippet = document.createElement("span");
    snippet.className = "note-link-snippet";
    snippet.textContent = note.snippet || "";

    const updated = document.createElement("span");
    updated.className = "note-link-updated";
    updated.textContent = note.updated_at;

    button.append(title, snippet, updated);
    button.addEventListener("click", () => {
      loadNote(note.id);
    });

    item.append(button);
    notesList.append(item);
  });

  emptyNotes.hidden = notes.length !== 0;
  emptySearchMessage.hidden = !(notes.length !== 0 && filteredNotes.length === 0);
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || "Request failed.");
  }
  return data;
}

async function refreshNotes() {
  notes = await apiFetch("/api/notes");
  renderNotes();
}

async function loadNote(noteId, { openEditor = true } = {}) {
  const note = await apiFetch(`/api/notes/${noteId}`);
  currentNoteId = String(note.id);
  activeNoteIdInput.value = currentNoteId;
  currentNote = note;
  deleteButton.hidden = false;
  setEditorBody(note.body);
  updateEditorMeta(note);
  setSaveStatus("Saved");
  renderNotes();

  if (openEditor) {
    bodyElement.classList.add("editor-open");
  }
}

function resetEditor() {
  currentNoteId = "";
  activeNoteIdInput.value = "";
  currentNote = null;
  deleteButton.hidden = true;
  clearTimeout(saveTimer);
  saveTimer = null;
  setEditorBody("");
  updateEditorMeta(null);
  setSaveStatus("Saved");
  renderNotes();
}

async function createNewNote() {
  setSaveStatus("Saving...", "saving");
  const note = await apiFetch("/api/notes", {
    method: "POST",
    body: JSON.stringify({ body: "" }),
  });
  await refreshNotes();
  await loadNote(note.id);
}

function syncDraftUI() {
  const plainText = trixEditorElement.editor.getDocument().toString();
  hiddenBodyInput.value = plainText;
  if (currentNote) {
    editorTitle.textContent = noteTitleFromBody(plainText);
  } else {
    editorTitle.textContent = noteTitleFromBody(plainText);
  }
}

async function saveCurrentNote() {
  if (!currentNoteId || isSaving) {
    return;
  }

  const body = trixEditorElement.editor.getDocument().toString();
  if (body === lastSavedBody) {
    setSaveStatus("Saved");
    return;
  }

  isSaving = true;
  setSaveStatus("Saving...", "saving");

  try {
    const note = await apiFetch(`/api/notes/${currentNoteId}`, {
      method: "PUT",
      body: JSON.stringify({ body }),
    });
    currentNote = note;
    lastSavedBody = note.body;
    updateEditorMeta(note);
    const summaryIndex = notes.findIndex((item) => String(item.id) === String(note.id));
    if (summaryIndex >= 0) {
      notes[summaryIndex] = {
        ...notes[summaryIndex],
        title: note.title,
        snippet: snippetFromBody(note.body),
        updated_at: note.updated_at,
      };
    }
    notes.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id);
    renderNotes();
    setSaveStatus("Saved");
  } catch (error) {
    setSaveStatus(error.message || "Save failed", "error");
  } finally {
    isSaving = false;
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveCurrentNote();
  }, 1500);
  setSaveStatus("Saving...", "saving");
}

function applySearch() {
  renderNotes();
}

function applyTheme(theme) {
  const resolved = theme === "dark" ? "dark" : "light";
  bodyElement.classList.toggle("dark", resolved === "dark");
  localStorage.setItem("notes-app-theme", resolved);
  themeLabel.textContent = resolved === "dark" ? "Light" : "Dark";
}

document.addEventListener("trix-change", () => {
  if (suppressAutosave) {
    return;
  }
  syncDraftUI();
  scheduleSave();
});

newNoteButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    await createNewNote();
  });
});

backButton.addEventListener("click", () => {
  bodyElement.classList.remove("editor-open");
});

themeToggle.addEventListener("click", () => {
  applyTheme(bodyElement.classList.contains("dark") ? "light" : "dark");
});

searchInput.addEventListener("input", applySearch);

deleteButton.addEventListener("click", async () => {
  if (!currentNoteId) {
    return;
  }

  if (window.confirm("Delete this note?")) {
    await apiFetch(`/api/notes/${currentNoteId}`, {
      method: "DELETE",
    });
    await refreshNotes();
    resetEditor();
    if (window.innerWidth < 768) {
      bodyElement.classList.remove("editor-open");
    }
  }
});

noteForm.addEventListener("submit", (event) => {
  event.preventDefault();
});

saveNowButton.addEventListener("click", async () => {
  clearTimeout(saveTimer);
  await saveCurrentNote();
});

const savedTheme = localStorage.getItem("notes-app-theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
applyTheme(savedTheme || (prefersDark ? "dark" : "light"));

if (window.innerWidth >= 768) {
  bodyElement.classList.add("editor-open");
}

editorPanel.hidden = false;

async function init() {
  try {
    await refreshNotes();
    if (currentNoteId) {
      await loadNote(currentNoteId, { openEditor: true });
    } else if (window.innerWidth >= 768 && notes.length > 0) {
      await loadNote(notes[0].id, { openEditor: true });
    } else {
      resetEditor();
      if (window.innerWidth < 768) {
        bodyElement.classList.remove("editor-open");
      }
    }
  } catch (error) {
    setSaveStatus(error.message || "Failed to load", "error");
  }
}

init();
