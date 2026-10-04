// 檔案式儲存：data/ 下 per-user JSON（gitignore，部署時 untracked 保留）
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "data");

// sub 形如 usr_XXXX；保守清洗避免路徑跳脫
function safeSeg(seg: string): string {
  return seg.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
}

export function newId(): string {
  return crypto.randomBytes(8).toString("hex");
}

export function bookDir(sub: string): string {
  return path.join(DATA_DIR, "books", safeSeg(sub));
}

export function vocabPath(sub: string): string {
  return path.join(DATA_DIR, "vocab", safeSeg(sub) + ".json");
}

export async function readJson<T>(target: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(target, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonAtomic(target: string, obj: unknown): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = target + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(obj), "utf8");
  await fs.rename(tmp, target);
}

export async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

export async function removeFile(target: string): Promise<boolean> {
  try {
    await fs.unlink(target);
    return true;
  } catch {
    return false;
  }
}
