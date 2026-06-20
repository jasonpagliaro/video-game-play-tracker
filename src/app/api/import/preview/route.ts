import { NextResponse } from "next/server";

import { parseSteamCsv } from "@/lib/backlog/csv";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  await requireUser();
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a CSV file." }, { status: 400 });
  }
  const text = await file.text();
  return NextResponse.json(parseSteamCsv(text, file.name));
}

