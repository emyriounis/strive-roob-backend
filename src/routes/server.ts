import { NextFunction, Request, Response, Router } from "express";

const serverRouter = Router();

serverRouter.get("/", async (req: Request, res: Response, next: NextFunction) =>
  res.send("Server is running!")
);

export default serverRouter;
