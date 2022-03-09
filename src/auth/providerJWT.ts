import createHttpError from "http-errors";
import { Request, Response, NextFunction } from "express";
import generatorJWT from "../tools/generatorJWT";
import ddbClient from "../db/ddbClient";
import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import * as globalTypes from "../types/global";

const providerJWT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = req.userEmail;
    if (email) {
      const accessToken = await generatorJWT(email, "15m");
      const refreshToken = await generatorJWT(email, "2w");

      if (accessToken && refreshToken) {
        const user = await ddbClient.send(
          new UpdateItemCommand({
            TableName: "Users",
            Key: {
              email: { S: email },
            },
            UpdateExpression: "set refreshToken = :rt",
            ExpressionAttributeValues: {
              ":rt": { S: refreshToken },
            },
            ReturnValues: "ALL_NEW",
          })
        );

        if (user.Attributes) {
          req.tokens = { accessToken, refreshToken };
          next();
        } else {
          next(createHttpError(404, "User not found"));
        }
      } else {
        next(createHttpError(500, "Failed to generate JWT tokens"));
      }
    } else {
      next(createHttpError(400, "User not provided"));
    }
  } catch (error) {
    next(error);
  }
};

export default providerJWT;
