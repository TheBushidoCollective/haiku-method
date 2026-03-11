import { DriveClient } from "./client";
import type { WorkspaceInfo } from "./types";

const DEFAULT_SETTINGS = `# HAIKU Workspace Settings
version: 1
`;

export async function provisionWorkspace(
  token: string,
  name: string,
  parentId?: string
): Promise<WorkspaceInfo> {
  // Check if root folder already exists
  let folderId: string | null = null;
  if (parentId) {
    folderId = await DriveClient.findFolder(token, name, parentId);
  }

  // Create root folder if it doesn't exist
  if (!folderId) {
    folderId = await DriveClient.createFolder(token, name, parentId);
  }

  // Create memory/ subfolder (idempotent)
  let memoryFolderId = await DriveClient.findFolder(token, "memory", folderId);
  if (!memoryFolderId) {
    memoryFolderId = await DriveClient.createFolder(token, "memory", folderId);
  }

  // Create settings.yml (idempotent)
  let settingsFileId = await DriveClient.findFile(
    token,
    "settings.yml",
    folderId
  );
  if (!settingsFileId) {
    settingsFileId = await DriveClient.createFile(
      token,
      "settings.yml",
      DEFAULT_SETTINGS,
      "text/plain",
      folderId
    );
  }

  return {
    folderId,
    memoryFolderId,
    settingsFileId,
    memoryFiles: [],
  };
}

export async function readMemory(
  token: string,
  workspaceFolderId: string,
  name: string
): Promise<string | null> {
  const memoryFolderId = await DriveClient.findFolder(
    token,
    "memory",
    workspaceFolderId
  );
  if (!memoryFolderId) return null;

  const fileId = await DriveClient.findFile(token, name, memoryFolderId);
  if (!fileId) return null;

  return DriveClient.readFile(token, fileId);
}

export async function writeMemory(
  token: string,
  workspaceFolderId: string,
  name: string,
  content: string,
  mode: "overwrite" | "append"
): Promise<void> {
  // Ensure memory/ folder exists
  let memoryFolderId = await DriveClient.findFolder(
    token,
    "memory",
    workspaceFolderId
  );
  if (!memoryFolderId) {
    memoryFolderId = await DriveClient.createFolder(
      token,
      "memory",
      workspaceFolderId
    );
  }

  const fileId = await DriveClient.findFile(token, name, memoryFolderId);

  if (fileId) {
    if (mode === "append") {
      const existing = await DriveClient.readFile(token, fileId);
      await DriveClient.updateFile(token, fileId, existing + "\n" + content);
    } else {
      await DriveClient.updateFile(token, fileId, content);
    }
  } else {
    await DriveClient.createFile(
      token,
      name,
      content,
      "text/plain",
      memoryFolderId
    );
  }
}

export async function listMemory(
  token: string,
  workspaceFolderId: string
): Promise<string[]> {
  const memoryFolderId = await DriveClient.findFolder(
    token,
    "memory",
    workspaceFolderId
  );
  if (!memoryFolderId) return [];

  const files = await DriveClient.listFolder(token, memoryFolderId);
  return files.map((f) => f.name);
}

export async function deleteMemory(
  token: string,
  workspaceFolderId: string,
  name: string
): Promise<boolean> {
  const memoryFolderId = await DriveClient.findFolder(
    token,
    "memory",
    workspaceFolderId
  );
  if (!memoryFolderId) return false;

  const fileId = await DriveClient.findFile(token, name, memoryFolderId);
  if (!fileId) return false;

  await DriveClient.deleteFile(token, fileId);
  return true;
}

// --- Intent helpers ---

async function ensureIntentsFolder(
  token: string,
  workspaceFolderId: string
): Promise<string> {
  let folderId = await DriveClient.findFolder(
    token,
    "intents",
    workspaceFolderId
  );
  if (!folderId) {
    folderId = await DriveClient.createFolder(token, "intents", workspaceFolderId);
  }
  return folderId;
}

export async function createIntent(
  token: string,
  workspaceFolderId: string,
  intentSlug: string,
  content: string
): Promise<void> {
  const intentsId = await ensureIntentsFolder(token, workspaceFolderId);
  let slugFolderId = await DriveClient.findFolder(token, intentSlug, intentsId);
  if (!slugFolderId) {
    slugFolderId = await DriveClient.createFolder(token, intentSlug, intentsId);
  }
  await DriveClient.createFile(token, "intent.md", content, "text/plain", slugFolderId);
}

export async function readIntent(
  token: string,
  workspaceFolderId: string,
  intentSlug: string
): Promise<string | null> {
  const intentsId = await DriveClient.findFolder(token, "intents", workspaceFolderId);
  if (!intentsId) return null;

  const slugFolderId = await DriveClient.findFolder(token, intentSlug, intentsId);
  if (!slugFolderId) return null;

  const fileId = await DriveClient.findFile(token, "intent.md", slugFolderId);
  if (!fileId) return null;

  return DriveClient.readFile(token, fileId);
}

export async function writeIntent(
  token: string,
  workspaceFolderId: string,
  intentSlug: string,
  content: string
): Promise<void> {
  const intentsId = await DriveClient.findFolder(token, "intents", workspaceFolderId);
  if (!intentsId) throw new Error(`Intents folder not found.`);

  const slugFolderId = await DriveClient.findFolder(token, intentSlug, intentsId);
  if (!slugFolderId) throw new Error(`Intent "${intentSlug}" not found.`);

  const fileId = await DriveClient.findFile(token, "intent.md", slugFolderId);
  if (!fileId) throw new Error(`intent.md not found in "${intentSlug}".`);

  await DriveClient.updateFile(token, fileId, content);
}

export async function listIntents(
  token: string,
  workspaceFolderId: string
): Promise<string[]> {
  const intentsId = await DriveClient.findFolder(token, "intents", workspaceFolderId);
  if (!intentsId) return [];

  const items = await DriveClient.listFolder(token, intentsId);
  return items
    .filter((f) => f.mimeType === "application/vnd.google-apps.folder")
    .map((f) => f.name);
}

export async function deleteIntent(
  token: string,
  workspaceFolderId: string,
  intentSlug: string
): Promise<boolean> {
  const intentsId = await DriveClient.findFolder(token, "intents", workspaceFolderId);
  if (!intentsId) return false;

  const slugFolderId = await DriveClient.findFolder(token, intentSlug, intentsId);
  if (!slugFolderId) return false;

  await DriveClient.deleteFile(token, slugFolderId);
  return true;
}

// --- Unit helpers ---

export async function createUnit(
  token: string,
  workspaceFolderId: string,
  intentSlug: string,
  unitName: string,
  content: string
): Promise<void> {
  const intentsId = await DriveClient.findFolder(token, "intents", workspaceFolderId);
  if (!intentsId) throw new Error(`Intents folder not found.`);

  const slugFolderId = await DriveClient.findFolder(token, intentSlug, intentsId);
  if (!slugFolderId) throw new Error(`Intent "${intentSlug}" not found.`);

  await DriveClient.createFile(token, unitName, content, "text/plain", slugFolderId);
}

export async function readUnit(
  token: string,
  workspaceFolderId: string,
  intentSlug: string,
  unitName: string
): Promise<string | null> {
  const intentsId = await DriveClient.findFolder(token, "intents", workspaceFolderId);
  if (!intentsId) return null;

  const slugFolderId = await DriveClient.findFolder(token, intentSlug, intentsId);
  if (!slugFolderId) return null;

  const fileId = await DriveClient.findFile(token, unitName, slugFolderId);
  if (!fileId) return null;

  return DriveClient.readFile(token, fileId);
}

export async function writeUnit(
  token: string,
  workspaceFolderId: string,
  intentSlug: string,
  unitName: string,
  content: string
): Promise<void> {
  const intentsId = await DriveClient.findFolder(token, "intents", workspaceFolderId);
  if (!intentsId) throw new Error(`Intents folder not found.`);

  const slugFolderId = await DriveClient.findFolder(token, intentSlug, intentsId);
  if (!slugFolderId) throw new Error(`Intent "${intentSlug}" not found.`);

  const fileId = await DriveClient.findFile(token, unitName, slugFolderId);
  if (!fileId) throw new Error(`Unit "${unitName}" not found in "${intentSlug}".`);

  await DriveClient.updateFile(token, fileId, content);
}

export async function listUnits(
  token: string,
  workspaceFolderId: string,
  intentSlug: string
): Promise<string[]> {
  const intentsId = await DriveClient.findFolder(token, "intents", workspaceFolderId);
  if (!intentsId) return [];

  const slugFolderId = await DriveClient.findFolder(token, intentSlug, intentsId);
  if (!slugFolderId) return [];

  const items = await DriveClient.listFolder(token, slugFolderId);
  return items
    .filter((f) => f.mimeType !== "application/vnd.google-apps.folder")
    .map((f) => f.name);
}

export async function deleteUnit(
  token: string,
  workspaceFolderId: string,
  intentSlug: string,
  unitName: string
): Promise<boolean> {
  const intentsId = await DriveClient.findFolder(token, "intents", workspaceFolderId);
  if (!intentsId) return false;

  const slugFolderId = await DriveClient.findFolder(token, intentSlug, intentsId);
  if (!slugFolderId) return false;

  const fileId = await DriveClient.findFile(token, unitName, slugFolderId);
  if (!fileId) return false;

  await DriveClient.deleteFile(token, fileId);
  return true;
}

export async function readSettings(
  token: string,
  workspaceFolderId: string
): Promise<string | null> {
  const fileId = await DriveClient.findFile(
    token,
    "settings.yml",
    workspaceFolderId
  );
  if (!fileId) return null;

  return DriveClient.readFile(token, fileId);
}

export async function writeSettings(
  token: string,
  workspaceFolderId: string,
  content: string
): Promise<void> {
  const fileId = await DriveClient.findFile(
    token,
    "settings.yml",
    workspaceFolderId
  );
  if (fileId) {
    await DriveClient.updateFile(token, fileId, content);
  } else {
    await DriveClient.createFile(
      token,
      "settings.yml",
      content,
      "text/plain",
      workspaceFolderId
    );
  }
}

export async function getWorkspaceInfo(
  token: string,
  workspaceFolderId: string
): Promise<WorkspaceInfo> {
  const memoryFolderId = await DriveClient.findFolder(
    token,
    "memory",
    workspaceFolderId
  );

  const settingsFileId = await DriveClient.findFile(
    token,
    "settings.yml",
    workspaceFolderId
  );

  let memoryFiles: string[] = [];
  if (memoryFolderId) {
    const files = await DriveClient.listFolder(token, memoryFolderId);
    memoryFiles = files.map((f) => f.name);
  }

  return {
    folderId: workspaceFolderId,
    memoryFolderId,
    settingsFileId,
    memoryFiles,
  };
}
