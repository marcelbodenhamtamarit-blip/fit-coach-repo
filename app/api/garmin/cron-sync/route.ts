import { NextRequest, NextResponse } from "next/server"
import { runGarminSync } from "@/lib/garmin-sync"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

const result = await runGarminSync()

if (!result.ok) {
  return NextResponse.json({ error: result.error, message: result.message }, { status: result.status })
}

return NextResponse.json({ synced: result.synced, activities: result.activities })
}
