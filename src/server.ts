import "dotenv/config";
import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";
import listEndpoints from "express-list-endpoints";
import cron from "node-cron";

import serverRouter from "./routes/server";
import userRouter from "./routes/user";
import errorHandler from "./errorHandler";
import productRoute from "./routes/product";
import customerRouter from "./routes/customers";
import invoiceRouter from "./routes/invoices";
import subscriptionRouter from "./routes/subscriptions";
import invoiceSubscriptions from "./scheduledTasks/invoiceSubscriptions";

const server = express();
server.use(
  cors({
    origin: process.env.FE_URL,
    credentials: true,
  })
);
server.use(cookieParser());
server.use(express.json());
const port = process.env.PORT || 8080;

server.use("/", serverRouter);
server.use("/users", userRouter);
server.use("/products", productRoute);
server.use("/customers", customerRouter);
server.use("/invoices", invoiceRouter);
server.use("/subscriptions", subscriptionRouter);
server.use(errorHandler);

cron.schedule("0 0 * * *", async () => {
  await invoiceSubscriptions();
});

server.listen(port, () => {
  console.table(listEndpoints(server));
  console.log(`Server is listening at port ${port}`);
});
