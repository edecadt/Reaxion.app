import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

const APK_PATH = "/shared-apk/client.apk";

export async function GET() {
  try {
    if (!existsSync(APK_PATH)) {
      return new NextResponse(
        "APK not found. Please build the mobile app first.",
        {
          status: 404,
          headers: {
            "Content-Type": "text/plain",
          },
        },
      );
    }

    const apkBuffer = await readFile(APK_PATH);

    return new NextResponse(new Uint8Array(apkBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": 'attachment; filename="client.apk"',
        "Content-Length": apkBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error serving APK:", error);
    return new NextResponse("Internal Server Error", {
      status: 500,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }
}
