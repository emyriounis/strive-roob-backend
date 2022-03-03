import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import userModel from "../schemas/user";
import * as globalTypes from "../types/global";

const refreshMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const refreshToken = req.cookies.refreshToken as string;

  if (refreshToken) {
    const user = await userModel.findOne({ refreshToken });

    if (user) {
      req.userID = user._id as string;
      next();
    } else {
      next(createHttpError(401, "Credentials are not ok!"));
    }
  } else {
    next(createHttpError(401, "Please provide credentials!"));
  }
};

export default refreshMiddleware;
