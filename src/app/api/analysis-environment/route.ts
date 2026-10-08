import { createRegionalProvider } from "@/features/analysis/environment";
import { parseLocation } from "@/features/analysis/provenance";
import { gateway } from "../real-analysis/gateway";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const provider = createRegionalProvider();
export async function GET(request: Request) {
  if (process.env.AWS_LAMBDA_FUNCTION_NAME && !gateway.authenticated(request))
    return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: { "cache-control": "no-store" } });
  try {
    const q = new URL(request.url).searchParams;
    if (q.get("latitude") === null || q.get("longitude") === null)
      throw new RangeError("Coordinates required");
    const location = parseLocation({
      name: q.get("name"),
      latitude: Number(q.get("latitude")),
      longitude: Number(q.get("longitude")),
      timezone: q.get("timezone"),
    });
    return Response.json(await provider.load(location), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Valid location name, coordinates and timezone required." },
      { status: 400 },
    );
  }
}
