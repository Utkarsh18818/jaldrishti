import { createServer } from "node:http";
import { createHandler, ConflictError } from "./lambda/handlers.ts";
import type { CampusRepository } from "./lambda/handlers.ts";
import { seedCampus, campusId } from "../src/lib/backend-contract.ts";
import type { CampusState } from "../src/lib/backend-contract.ts";
import { createProvider } from "../src/features/environment/provider.ts";
import { createRegionalProvider } from "../src/features/analysis/environment.ts";
import type { AnalysisCampus } from "../src/features/analysis/contract.ts";
const records = new Map<string, CampusState | AnalysisCampus>([
  [campusId, seedCampus(Date.now())],
]);
const repository: CampusRepository = {
  async get(id) {
    return records.get(id) ?? null;
  },
  async put(campus, expectedVersion) {
    if ((records.get(campus.campusId)?.version ?? 0) !== expectedVersion)
      throw new ConflictError();
    records.set(campus.campusId, structuredClone(campus));
  },
  async putAnalysis(campus, expectedVersion) {
    if ((records.get(campus.campusId)?.version ?? 0) !== expectedVersion)
      throw new ConflictError();
    records.set(campus.campusId, structuredClone(campus));
  },
};
const handler = createHandler({
  repository,
  environment: createProvider(),
  regionalEnvironment: createRegionalProvider(),
  execution: "local-mock",
});
const server = createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3000");
  response.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "content-type");
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }
  let body = "";
  for await (const chunk of request) {
    body += chunk.toString();
    if (Buffer.byteLength(body) > 300000) {
      response.writeHead(413);
      response.end();
      return;
    }
  }
  const result = await handler({
    rawPath: new URL(request.url ?? "/", "http://127.0.0.1").pathname,
    requestContext: { http: { method: request.method ?? "GET" } },
    body,
  });
  response.writeHead(result.statusCode, result.headers);
  response.end(result.body);
});
server.listen(3100, "127.0.0.1", () =>
  console.log(
    "LOCAL MOCK BACKEND — NOT AWS — http://127.0.0.1:3100; records persist only while this process runs.",
  ),
);
