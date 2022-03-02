import createHttpError from "http-errors";
import { Request, Response, NextFunction } from "express";
import generatorJWT from "../tools/generatorJWT";
import userModel from "../schemas/user";

const providerJWT = async (req: Request, res: Response, next: NextFunction) => {
  const _id = req.userID;

  try {
    if (_id) {
      const accessToken = await generatorJWT(_id, "15m");
      const refreshToken = await generatorJWT(_id, "2w");

      if (accessToken && refreshToken) {
        const user = await userModel.findByIdAndUpdate(_id, { refreshToken });
        if (user) {
          req.tokens = { accessToken, refreshToken };
          next();
        } else {
          next(createHttpError(404, "User not found"));
        }
      } else {
        next(createHttpError(500, "Failed to generate JWT tokens"));
      }
    } else {
      next(createHttpError(400, "User not provided"));
    }
  } catch (error) {
    next(error);
  }
};

export default providerJWT;
