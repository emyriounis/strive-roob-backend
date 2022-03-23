"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const ddbClient = new client_dynamodb_1.DynamoDBClient({
    region: process.env.AWS_REGION,
});
exports.default = ddbClient;
