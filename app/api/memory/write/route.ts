import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const WORKSPACE_DIR = join(homedir(), ".openclaw", "workspace");

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { filename, content } = body;

    if (!filename || typeof content !== "string") {
      return NextResponse.json(
        { error: "filename and content are required" },
        { status: 400 }
      );
    }

    // Validate filename to prevent path traversal
    if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
      return NextResponse.json(
        { error: "Invalid filename" },
        { status: 400 }
      );
    }

    // Ensure workspace directory exists
    await mkdir(WORKSPACE_DIR, { recursive: true });

    const filePath = join(WORKSPACE_DIR, filename);
    await writeFile(filePath, content, "utf-8");

    return NextResponse.json({
      success: true,
      path: filePath,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to write file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
