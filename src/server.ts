import "dotenv/config";
import cookieParser from "cookie-parser";
import express from "express";
import listEndpoints from "express-list-endpoints";
import mongoose from "mongoose";

import serverRouter from "./routes/server";
import userRouter from "./routes/user";
import errorHandler from "./errorHandler";

const server = express();
server.use(express.json());
server.use(cookieParser());
const port = process.env.PORT || 8080;

server.use("/", serverRouter);
server.use("/users", userRouter);
server.use(errorHandler);

mongoose.connect(process.env.DB_URL as string);

mongoose.connection.on("connected", () => {
  console.log("Connected to DB!");

  server.listen(port, () => {
    console.table(listEndpoints(server));
    console.log(`Server is listening at port ${port}`);
  });
});

mongoose.connection.on("error", (error) => console.log(error));
