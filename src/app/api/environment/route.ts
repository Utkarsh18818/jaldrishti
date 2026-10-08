import { createProvider } from "@/features/environment/provider";
import { gateway } from "../real-analysis/gateway";
export const dynamic = "force-dynamic";
const provider = createProvider();
export async function GET(request: Request) {
  if (process.env.AWS_LAMBDA_FUNCTION_NAME && !gateway.authenticated(request))
    return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: { "cache-control": "no-store" } });
  return Response.json(await provider.load(), {
    headers: { "Cache-Control": "no-store" },
  });
}
