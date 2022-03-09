import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import ddbClient from "../db/ddbClient";
import validatorJWT from "../tools/validatorJWT";
import * as globalTypes from "../types/global";

const refreshMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const refreshToken = req.cookies.refreshToken as string;

    if (refreshToken) {
      const payload: any = await validatorJWT(refreshToken);
      if (payload.email) {
        const user = await ddbClient.send(
          new GetItemCommand({
            TableName: "Users",
            Key: {
              email: { S: payload.email as string },
            },
            AttributesToGet: ["refreshToken"],
          })
        );

        if (user.Item) {
          if (user.Item.refreshToken.S === refreshToken) {
            req.userEmail = payload.email as string;
            next();
          } else {
            next(createHttpError(401, "Credentials are not ok!"));
          }
        } else {
          next(createHttpError(401, "Credentials are not ok!"));
        }
      } else {
        next(createHttpError(401, "Token not valid"));
      }
    } else {
      next(createHttpError(401, "Please provide credentials!"));
    }
  } catch (error) {
    next(error);
  }
};

export default refreshMiddleware;
