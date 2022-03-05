import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
});
export default ddbClient;
