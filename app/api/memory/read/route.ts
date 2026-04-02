import { NextResponse } from "next/server";
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const WORKSPACE_DIR = join(homedir(), "clawd");

export async function GET() {
  try {
    const entries = await readdir(WORKSPACE_DIR).catch(() => []);

    const files = await Promise.all(
      entries
        .filter((name) => name.endsWith(".md"))
        .map(async (name) => {
          const filePath = join(WORKSPACE_DIR, name);
          try {
            const [content, fileStat] = await Promise.all([
              readFile(filePath, "utf-8"),
              stat(filePath),
            ]);
            return {
              name,
              path: filePath,
              content,
              lastModified: fileStat.mtime.toISOString(),
              size: fileStat.size,
            };
          } catch {
            return null;
          }
        })
    );

    // Priority order for sorting: core identity files first, then by date
    const priority = ["SOUL.md", "IDENTITY.md", "HEARTBEAT.md", "AGENTS.md", "USER.md", "TOOLS.md", "BOOTSTRAP.md"];
    const validFiles = files
      .filter(Boolean)
      .sort((a, b) => {
        const aIdx = priority.indexOf(a!.name);
        const bIdx = priority.indexOf(b!.name);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return b!.lastModified.localeCompare(a!.lastModified);
      });

    return NextResponse.json({
      files: validFiles,
      workspacePath: WORKSPACE_DIR,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read workspace";
    return NextResponse.json(
      {
        files: [],
        error: message,
        workspacePath: WORKSPACE_DIR,
      },
      { status: 200 } // Return 200 with empty files so UI handles gracefully
    );
  }
}
