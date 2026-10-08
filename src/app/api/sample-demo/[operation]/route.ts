import { gateway } from "../../real-analysis/gateway";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request, context: { params: Promise<{ operation: string }> }) {
  return gateway.proxy(request, (await context.params).operation, true);
}
export const GET = handle;
export const PUT = handle;
export const POST = handle;
