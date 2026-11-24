import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Liveness probe for an uptime monitor: 503 when the database is unreachable,
// 200 otherwise. The reason goes to the server log, not the public response.
export async function GET() {
  const checkedAt = new Date().toISOString();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up", checkedAt });
  } catch (err) {
    console.error("[health] database check failed", err);
    return NextResponse.json({ status: "error", db: "down", checkedAt }, { status: 503 });
  }
}
