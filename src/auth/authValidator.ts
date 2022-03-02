import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import validatorJWT from "../tools/validatorJWT";

const authValidator = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.cookies.accessToken) {
      const payload: any = await validatorJWT(
        req.cookies.accessToken as string
      );
      if (payload._id) {
        req.userID = payload._id;
        next();
      } else {
        next(createHttpError(401, "Token not valid"));
      }
    } else {
      next(createHttpError(400, "No access token"));
    }
  } catch (error) {
    next(error);
  }
};

export default authValidator;
