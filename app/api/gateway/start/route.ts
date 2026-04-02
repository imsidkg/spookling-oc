import { NextResponse } from "next/server";
import { exec } from "child_process";

export async function POST() {
  try {
    // Start openclaw gateway in background
    exec("bunx openclaw@latest gateway --port 18789 --allow-unconfigured --force", {
      env: { ...process.env },
      timeout: 10000,
    });

    return NextResponse.json({
      success: true,
      message: "Gateway start command issued",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error starting gateway";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
