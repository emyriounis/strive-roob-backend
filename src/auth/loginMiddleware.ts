import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import userModel from "../schemas/user";

const loginMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.body.identifier && req.body.password) {
    const { identifier, password } = req.body;
    const user = await userModel.authenticate(identifier, password);

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

export default loginMiddleware;
