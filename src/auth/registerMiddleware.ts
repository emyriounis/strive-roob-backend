import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import * as globalTypes from "../types/global";
import ddbClient from "../db/ddbClient";
import encryptPassword from "../tools/encryptPassword";
import sendEmail from "../tools/sendEmail";
import generatorJWT from "../tools/generatorJWT";

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
        emailVerified: { BOOL: false },
      };

      const createdUser = await ddbClient.send(
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

      if (createdUser) {
        const token = await generatorJWT(email, "1w");
        await sendEmail(
          [email],
          [],
          "",
          `You can validate your email here: ${process.env.FE_URL}/validateEmail/${token}\n\nIt is valid for 1 week`,
          "Roob. Validate your email"
        );
        req.userEmail = email;
        next();
      } else {
        next(createHttpError(400, "Failed to register user"));
      }
    }
  } catch (error) {
    next(error);
  }
};

export default registerMiddleware;
