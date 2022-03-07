import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import UserModel from "../schemas/user";
import * as globalTypes from "../types/global";
import ddbClient from "../db/ddbClient";
import encryptPassword from "../tools/encryptPassword";

const registerMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const userExists = await ddbClient.send(
      new GetItemCommand({
        TableName: "Users",
        Key: {
          email: { S: email },
        },
        AttributesToGet: ["email"],
      })
    );
    if (userExists.Item) {
      next(createHttpError(400, "User already exists"));
    } else {
      const newUser = {
        email: { S: email },
        password: { S: await encryptPassword(password) },
        firstName: { S: firstName },
        lastName: { S: lastName },
      };

      await ddbClient.send(
        new PutItemCommand({
          TableName: "Users",
          Item: newUser,
          ConditionExpression: "#email <>  :email",
          ExpressionAttributeNames: {
            "#email": "email",
          },
          ExpressionAttributeValues: {
            ":email": { S: email },
          },
          ReturnValues: "ALL_OLD",
        })
      );

      req.userEmail = email;
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default registerMiddleware;
