import {
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { NextFunction, Request, Response, Router } from "express";
import createHttpError from "http-errors";
import authValidator from "../auth/authValidator";
import ddbClient from "../db/ddbClient";
import json2csv from "json2csv";

const subscriptionRouter = Router();
const Json2csvParser = json2csv.Parser;

subscriptionRouter.post(
  "/",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const {
          customerEmail,
          startAt,
          freeTrialDays,
          endAt,
          products,
          notes,
        } = req.body;
        if (!customerEmail) {
          next(createHttpError(400, "No customer provided"));
        } else if (products.lenght <= 0) {
          next(createHttpError(400, "No customer provided"));
        } else {
          const customer = await ddbClient.send(
            new GetItemCommand({
              TableName: "Customers",
              Key: {
                userEmail: { S: req.userEmail },
                customerEmail: { S: customerEmail as string },
              },
              AttributesToGet: ["email", "customerName"],
            })
          );
          const dbProducts = await ddbClient.send(
            new ScanCommand({
              FilterExpression: `userEmail = :userEmail`,
              ExpressionAttributeValues: {
                ":userEmail": { S: req.userEmail },
              },
              ProjectionExpression:
                "product, productName, currency, price, archived",
              TableName: "Products",
            })
          );

          if (customer.Item && dbProducts.Items) {
            const invoicedSubscriptions = products.filter((pr: any) =>
              dbProducts.Items?.map((pr) => pr.product.S).includes(pr.product)
            );

            const currency: string | false | undefined =
              invoicedSubscriptions.length > 0 &&
              new Set(invoicedSubscriptions.map((pr: any) => pr.currency))
                .size === 1 &&
              invoicedSubscriptions[0].currency;

            const recurring: string | false | undefined =
              invoicedSubscriptions.length > 0 &&
              new Set(invoicedSubscriptions.map((pr: any) => pr.recurring))
                .size === 1 &&
              invoicedSubscriptions[0].recurring;

            if (!currency) {
              next(
                createHttpError(
                  400,
                  "All products should have the same currency"
                )
              );
            } else if (!recurring) {
              next(
                createHttpError(
                  400,
                  "All products should have the same recurring period"
                )
              );
            } else {
              const amount = invoicedSubscriptions
                .map((pr: any) => pr.price * pr.quantity)
                .reduce((a: number, b: number) => a + b);

              const createdAt = Date.parse(Date().toString());
              const recurringEveryDays =
                recurring === "year"
                  ? 365
                  : recurring === "month"
                  ? 30
                  : recurring === "day"
                  ? 1
                  : 0;
              const nextInvoiceAt =
                freeTrialDays === 0
                  ? startAt
                  : startAt + freeTrialDays * 24 * 60 * 60 * 1000;

              const newSubscription = {
                userEmail: { S: req.userEmail },
                amount: { N: amount.toString() },
                currency: { S: currency },
                createdAt: { N: createdAt.toString() },
                customerEmail: { S: customer.Item.email.S || "" },
                customerName: { S: customer.Item.customerName.S || "" },
                startAt: { N: startAt.toString() },
                freeTrialDays: { N: freeTrialDays.toString() },
                recurringEveryDays: { N: recurringEveryDays.toString() },
                nextInvoiceAt: { N: nextInvoiceAt.toString() },
                endAt: { N: endAt.toString() },
                products: {
                  L: invoicedSubscriptions.map((pr: any) => {
                    return {
                      M: {
                        product: {
                          S: pr.product,
                        },
                        currency: {
                          S: pr.currency,
                        },
                        quantity: {
                          N: pr.quantity.toString(),
                        },
                        productName: {
                          S: pr.productName,
                        },
                        price: {
                          N: pr.price.toString(),
                        },
                      },
                    };
                  }),
                },
                notes: { S: notes },
                canceled: { BOOL: false },
              };

              await ddbClient.send(
                new PutItemCommand({
                  TableName: "Subscriptions",
                  Item: newSubscription,
                  ConditionExpression:
                    "userEmail <> :userEmail AND createdAt <> :createdAt",
                  ExpressionAttributeValues: {
                    ":userEmail": { S: req.userEmail },
                    ":createdAt": { N: createdAt.toString() },
                  },
                  ReturnValues: "ALL_OLD",
                })
              );

              const createdSubscription = await ddbClient.send(
                new GetItemCommand({
                  TableName: "Subscriptions",
                  Key: {
                    userEmail: { S: req.userEmail },
                    createdAt: { N: createdAt.toString() },
                  },
                  AttributesToGet: [
                    "amount",
                    "currency",
                    "createdAt",
                    "customerEmail",
                    "customerName",
                    "startAt",
                    "freeTrialDays",
                    "recurringEveryDays",
                    "endAt",
                    "products",
                    "notes",
                    "canceled",
                  ],
                })
              );
              console.log(createdSubscription);

              if (createdSubscription.Item) {
                console.log(createdSubscription.Item);

                res.status(201).send({
                  amount: createdSubscription.Item.amount.N,
                  currency: createdSubscription.Item.currency.S,
                  createdAt: createdSubscription.Item.createdAt.N,
                  customerEmail: createdSubscription.Item.customerEmail.S,
                  customerName: createdSubscription.Item.customerName.S,
                  startAt: createdSubscription.Item.startAt.N,
                  freeTrialDays: createdSubscription.Item.freeTrialDays.N,
                  recurringEveryDays:
                    createdSubscription.Item.recurringEveryDays.N,
                  endAt: createdSubscription.Item.endAt.N,
                  products: createdSubscription.Item.products.L?.map((item) => {
                    return {
                      product: item.M?.product.S,
                      productName: item.M?.productName.S,
                      currency: item.M?.currency.S,
                      price: item.M?.price.N,
                      quantity: item.M?.quantity.N,
                    };
                  }),
                  notes: createdSubscription.Item.notes.S,
                  canceled: createdSubscription.Item.canceled.BOOL,
                  status: createdSubscription.Item.canceled.BOOL
                    ? "Canceled"
                    : Number(createdSubscription.Item.endAt.N) <
                      Date.parse(Date())
                    ? "Completed"
                    : Number(createdSubscription.Item.startAt.N) >
                      Date.parse(Date())
                    ? "Scheduled"
                    : "Current",
                });
              } else {
                next(createHttpError(404, "Faild to retrive created user"));
              }
            }
          } else {
            next(createHttpError(400, "Could not verify provided data"));
          }
        }
      } else {
        next(createHttpError(400, "Email not provided"));
      }
    } catch (error) {
      next(error);
    }
  }
);

subscriptionRouter.get(
  "/",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const subscriptions = await ddbClient.send(
          new ScanCommand({
            FilterExpression: "userEmail = :userEmail",
            ExpressionAttributeValues: {
              ":userEmail": { S: req.userEmail },
            },
            ProjectionExpression:
              "amount, currency, createdAt, customerEmail, customerName, startAt, freeTrialDays, recurringEveryDays, endAt, products, notes, canceled",
            TableName: "Subscriptions",
          })
        );
        if (subscriptions.Items) {
          res.send(
            subscriptions.Items?.map((subscription) => {
              return {
                amount: subscription.amount.N,
                currency: subscription.currency.S,
                createdAt: subscription.createdAt.N,
                customerEmail: subscription.customerEmail.S,
                customerName: subscription.customerName.S,
                startAt: subscription.startAt.N,
                freeTrialDays: subscription.freeTrialDays.N,
                recurringEveryDays: subscription.recurringEveryDays.N,
                endAt: subscription.endAt.N,
                products: subscription.products.L?.map((item) => {
                  return {
                    product: item.M?.product.S,
                    productName: item.M?.productName.S,
                    currency: item.M?.currency.S,
                    price: item.M?.price.N,
                    quantity: item.M?.quantity.N,
                  };
                }),
                notes: subscription.notes.S,
                canceled: subscription.canceled.BOOL,
                status: subscription.canceled.BOOL
                  ? "Canceled"
                  : Number(subscription.endAt.N) < Date.parse(Date())
                  ? "Completed"
                  : Number(subscription.startAt.N) > Date.parse(Date())
                  ? "Scheduled"
                  : "Current",
              };
            })
          );
        } else {
          next(createHttpError(404, "Failed to retrive subscriptions"));
        }
      } else {
        next(createHttpError(400, "Email not provided"));
      }
    } catch (error) {
      next(error);
    }
  }
);

subscriptionRouter.get(
  "/csv",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const subscriptions = await ddbClient.send(
          new ScanCommand({
            FilterExpression: "userEmail = :userEmail",
            ExpressionAttributeValues: {
              ":userEmail": { S: req.userEmail },
            },
            ProjectionExpression:
              "amount, currency, createdAt, customerEmail, customerName, startAt, freeTrialDays, recurringEveryDays, endAt, products, notes, canceled",
            TableName: "Subscriptions",
          })
        );
        if (subscriptions.Items) {
          const json2csvParser = new Json2csvParser({
            fields: [
              "amount",
              "currency",
              "createdAt",
              "customerEmail",
              "customerName",
              "startAt",
              "freeTrialDays",
              "recurringEveryDays",
              "endAt",
              "products",
              "notes",
              "status",
            ],
          });
          const csvData = json2csvParser.parse(
            subscriptions.Items?.map((subscription) => {
              return {
                amount: subscription.amount.N,
                currency: subscription.currency.S,
                createdAt: subscription.createdAt.N,
                customerEmail: subscription.customerEmail.S,
                customerName: subscription.customerName.S,
                startAt: subscription.startAt.N,
                freeTrialDays: subscription.freeTrialDays.N,
                recurringEveryDays: subscription.recurringEveryDays.N,
                endAt: subscription.endAt.N,
                products: subscription.products.L?.map((item) => {
                  return {
                    product: item.M?.product.S,
                    productName: item.M?.productName.S,
                    currency: item.M?.currency.S,
                    price: item.M?.price.N,
                    quantity: item.M?.quantity.N,
                  };
                }),
                notes: subscription.notes.S,
                canceled: subscription.canceled.BOOL,
                status: subscription.canceled.BOOL
                  ? "Canceled"
                  : Number(subscription.endAt.N) < Date.parse(Date())
                  ? "Completed"
                  : Number(subscription.startAt.N) > Date.parse(Date())
                  ? "Scheduled"
                  : "Current",
              };
            })
          );

          res.setHeader(
            "Content-Disposition",
            "attachment; filename = subscriptions.csv"
          );
          res.set("Content-Type", "text/csv");
          res.status(200).end(csvData);
        } else {
          next(createHttpError(404, "Failed to retrive subscriptions"));
        }
      } else {
        next(createHttpError(400, "Email not provided"));
      }
    } catch (error) {
      next(error);
    }
  }
);

subscriptionRouter.put(
  "/",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const { endAt, createdAt, canceled } = req.body;
        const updatedSubscription = await ddbClient.send(
          new UpdateItemCommand({
            TableName: "Subscriptions",
            Key: {
              userEmail: { S: req.userEmail },
              createdAt: { N: createdAt.toString() },
            },
            UpdateExpression: "set endAt = :endAt, canceled = :canceled",
            ExpressionAttributeValues: {
              ":endAt": { N: endAt.toString() },
              ":canceled": { BOOL: canceled },
            },
            ReturnValues: "ALL_NEW",
          })
        );
        if (updatedSubscription.Attributes) {
          res.send({
            amount: updatedSubscription.Attributes.amount.N,
            currency: updatedSubscription.Attributes.currency.S,
            createdAt: updatedSubscription.Attributes.createdAt.N,
            customerEmail: updatedSubscription.Attributes.customerEmail.S,
            customerName: updatedSubscription.Attributes.customerName.S,
            startAt: updatedSubscription.Attributes.startAt.N,
            freeTrialDays: updatedSubscription.Attributes.freeTrialDays.N,
            recurringEveryDays:
              updatedSubscription.Attributes.recurringEveryDays.N,
            endAt: updatedSubscription.Attributes.endAt.N,
            products: updatedSubscription.Attributes.products.L?.map((item) => {
              return {
                product: item.M?.product.S,
                productName: item.M?.productName.S,
                currency: item.M?.currency.S,
                price: item.M?.price.N,
                quantity: item.M?.quantity.N,
              };
            }),
            notes: updatedSubscription.Attributes.notes.S,
            canceled: updatedSubscription.Attributes.canceled.BOOL,
            status: updatedSubscription.Attributes.canceled.BOOL
              ? "Canceled"
              : Number(updatedSubscription.Attributes.endAt.N) <
                Date.parse(Date())
              ? "Completed"
              : Number(updatedSubscription.Attributes.startAt.N) >
                Date.parse(Date())
              ? "Scheduled"
              : "Current",
          });
        } else {
          next(createHttpError(400, "Failed to update customer"));
        }
      } else {
        next(createHttpError(400));
      }
    } catch (error) {
      next(error);
    }
  }
);

export default subscriptionRouter;
