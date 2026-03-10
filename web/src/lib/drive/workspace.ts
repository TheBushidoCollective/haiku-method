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
