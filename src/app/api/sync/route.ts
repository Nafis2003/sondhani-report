import { NextResponse, NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getDb } from "@/db";
import { reports } from "@/db/schema";
import { sql, desc } from "drizzle-orm";
import { z } from "zod";
import type { ReportRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

const TEST_VALUE = z.enum(["Negative", "Positive", "N/A"]);

const recordSchema = z.object({
  id: z.string().min(1),
  refId: z.string().min(1),
  name: z.string().min(1),
  age: z.number().int().positive().max(150),
  sex: z.enum(["Male", "Female", "Other"]),
  mobile: z.string().min(1),
  date: z.string().min(1),
  time: z.string().min(1),
  hbsAg: TEST_VALUE,
  hcv: TEST_VALUE,
  malaria: TEST_VALUE,
  hiv: TEST_VALUE,
  vdrl: TEST_VALUE,
  bloodGlucose: z.string(),
  createdAt: z.number().positive(),
  updatedAt: z.number().optional().default(0),
  isDeleted: z.boolean().optional().default(false),
  synced: z.boolean(),
});

async function verifyAuth(request: NextRequest) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return { ok: false, error: "Server misconfiguration", status: 500 as const };
  }

  const token = request.cookies.get("auth_token")?.value;
  if (!token) {
    return { ok: false, error: "Unauthorized", status: 401 as const };
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    await jwtVerify(token, secret);
    return { ok: true };
  } catch {
    return { ok: false, error: "Invalid token", status: 401 as const };
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const db = getDb();
    const allRecords = await db
      .select()
      .from(reports)
      .orderBy(desc(reports.createdAt))
      .limit(100);
    return NextResponse.json({ success: true, records: allRecords });
  } catch (error) {
    console.error("Sync GET error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const db = getDb();
    const body = await request.json();
    const rawRecords: unknown[] = Array.isArray(body) ? body : [body];

    if (rawRecords.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const parseResult = z.array(recordSchema).safeParse(rawRecords);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid record data", details: parseResult.error.issues },
        { status: 400 },
      );
    }

    const values = parseResult.data.map((r) => ({
      id: r.id,
      refId: r.refId,
      name: r.name,
      age: r.age,
      sex: r.sex,
      mobile: r.mobile,
      date: r.date,
      time: r.time,
      hbsAg: r.hbsAg,
      hcv: r.hcv,
      malaria: r.malaria,
      hiv: r.hiv,
      vdrl: r.vdrl,
      bloodGlucose: r.bloodGlucose,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      isDeleted: r.isDeleted,
      synced: true,
    }));

    await db.insert(reports)
      .values(values)
      .onConflictDoUpdate({
        target: reports.id,
        set: {
          refId: sql`EXCLUDED.ref_id`,
          name: sql`EXCLUDED.name`,
          age: sql`EXCLUDED.age`,
          sex: sql`EXCLUDED.sex`,
          mobile: sql`EXCLUDED.mobile`,
          date: sql`EXCLUDED.date`,
          time: sql`EXCLUDED.time`,
          hbsAg: sql`EXCLUDED.hbs_ag`,
          hcv: sql`EXCLUDED.hcv`,
          malaria: sql`EXCLUDED.malaria`,
          hiv: sql`EXCLUDED.hiv`,
          vdrl: sql`EXCLUDED.vdrl`,
          bloodGlucose: sql`EXCLUDED.blood_glucose`,
          createdAt: sql`EXCLUDED.created_at`,
          updatedAt: sql`EXCLUDED.updated_at`,
          isDeleted: sql`EXCLUDED.is_deleted`,
          synced: true,
        }
      });

    return NextResponse.json({ success: true, count: values.length });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ success: false, error: "Failed to sync" }, { status: 500 });
  }
}
