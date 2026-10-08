import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { ConflictError } from "./handlers.ts";
import type { CampusRepository } from "./handlers.ts";
export function createDynamoRepository(
  tableName: string,
  documentClient?: Pick<DynamoDBDocumentClient, "send">,
): CampusRepository {
  const client =
    documentClient ??
    DynamoDBDocumentClient.from(
      new DynamoDBClient({
        maxAttempts: 2,
        requestHandler: { connectionTimeout: 1500, requestTimeout: 2500 },
      }),
      { marshallOptions: { removeUndefinedValues: false } },
    );
  return {
    async get(id) {
      const result = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: { campusId: id },
          ConsistentRead: true,
        }),
      );
      return result.Item ?? null;
    },
    async put(campus, expectedVersion) {
      try {
        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: campus,
            ConditionExpression:
              expectedVersion === 0
                ? "attribute_not_exists(campusId)"
                : "#version = :expected",
            ExpressionAttributeNames:
              expectedVersion === 0 ? undefined : { "#version": "version" },
            ExpressionAttributeValues:
              expectedVersion === 0
                ? undefined
                : { ":expected": expectedVersion },
          }),
        );
      } catch (cause) {
        if (
          cause instanceof Error &&
          cause.name === "ConditionalCheckFailedException"
        )
          throw new ConflictError();
        throw cause;
      }
    },
    async putAnalysis(campus, expectedVersion) {
      try {
        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: campus,
            ConditionExpression:
              expectedVersion === 0
                ? "attribute_not_exists(campusId)"
                : "#version = :expected",
            ExpressionAttributeNames:
              expectedVersion === 0 ? undefined : { "#version": "version" },
            ExpressionAttributeValues:
              expectedVersion === 0
                ? undefined
                : { ":expected": expectedVersion },
          }),
        );
      } catch (cause) {
        if (
          cause instanceof Error &&
          cause.name === "ConditionalCheckFailedException"
        )
          throw new ConflictError();
        throw cause;
      }
    },
  };
}
