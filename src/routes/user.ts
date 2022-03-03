import { NextFunction, Request, Response, Router } from "express";
import providerJWT from "../auth/providerJWT";
import loginMiddleware from "../auth/loginMiddleware";
import refreshMiddleware from "../auth/refreshMiddleware";
import registerMiddleware from "../auth/registerMiddleware";
import sendCookies from "../auth/sendCookies";
import authValidator from "../auth/authValidator";
import UserModel from "../schemas/user";
import createHttpError from "http-errors";

const userRouter = Router();

userRouter.post("/register", registerMiddleware, providerJWT, sendCookies);
userRouter.post("/login", loginMiddleware, providerJWT, sendCookies);
userRouter.post("/refresh", refreshMiddleware, providerJWT, sendCookies);
userRouter.post(
  "/logout",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
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
      const user = await UserModel.findById(req.userID);

      if (user) {
        res.send(user);
      } else {
        next(createHttpError(404, "User not found"));
      }
    } catch (error) {
      next(error);
    }
  }
);

export default userRouter;
