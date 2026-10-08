import { gateway } from "../gateway";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => gateway.session(request);
export const POST = (request: Request) => gateway.session(request);
