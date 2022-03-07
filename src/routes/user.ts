import { NextFunction, Request, Response, Router } from "express";
import createHttpError from "http-errors";
import providerJWT from "../auth/providerJWT";
import loginMiddleware from "../auth/loginMiddleware";
import refreshMiddleware from "../auth/refreshMiddleware";
import registerMiddleware from "../auth/registerMiddleware";
import sendCookies from "../auth/sendCookies";
import authValidator from "../auth/authValidator";
import UserModel from "../schemas/user";
import * as globalTypes from "../types/global";
import ddbClient from "../db/ddbClient";
import { GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const userRouter = Router();

userRouter.post("/register", registerMiddleware, providerJWT, sendCookies);
userRouter.post("/login", loginMiddleware, providerJWT, sendCookies);
userRouter.post("/refresh", refreshMiddleware, providerJWT, sendCookies);
userRouter.post(
  "/logout",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        await ddbClient.send(
          new UpdateItemCommand({
            TableName: "Users",
            Key: {
              email: { S: req.userEmail },
            },
            UpdateExpression: "set refreshToken = :rt",
            ExpressionAttributeValues: {
              ":rt": { S: "" },
            },
            ReturnValues: "ALL_NEW",
          })
        );
      }
      res
        .clearCookie("accessToken")
        .clearCookie("refreshToken", {
          path: "/users/refresh",
        })
        .send({ logout: true });
    } catch (error) {
      next(error);
    }
  }
);

userRouter.get(
  "/me",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const user = await ddbClient.send(
          new GetItemCommand({
            TableName: "Users",
            Key: {
              email: { S: req.userEmail },
            },
            AttributesToGet: ["email", "firstName", "lastName"],
          })
        );

        if (user.Item) {
          res.send({
            email: user.Item?.email?.S,
            firstName: user.Item?.firstName?.S,
            lastName: user.Item?.lastName?.S,
          });
        } else {
          next(createHttpError(404, "User not found"));
        }
      } else {
        next(createHttpError(400, "Failed to authenticate user"));
      }
    } catch (error) {
      next(error);
    }
  }
);

export default userRouter;
