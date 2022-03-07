import { NextFunction, Request, Response } from "express";

const sendCookies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res
      .cookie("accessToken", req.tokens?.accessToken, {
        // domain: process.env.FE_URL,
        httpOnly: true,
        // secure: true, // only https requests
        maxAge: 15 * 60 * 1000,
      })
      .cookie("refreshToken", req.tokens?.refreshToken, {
        // domain: process.env.FE_URL,
        path: "/users/refresh",
        httpOnly: true,
        // secure: true, // only https requests
        maxAge: 14 * 24 * 60 * 60 * 1000,
      })
      .send({ login: true, email: req.userEmail });
  } catch (error) {
    next(error);
  }
};

export default sendCookies;
