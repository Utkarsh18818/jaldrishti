import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHandler, ConflictError } from "./handlers.ts";
import type { ApiEvent, CampusRepository } from "./handlers.ts";
import { createDynamoRepository } from "./dynamodb.ts";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  campusId,
  seedCampus,
  campusToState,
} from "../../src/lib/backend-contract.ts";
import type { CampusState } from "../../src/lib/backend-contract.ts";
import { seedOperations } from "../../src/features/system/model.ts";
import { createProvider } from "../../src/features/environment/provider.ts";
const now = Date.parse("2026-10-07T08:30:00Z");
const weather = {
  status: "unavailable" as const,
  snapshot: null,
  freshness: null,
  issue: "timeout" as const,
  attemptedAt: new Date(now).toISOString(),
};
function repository(initial: CampusState | null = seedCampus(now)) {
  let record: CampusState | null = initial;
  const repo: CampusRepository = {
    async get() {
      return record ? structuredClone(record) : null;
    },
    async put(next, expected) {
      if ((record?.version ?? 0) !== expected) throw new ConflictError();
      record = structuredClone(next);
    },
  };
  return repo;
}
function handler(repo: CampusRepository = repository()) {
  return createHandler({
    repository: repo,
    environment: { load: async () => weather },
    now: () => now,
  });
}
function event(method: string, path: string, payload?: unknown): ApiEvent {
  return {
    rawPath: path,
    requestContext: { http: { method } },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  };
}
test("GET campus serializes the single DynamoDB entity and provenance", async () => {
  const r = await handler()(event("GET", `/campus/${campusId}`));
  assert.equal(r.statusCode, 200);
  const body = JSON.parse(r.body);
  assert.equal(body.execution, "aws-lambda");
  assert.equal(body.campus.expectedSupply, 8000);
  assert.equal(body.campus.provenance.currentStorage.kind, "seeded");
});
test("missing campus returns 404 and does not seed silently", async () => {
  const r = await handler(repository(null))(
    event("GET", `/campus/${campusId}`),
  );
  assert.equal(r.statusCode, 404);
});
test("PUT creates and reloads operational state with server provenance", async () => {
  const repo = repository(null),
    h = handler(repo);
  const values = { ...seedOperations().values, currentStorage: 40000 };
  const saved = await h(
    event("PUT", `/campus/${campusId}`, { values, expectedVersion: 0 }),
  );
  assert.equal(saved.statusCode, 201);
  const reloaded = JSON.parse(
    (await h(event("GET", `/campus/${campusId}`))).body,
  ).campus;
  assert.equal(reloaded.currentStorage, 40000);
  assert.equal(reloaded.version, 1);
  assert.equal(reloaded.provenance.currentStorage.kind, "user");
  assert.equal(reloaded.updatedAt, new Date(now).toISOString());
});
test("PUT rejects invalid values and caller supplied provenance", async () => {
  const h = handler();
  for (const payload of [
    {
      values: { ...seedOperations().values, currentStorage: 60000 },
      expectedVersion: 1,
    },
    {
      values: seedOperations().values,
      expectedVersion: 1,
      provenance: { kind: "detected" },
    },
    {
      values: { ...seedOperations().values, population: 0 },
      expectedVersion: 1,
    },
  ])
    assert.equal(
      (await h(event("PUT", `/campus/${campusId}`, payload))).statusCode,
      400,
    );
});
test("optimistic revision conflicts reject lost updates", async () => {
  const h = handler();
  const write = {
    values: { ...seedOperations().values, dailyDemand: 15000 },
    expectedVersion: 1,
  };
  assert.equal(
    (await h(event("PUT", `/campus/${campusId}`, write))).statusCode,
    200,
  );
  assert.equal(
    (await h(event("PUT", `/campus/${campusId}`, write))).statusCode,
    409,
  );
});
test("explicit backend demo reset restores seed provenance", async () => {
  const h = handler();
  await h(
    event("PUT", `/campus/${campusId}`, {
      values: { ...seedOperations().values, currentStorage: 40000 },
      expectedVersion: 1,
    }),
  );
  const r = await h(
    event("PUT", `/campus/${campusId}`, {
      values: seedOperations().values,
      expectedVersion: 2,
      resetToDemo: true,
    }),
  );
  const campus = JSON.parse(r.body).campus;
  assert.equal(campus.currentStorage, 31000);
  assert.equal(campus.provenance.currentStorage.kind, "seeded");
  assert.equal(campus.version, 3);
});
test("forecast Lambda reproduces approved baseline and recommendation", async () => {
  const r = await handler()(
    event("POST", "/forecast", {
      campusId,
      horizonDays: 14,
      expectedVersion: 1,
    }),
  );
  assert.equal(r.statusCode, 200);
  const result = JSON.parse(r.body);
  assert.equal(result.baseline.points.length, 15);
  assert.equal(result.baseline.netDailyDeficitLitres, 6120);
  assert.ok(Math.abs(result.baseline.criticalCrossing.day - 4.7) < 1e-8);
  assert.equal(result.comparison.waterPreservedLitres, 13489);
  assert.ok(Math.abs(result.comparison.resilienceHours - 99.611076923) < 1e-8);
  assert.equal(result.executedAt, new Date(now).toISOString());
});
test("forecast runs from persisted state and rejects stale revisions", async () => {
  const h = handler();
  await h(
    event("PUT", `/campus/${campusId}`, {
      values: { ...seedOperations().values, dailyDemand: 15000 },
      expectedVersion: 1,
    }),
  );
  const result = JSON.parse(
    (
      await h(
        event("POST", "/forecast", {
          campusId,
          horizonDays: 30,
          expectedVersion: 2,
        }),
      )
    ).body,
  );
  assert.equal(result.baseline.netDailyDeficitLitres, 8620);
  assert.equal(
    (
      await h(
        event("POST", "/forecast", {
          campusId,
          horizonDays: 30,
          expectedVersion: 1,
        }),
      )
    ).statusCode,
    409,
  );
});
test("forecast validates horizon and cannot execute for an unsaved campus", async () => {
  assert.equal(
    (
      await handler()(
        event("POST", "/forecast", {
          campusId,
          horizonDays: 365,
          expectedVersion: 1,
        }),
      )
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await handler(repository(null))(
        event("POST", "/forecast", {
          campusId,
          horizonDays: 30,
          expectedVersion: 0,
        }),
      )
    ).statusCode,
    404,
  );
});
test("environment handler preserves provider failure metadata without demo substitution", async () => {
  const r = await handler()(event("GET", `/environment/${campusId}`));
  assert.equal(r.statusCode, 200);
  assert.deepEqual(JSON.parse(r.body).environment, weather);
});
test("environment Lambda reuses normalization and source metadata with mocked weather API", async () => {
  const time = Array.from(
    { length: 120 },
    (_, i) => Date.parse("2026-10-05T00:00:00Z") / 1000 + i * 3600,
  );
  const provider = createProvider({
    now: () => now,
    fetcher: async () =>
      Response.json({
        latitude: 18.5,
        longitude: 73.875,
        utc_offset_seconds: 0,
        hourly_units: {
          time: "unixtime",
          rain: "mm",
          showers: "mm",
          precipitation: "mm",
        },
        hourly: {
          time,
          rain: time.map(() => 1),
          showers: time.map(() => 0),
          precipitation: time.map(() => 2),
        },
      }),
  });
  const h = createHandler({
    repository: repository(),
    environment: provider,
    now: () => now,
  });
  const result = JSON.parse(
    (await h(event("GET", `/environment/${campusId}`))).body,
  ).environment;
  assert.equal(result.status, "available");
  assert.equal(result.snapshot.recentRain.value, 24);
  assert.equal(result.snapshot.recentRain.kind, "estimated");
  assert.equal(result.snapshot.observationTimestamp, null);
  assert.equal(result.freshness, "fresh");
});
test("backend failures and corrupted stored data are sanitized 503 responses", async () => {
  const h = handler({
    get: async () => {
      throw new Error("secret diagnostic");
    },
    put: async () => {},
  });
  const r = await h(event("GET", `/campus/${campusId}`));
  assert.equal(r.statusCode, 503);
  assert.ok(!r.body.includes("secret diagnostic"));
  const corrupt = handler({ get: async () => ({}), put: async () => {} });
  assert.equal(
    (await corrupt(event("GET", `/campus/${campusId}`))).statusCode,
    503,
  );
});
test("unknown campus, malformed JSON and oversized payloads are rejected", async () => {
  const h = handler();
  assert.equal(
    (await h(event("GET", "/campus/another-campus"))).statusCode,
    404,
  );
  assert.equal(
    (await h({ ...event("PUT", `/campus/${campusId}`), body: "{" })).statusCode,
    400,
  );
  assert.equal(
    (
      await h({
        ...event("PUT", `/campus/${campusId}`),
        body: "x".repeat(20001),
      })
    ).statusCode,
    400,
  );
});
test("DynamoDB adapter sends consistent reads and conditional puts through mocked SDK", async () => {
  const commands: unknown[] = [];
  const mock = {
    send: async (command: unknown) => {
      commands.push(command);
      return { Item: seedCampus(now), $metadata: {} };
    },
  } as unknown as Pick<DynamoDBDocumentClient, "send">;
  const repo = createDynamoRepository("test-table", mock);
  await repo.get(campusId);
  await repo.put(seedCampus(now), 1);
  await repo.put(seedCampus(now), 0);
  assert.ok(commands[0] instanceof GetCommand);
  assert.equal((commands[0] as GetCommand).input.ConsistentRead, true);
  assert.equal(
    (commands[1] as PutCommand).input.ConditionExpression,
    "#version = :expected",
  );
  assert.equal(
    (commands[2] as PutCommand).input.ConditionExpression,
    "attribute_not_exists(campusId)",
  );
});
test("DynamoDB conditional-write failure becomes a conflict", async () => {
  const mock = {
    send: async () => {
      const e = new Error("conflict");
      e.name = "ConditionalCheckFailedException";
      throw e;
    },
  } as unknown as Pick<DynamoDBDocumentClient, "send">;
  await assert.rejects(
    createDynamoRepository("test-table", mock).put(seedCampus(now), 1),
    ConflictError,
  );
});
test("SAM foundation has one Lambda, one on-demand table and exactly four routes", () => {
  const template = JSON.parse(
    readFileSync(new URL("../template.json", import.meta.url), "utf8"),
  );
  const resources = Object.values(template.Resources) as {
    Type: string;
    Properties: Record<string, unknown>;
  }[];
  assert.equal(
    resources.filter((r) => r.Type === "AWS::Serverless::Function").length,
    1,
  );
  assert.equal(
    resources.filter((r) => r.Type === "AWS::DynamoDB::Table").length,
    1,
  );
  assert.equal(
    template.Resources.CampusState.Properties.BillingMode,
    "PAY_PER_REQUEST",
  );
  assert.equal(
    Object.keys(template.Resources.Backend.Properties.Events).length,
    4,
  );
  assert.equal(template.Resources.Backend.Properties.Runtime, "nodejs24.x");
  assert.equal(template.Parameters.MaxConcurrency.Default, 2);
  assert.ok(template.Parameters.MaxConcurrency.AllowedValues.includes(0));
  assert.deepEqual(template.Resources.Backend.Properties.ReservedConcurrentExecutions, {
    "Fn::If": ["ReserveConcurrency", { Ref: "MaxConcurrency" }, { Ref: "AWS::NoValue" }],
  });
  assert.equal(
    template.Resources.BackendLogGroup.Properties.RetentionInDays,
    7,
  );
  assert.equal(campusToState(seedCampus(now)).values.currentStorage, 31000);
});
