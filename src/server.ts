import "dotenv/config";
import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";
import listEndpoints from "express-list-endpoints";

import serverRouter from "./routes/server";
import userRouter from "./routes/user";
import errorHandler from "./errorHandler";

const server = express();
server.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
server.use(cookieParser());
server.use(express.json());
const port = process.env.PORT || 8080;

server.use("/", serverRouter);
server.use("/users", userRouter);
server.use(errorHandler);

server.listen(port, () => {
  console.table(listEndpoints(server));
  console.log(`Server is listening at port ${port}`);
});
