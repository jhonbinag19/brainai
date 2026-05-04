import { NextResponse } from "next/server";
import { getAuthCookie } from "@/lib/auth";
import { ybrUrl } from "@/lib/ybr-client";

export async function GET() {
  try {
    const cookie = await getAuthCookie();
    const res = await fetch(ybrUrl("/api/brains"), {
      headers: { Cookie: cookie },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Upstream error: ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
