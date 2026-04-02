import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST() {
  try {
    // Try openclaw gateway stop first
    try {
      await execAsync("bunx openclaw@latest gateway stop", { timeout: 5000 });
    } catch {
      // If openclaw command fails, try to kill the process on the port
      try {
        const { stdout } = await execAsync(
          "lsof -i :18789 -t 2>/dev/null || echo ''"
        );
        const pid = stdout.trim();
        if (pid) {
          await execAsync(`kill ${pid}`);
        }
      } catch {
        // Best effort
      }
    }

    return NextResponse.json({
      success: true,
      message: "Gateway stop command issued",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error stopping gateway";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
