import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const execAsync = promisify(exec);
const WORKSPACE_DIR = join(homedir(), "clawd");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 }
    );
  }

  try {
    // Try using openclaw memory search CLI first
    try {
      const { stdout } = await execAsync(
        `bunx openclaw@latest memory search "${query.replace(/"/g, '\\"')}"`,
        { timeout: 15000 }
      );

      const results = stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line, i) => ({
          file: "memory",
          line: i + 1,
          content: line,
          context: line,
        }));

      return NextResponse.json({ results, source: "openclaw-cli" });
    } catch {
      // Fall back to local grep-style search
    }

    // Fallback: search workspace files directly
    const entries = await readdir(WORKSPACE_DIR).catch(() => []);
    const results: Array<{
      file: string;
      line: number;
      content: string;
      context: string;
    }> = [];

    const queryLower = query.toLowerCase();

    for (const name of entries) {
      if (!name.endsWith(".md")) continue;
      try {
        const content = await readFile(join(WORKSPACE_DIR, name), "utf-8");
        const lines = content.split("\n");
        lines.forEach((line, idx) => {
          if (line.toLowerCase().includes(queryLower)) {
            const contextStart = Math.max(0, idx - 1);
            const contextEnd = Math.min(lines.length, idx + 2);
            results.push({
              file: name,
              line: idx + 1,
              content: line.trim(),
              context: lines.slice(contextStart, contextEnd).join("\n"),
            });
          }
        });
      } catch {
        // Skip unreadable files
      }
    }

    return NextResponse.json({ results, source: "local-search" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message, results: [] }, { status: 200 });
  }
}
