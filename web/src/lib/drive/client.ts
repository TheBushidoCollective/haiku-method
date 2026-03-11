import { google } from "googleapis";
import { Readable } from "stream";
import type { DriveFile } from "./types";
import {
  DriveNotFoundError,
  DrivePermissionError,
  DriveQuotaError,
} from "./types";

const FOLDER_MIME = "application/vnd.google-apps.folder";

function wrapDriveError(err: unknown): never {
  if (err instanceof Error && "code" in err) {
    const code = (err as { code: number }).code;
    if (code === 404) throw new DriveNotFoundError(err.message);
    if (code === 403) {
      if (err.message.includes("quota") || err.message.includes("rate")) {
        throw new DriveQuotaError(err.message);
      }
      throw new DrivePermissionError(err.message);
    }
  }
  throw err;
}

function getDrive(token: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: token });
  return google.drive({ version: "v3", auth: oauth2Client });
}

export class DriveClient {
  static async createFolder(
    token: string,
    name: string,
    parentId?: string
  ): Promise<string> {
    const drive = getDrive(token);
    try {
      const res = await drive.files.create({
        requestBody: {
          name,
          mimeType: FOLDER_MIME,
          parents: parentId ? [parentId] : undefined,
        },
        fields: "id",
        supportsAllDrives: true,
      });
      return res.data.id!;
    } catch (err) {
      wrapDriveError(err);
    }
  }

  static async listFolder(token: string, folderId: string): Promise<DriveFile[]> {
    const drive = getDrive(token);
    try {
      const files: DriveFile[] = [];
      let pageToken: string | undefined;
      do {
        const res = await drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          fields: "nextPageToken, files(id, name, mimeType, modifiedTime)",
          pageToken,
          pageSize: 1000,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        for (const f of res.data.files ?? []) {
          files.push({
            id: f.id!,
            name: f.name!,
            mimeType: f.mimeType!,
            modifiedTime: f.modifiedTime!,
          });
        }
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
      return files;
    } catch (err) {
      wrapDriveError(err);
    }
  }

  static async findFolder(
    token: string,
    name: string,
    parentId: string
  ): Promise<string | null> {
    const drive = getDrive(token);
    try {
      const res = await drive.files.list({
        q: `'${parentId}' in parents and name = '${name}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
        fields: "files(id)",
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      return res.data.files?.[0]?.id ?? null;
    } catch (err) {
      wrapDriveError(err);
    }
  }

  static async createFile(
    token: string,
    name: string,
    content: string,
    mimeType: string,
    parentId?: string
  ): Promise<string> {
    const drive = getDrive(token);
    try {
      const res = await drive.files.create({
        requestBody: {
          name,
          mimeType,
          parents: parentId ? [parentId] : undefined,
        },
        media: {
          mimeType,
          body: Readable.from(content),
        },
        fields: "id",
        supportsAllDrives: true,
      });
      return res.data.id!;
    } catch (err) {
      wrapDriveError(err);
    }
  }

  static async readFile(token: string, fileId: string): Promise<string> {
    const drive = getDrive(token);
    try {
      const res = await drive.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "text" }
      );
      return res.data as string;
    } catch (err) {
      wrapDriveError(err);
    }
  }

  static async updateFile(
    token: string,
    fileId: string,
    content: string
  ): Promise<void> {
    const drive = getDrive(token);
    try {
      await drive.files.update({
        fileId,
        media: {
          mimeType: "text/plain",
          body: Readable.from(content),
        },
        supportsAllDrives: true,
      });
    } catch (err) {
      wrapDriveError(err);
    }
  }

  static async findFile(
    token: string,
    name: string,
    parentId: string
  ): Promise<string | null> {
    const drive = getDrive(token);
    try {
      const res = await drive.files.list({
        q: `'${parentId}' in parents and name = '${name}' and mimeType != '${FOLDER_MIME}' and trashed = false`,
        fields: "files(id)",
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      return res.data.files?.[0]?.id ?? null;
    } catch (err) {
      wrapDriveError(err);
    }
  }

  static async deleteFile(token: string, fileId: string): Promise<void> {
    const drive = getDrive(token);
    try {
      await drive.files.delete({ fileId, supportsAllDrives: true });
    } catch (err) {
      wrapDriveError(err);
    }
  }
}
