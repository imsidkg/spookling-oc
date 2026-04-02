import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function GET() {
  try {
    // Check if anything is listening on port 18789
    const { stdout } = await execAsync(
      "ss -tlnp 2>/dev/null | grep 18789 || lsof -i :18789 -t 2>/dev/null || echo ''"
    );

    const isRunning = stdout.trim().length > 0;

    if (isRunning) {
      // Try to get PID
      let pid: string | null = null;
      try {
        const pidResult = await execAsync(
          "lsof -i :18789 -t 2>/dev/null || ss -tlnp 2>/dev/null | grep 18789 | grep -oP 'pid=\\K[0-9]+' || echo ''"
        );
        pid = pidResult.stdout.trim().split("\n")[0] || null;
      } catch {
        // PID detection is optional
      }

      return NextResponse.json({
        status: "online",
        pid,
        port: 18789,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      status: "offline",
      port: 18789,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      status: "offline",
      port: 18789,
      timestamp: new Date().toISOString(),
    });
  }
}
