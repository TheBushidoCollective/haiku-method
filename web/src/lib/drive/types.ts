export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

export interface WorkspaceInfo {
  folderId: string;
  memoryFolderId: string | null;
  settingsFileId: string | null;
  memoryFiles: string[];
}

export class DriveNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DriveNotFoundError";
  }
}

export class DrivePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrivePermissionError";
  }
}

export class DriveQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DriveQuotaError";
  }
}
