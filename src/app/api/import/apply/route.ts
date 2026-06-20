import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { applyCsvImport, type ImportDecision } from "@/lib/db/repository";

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a CSV file." }, { status: 400 });
  }
  const decision = String(formData.get("decision") ?? "review") as ImportDecision;
  const text = await file.text();
  const result = await applyCsvImport({ user, filename: file.name, csvText: text, decision });
  return NextResponse.json(result);
}

