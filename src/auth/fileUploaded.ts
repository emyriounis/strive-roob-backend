import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { NextFunction, Request, Response } from "express";
import ddbClient from "../db/ddbClient";

const { CDN_URL } = process.env;

const fileUploaded = async (req: any, res: Response, next: NextFunction) => {
  try {
    if (req.file && req.userEmail) {
      const fileObject: any = req.file;

      const url = `${CDN_URL}/${fileObject.key}`;
      const user = await ddbClient.send(
        new UpdateItemCommand({
          TableName: "Users",
          Key: {
            email: { S: req.userEmail },
          },
          UpdateExpression: "set firstName = :fn, lastName = :ln, avatar = :av",
          ExpressionAttributeValues: {
            ":fn": { S: req.body.firstName },
            ":ln": { S: req.body.lastName },
            ":av": { S: url },
          },
          ReturnValues: "ALL_OLD",
        })
      );
      next();
    } else {
      next();
    }
  } catch (error) {
    next(error);
  }
};

export default fileUploaded;
