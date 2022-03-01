import { Request } from "express";
import { UserType } from "./user";

declare global {
  namespace Express {
    export interface Request {
      user?: UserType;
      tokens?: {
        accessToken: string;
        refreshToken: string;
      };
      userID?: string;
    }
  }
}
