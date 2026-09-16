import { proxyCompanion } from "@/lib/kb/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  let path: string[];
  try {
    path = (await context.params).path.map(decodeURIComponent);
  } catch {
    return Response.json(
      { error: "Invalid workspace path encoding." },
      { status: 400 },
    );
  }
  return proxyCompanion(request, path);
}
export { handle as GET, handle as POST, handle as PUT };
