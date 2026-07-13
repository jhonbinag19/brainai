import { NextResponse } from "next/server";
import { getBrains } from "@/lib/types";

export async function GET() {
  try {
    const brains = await getBrains();
    return NextResponse.json(brains);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
