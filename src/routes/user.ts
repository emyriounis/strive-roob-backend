import { NextFunction, Request, Response, Router } from "express";
import createHttpError from "http-errors";
import * as globalTypes from "../types/global";
import UserModel from "../schemas/user";
import providerJWT from "../auth/providerJWT";
import loginMiddleware from "../auth/loginMiddleware";
import refreshMiddleware from "../auth/refreshMiddleware";
import registerMiddleware from "../auth/registerMiddleware";

const userRouter = Router();

userRouter.post(
  "/register",
  registerMiddleware,
  providerJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res
        .status(201)
        .cookie("accessToken", req.tokens?.accessToken, {
          domain: process.env.FE_URL,
          httpOnly: true,
          // secure: true, // only https requests
        })
        .cookie("refreshToken", req.tokens?.refreshToken, {
          domain: process.env.FE_URL,
          path: "/users/refresh",
          httpOnly: true,
          // secure: true, // only https requests
        })
        .send({ login: true });
    } catch (error) {
      next(error);
    }
  }
);

userRouter.post(
  "/login",
  loginMiddleware,
  providerJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res
        .cookie("accessToken", req.tokens?.accessToken, {
          domain: process.env.FE_URL,
          httpOnly: true,
          // secure: true, // only https requests
        })
        .cookie("refreshToken", req.tokens?.refreshToken, {
          domain: process.env.FE_URL,
          path: "/users/refresh",
          httpOnly: true,
          // secure: true, // only https requests
        })
        .send({ login: true });
    } catch (error) {
      next(error);
    }
  }
);

userRouter.post(
  "/refresh",
  refreshMiddleware,
  providerJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res
        .cookie("accessToken", req.tokens?.accessToken, {
          domain: process.env.FE_URL,
          httpOnly: true,
          // secure: true, // only https requests
        })
        .cookie("refreshToken", req.tokens?.refreshToken, {
          domain: process.env.FE_URL,
          path: "/users/refresh",
          httpOnly: true,
          // secure: true, // only https requests
        })
        .send({ logout: true });
    } catch (error) {
      next(error);
    }
  }
);

export default userRouter;
