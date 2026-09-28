import fs from "node:fs";
import type { ScanResultType } from "./types.js";
import { stat } from "node:fs/promises";
import path from "node:path";

export const MIN_SIZE = 200 * 1024 * 1024;

async function getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    const dirs = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const dir of dirs) {
        const fullPath = path.join(dirPath, dir.name);

        if (dir.isSymbolicLink()) {
            continue;
        }

        if (dir.isFile()) {
            const fileStats = await stat(fullPath);
            totalSize += fileStats.size;
        } else if (dir.isDirectory()) {
            totalSize += await getDirectorySize(fullPath);
        }
    }

    return totalSize;
}

export async function scanDirectory(
    rootPath: string,
    minSize: number = MIN_SIZE,
): Promise<ScanResultType[]> {
    const rootStats = await stat(rootPath);
    if (!rootStats.isDirectory()) {
        throw new Error("Path is not a directory!");
    }

    const dirs = await fs.promises.readdir(rootPath, { withFileTypes: true });

    const results: ScanResultType[] = [];
    for (const dir of dirs) {
        if (!dir.isDirectory()) {
            continue;
        }

        const dirPath = path.join(rootPath, dir.name);
        const dirSize = await getDirectorySize(dirPath);
        if (dirSize >= minSize) {
            results.push({ path: dirPath, size: dirSize });
        }
    }
    return results;
}
