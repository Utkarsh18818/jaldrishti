import { createHandler } from "./handlers.ts";
import { createDynamoRepository } from "./dynamodb.ts";
import { createProvider } from "../../src/features/environment/provider.ts";
import { createRegionalProvider } from "../../src/features/analysis/environment.ts";
const table = process.env.CAMPUS_TABLE_NAME;
if (!table) throw new Error("CAMPUS_TABLE_NAME is required.");
export const handler = createHandler({
  repository: createDynamoRepository(table),
  environment: createProvider(),
  regionalEnvironment: createRegionalProvider(),
});
