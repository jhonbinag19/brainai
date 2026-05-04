import { NextRequest, NextResponse } from "next/server";
import { getAuthCookie } from "@/lib/auth";
import { ybrUrl } from "@/lib/ybr-client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    const brain = searchParams.get("brain");
    if (q) params.set("q", q);
    if (brain) params.set("brain", brain);

    const cookie = await getAuthCookie();
    const res = await fetch(ybrUrl(`/api/search?${params.toString()}`), {
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
