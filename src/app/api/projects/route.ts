import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";

export async function POST(request: Request) {
  const body = await request.json();
  const name = body.name?.trim() || "새 리뷰";

  const id = nanoid(12);
  await db.insert(projects).values({ id, name });

  return NextResponse.json({ id, name });
}
