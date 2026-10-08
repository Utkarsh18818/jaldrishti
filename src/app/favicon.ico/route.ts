// No favicon artwork is configured. Serve a valid blank image. A prerendered
// 204 is reconstructed with a body by Next.js and fails in the runtime.
export const dynamic = "force-static";
export function GET() {
  return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"></svg>', {
    headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" },
  });
}
