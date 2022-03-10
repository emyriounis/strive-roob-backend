import { NextFunction, Request, Response, Router } from "express";
import createHttpError from "http-errors";
import multer from "multer";
import {
  DeleteItemCommand,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import AWS from "aws-sdk";
import multerS3 from "multer-s3";

import providerJWT from "../auth/providerJWT";
import loginMiddleware from "../auth/loginMiddleware";
import refreshMiddleware from "../auth/refreshMiddleware";
import registerMiddleware from "../auth/registerMiddleware";
import sendCookies from "../auth/sendCookies";
import authValidator from "../auth/authValidator";
import * as globalTypes from "../types/global";
import ddbClient from "../db/ddbClient";
import fileUploaded from "../auth/fileUploaded";
import generatorJWT from "../tools/generatorJWT";
import validatorJWT from "../tools/validatorJWT";
import encryptPassword from "../tools/encryptPassword";
import sendEmail from "../tools/sendEmail";

const userRouter = Router();
const {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  BUCKET_NAME,
  CDN_URL,
  SENDER_EMAIL_ADDRESS,
  FE_URL,
} = process.env;

AWS.config.update({
  region: AWS_REGION,
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();
const profileImageUploader = multer({
  storage: multerS3({
    s3: s3,
    bucket: BUCKET_NAME as string,
    key: function (req, file, cb) {
      cb(
        null,
        (file.originalname.split(".").reverse().pop() as string) + Date.now()
      );
    },
  }),
});

userRouter.post("/register", registerMiddleware, providerJWT, sendCookies);
userRouter.post("/login", loginMiddleware, providerJWT, sendCookies);
userRouter.post("/refresh", refreshMiddleware, providerJWT, sendCookies);

userRouter.post(
  "/verifyEmail",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body.token) {
        const payload: any = await validatorJWT(req.body.token);
        if (payload.email) {
          const user = await ddbClient.send(
            new UpdateItemCommand({
              TableName: "Users",
              Key: {
                email: { S: payload.email as string },
              },
              UpdateExpression: "set emailVerified = :ev",
              ExpressionAttributeValues: {
                ":ev": { BOOL: true },
              },
              ReturnValues: "ALL_NEW",
            })
          );
          if (user.Attributes) {
            res.send({
              email: user.Attributes.email?.S,
              emailVerified: user.Attributes.emailVerified?.S,
            });
          } else {
            next(createHttpError(404, "User not found"));
          }
        } else {
          next(createHttpError(400, "Token not valid"));
        }
      } else {
        next(createHttpError(400, "Please provide token"));
      }
    } catch (error: any) {
      if (error.name === "JsonWebTokenError") {
        next(createHttpError(400, "Token not valid"));
      } else {
        next(error);
      }
    }
  }
);

userRouter.post(
  "/sendVerificationEmail",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const token = await generatorJWT(req.userEmail, "1w");
        await sendEmail(
          [req.userEmail],
          [],
          "",
          `You can validate your email here: ${process.env.FE_URL}/validateEmail/${token}\n\nIt is valid for 1 week`,
          "Roob. Validate your email"
        );
      } else {
        next(createHttpError(400, "Email not provided"));
      }
    } catch (error) {
      next(error);
    }
  }
);

userRouter.post(
  "/forgotPassword",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body.email) {
        const user = await ddbClient.send(
          new GetItemCommand({
            TableName: "Users",
            Key: {
              email: { S: req.body.email as string },
            },
            AttributesToGet: ["email"],
          })
        );

        if (user.Item) {
          const token = await generatorJWT(req.body.email as string, "1w");
          const email = await sendEmail(
            [req.body.email],
            [],
            "",
            `You can create a new password here: ${FE_URL}/resetPassword/${token}\n\nIt is valid for 1 week`,
            "Roob. Create new password"
          );
          console.log(email);
          if (email) {
            res.send({ emailSent: true });
          } else {
            next(createHttpError(400, "Failed to send email"));
          }
        } else {
          next(createHttpError(404, "User does not exist"));
        }
      } else {
        next(createHttpError(400, "Please provide email"));
      }
    } catch (error) {
      next(error);
    }
  }
);

userRouter.post(
  "/resetPassword",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { password, token } = req.body;
      const payload: any = await validatorJWT(token);

      if (payload.email) {
        const user = await ddbClient.send(
          new UpdateItemCommand({
            TableName: "Users",
            Key: {
              email: { S: payload.email as string },
            },
            UpdateExpression: "set password = :pw",
            ExpressionAttributeValues: {
              ":pw": { S: await encryptPassword(password as string) },
            },
            ReturnValues: "ALL_NEW",
          })
        );
        if (user) {
          req.userEmail = payload.email as string;
          next();
        } else {
          next(createHttpError(400, "Failed to reset password"));
        }
      } else {
        next(createHttpError(400, "Token not valid"));
      }
    } catch (error) {
      next(error);
    }
  },
  providerJWT,
  sendCookies
);

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
      res.send();
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
            AttributesToGet: [
              "email",
              "firstName",
              "lastName",
              "avatar",
              "emailVerified",
            ],
          })
        );

        if (user.Item) {
          res.send({
            email: user.Item.email?.S,
            firstName: user.Item.firstName?.S,
            lastName: user.Item.lastName?.S,
            avatar: user.Item.avatar?.S,
            emailVerified: user.Item.emailVerified?.BOOL || false,
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

userRouter.put(
  "/me",
  authValidator,
  profileImageUploader.single("profileImage"),
  fileUploaded,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const user = await ddbClient.send(
          new UpdateItemCommand({
            TableName: "Users",
            Key: {
              email: { S: req.userEmail },
            },
            UpdateExpression: "set firstName = :fn, lastName = :ln",
            ExpressionAttributeValues: {
              ":fn": { S: req.body.firstName },
              ":ln": { S: req.body.lastName },
            },
            ReturnValues: "ALL_NEW",
          })
        );
        if (user.Attributes) {
          res.send({
            email: user.Attributes?.email?.S,
            firstName: user.Attributes?.firstName?.S,
            lastName: user.Attributes?.lastName?.S,
            avatar: user.Attributes?.avatar?.S,
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

userRouter.delete(
  "/me",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const user = await ddbClient.send(
          new DeleteItemCommand({
            TableName: "Users",
            Key: {
              email: { S: req.userEmail },
            },
          })
        );

        console.log(user);
        if (user) {
          res
            .status(204)
            .clearCookie("accessToken")
            .clearCookie("refreshToken", {
              path: "/users/refresh",
            })
            .send();
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
