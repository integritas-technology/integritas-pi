import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";

export type FileItem = {
  name: string;
  type: "file" | "directory" | "other";
  size?: number;
};

export async function listFiles(requestedPath: string) {
  const safePath = requestedPath.startsWith("/") ? requestedPath : `/${requestedPath}`;
  const relativePath = safePath.replace(/^\/+/, "");
  const absolutePath = path.resolve(env.hostFilesRoot, relativePath);

  if (absolutePath !== env.hostFilesRoot && !absolutePath.startsWith(`${env.hostFilesRoot}${path.sep}`)) {
    const error = new Error("Path is outside the allowed directory") as NodeJS.ErrnoException;
    error.code = "OUTSIDE_ROOT";
    throw error;
  }

  const rootRealPath = await fs.realpath(env.hostFilesRoot);
  const targetRealPath = await fs.realpath(absolutePath);

  if (targetRealPath !== rootRealPath && !targetRealPath.startsWith(`${rootRealPath}${path.sep}`)) {
    const error = new Error("Path is outside the allowed directory") as NodeJS.ErrnoException;
    error.code = "OUTSIDE_ROOT";
    throw error;
  }

  const stat = await fs.stat(targetRealPath);
  if (!stat.isDirectory()) {
    const error = new Error("Path must be a directory") as NodeJS.ErrnoException;
    error.code = "NOT_DIRECTORY";
    throw error;
  }

  const entries = await fs.readdir(targetRealPath, { withFileTypes: true });
  const items: FileItem[] = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(targetRealPath, entry.name);
    const item: FileItem = { name: entry.name, type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other" };

    if (entry.isFile()) {
      const entryStat = await fs.lstat(entryPath);
      item.size = entryStat.size;
    }

    return item;
  }));

  items.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    if (a.type === "directory") return -1;
    if (b.type === "directory") return 1;
    return a.type.localeCompare(b.type);
  });

  return { path: safePath === "/" ? "/" : `/${relativePath}`, items };
}
