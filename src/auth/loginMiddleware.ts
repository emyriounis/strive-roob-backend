import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import ddbClient from "../db/ddbClient";
import * as globalTypes from "../types/global";
import authenticatePassword from "../tools/authenticatePassword";

const loginMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.body.identifier && req.body.password) {
      const { identifier, password } = req.body;

      const user = await ddbClient.send(
        new GetItemCommand({
          TableName: "Users",
          Key: {
            email: { S: identifier },
          },
          AttributesToGet: ["email", "password"],
        })
      );

      if (user.Item) {
        const isAuthenticated = await authenticatePassword(
          password,
          user.Item.password.S as string
        );

        if (isAuthenticated) {
          req.userEmail = identifier as string;
        } else {
          next(createHttpError(401, "Credentials are not ok!"));
        }

        next();
      } else {
        next(createHttpError(401, "Credentials are not ok!"));
      }
    } else {
      next(createHttpError(401, "Please provide credentials!"));
    }
  } catch (error) {
    next(error);
  }
};

export default loginMiddleware;
