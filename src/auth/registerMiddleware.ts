import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import UserModel from "../schemas/user";
import * as globalTypes from "../types/global";

const registerMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;
    const newUser = new UserModel({ email, password });
    const createdUser = await newUser.save();

    if (createdUser) {
      const { _id } = createdUser.toJSON();
      req.userID = _id as string;

      next();
    } else {
      next(createHttpError(400, "failed to create user"));
    }
  } catch (error) {
    next(error);
  }
};

export default registerMiddleware;
