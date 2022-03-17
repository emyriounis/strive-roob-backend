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

const invoiceRouter = Router();
const Json2csvParser = json2csv.Parser;

invoiceRouter.post(
  "/",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const { customerEmail, dueAt, products, notes } = req.body;
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
            const currency: string | false | undefined =
              dbProducts.Items?.length > 0 &&
              new Set(dbProducts.Items.map((pr) => pr.currency.S)).size !== 1 &&
              dbProducts.Items[0].currency.S;
            if (!currency) {
              next(
                createHttpError(
                  400,
                  "All products should have the same currency"
                )
              );
            } else {
              const invoicedProducts = products.filter((pr: any) =>
                dbProducts.Items?.map((pr) => pr.product.S).includes(pr.product)
              );

              const amount = invoicedProducts
                .map((pr: any) => pr.price * pr.quantity)
                .reduce((a: number, b: number) => a + b);

              const createdAt = Date.parse(Date().toString());

              const newInvoice = {
                userEmail: { S: req.userEmail },
                amount: { N: amount.toString() },
                currency: { S: currency },
                createdAt: { N: createdAt.toString() },
                customerEmail: { S: customer.Item.email.S || "" },
                customerName: { S: customer.Item.customerName.S || "" },
                dueAt: { N: dueAt.toString() },
                products: {
                  L: invoicedProducts.map((pr: any) => {
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
                paid: { BOOL: false },
              };

              await ddbClient.send(
                new PutItemCommand({
                  TableName: "Invoices",
                  Item: newInvoice,
                  ConditionExpression:
                    "userEmail <> :userEmail AND createdAt <> :createdAt",
                  ExpressionAttributeValues: {
                    ":userEmail": { S: req.userEmail },
                    ":createdAt": { N: createdAt.toString() },
                  },
                  ReturnValues: "ALL_OLD",
                })
              );

              const createdInvoice = await ddbClient.send(
                new GetItemCommand({
                  TableName: "Invoices",
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
                    "dueAt",
                    "products",
                    "notes",
                    "paid",
                  ],
                })
              );
              console.log(createdInvoice);

              if (createdInvoice.Item) {
                console.log(createdInvoice.Item);

                res.status(201).send({
                  amount: createdInvoice.Item.amount.N,
                  currency: createdInvoice.Item.currency.S,
                  createdAt: createdInvoice.Item.createdAt.N,
                  customerEmail: createdInvoice.Item.customerEmail.S,
                  customerName: createdInvoice.Item.customerName.S,
                  dueAt: createdInvoice.Item.dueAt.N,
                  products: createdInvoice.Item.products.L?.map((item) => {
                    return {
                      product: item.M?.product.S,
                      productName: item.M?.productName.S,
                      currency: item.M?.currency.S,
                      price: item.M?.price.N,
                      quantity: item.M?.quantity.N,
                    };
                  }),
                  notes: createdInvoice.Item.notes.S,
                  paid: createdInvoice.Item.paid.BOOL,
                  status: createdInvoice.Item.paid.BOOL
                    ? "Paid"
                    : Number(createdInvoice.Item.dueAt.N) > Date.parse(Date())
                    ? "Outstanding"
                    : "Past Due",
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

invoiceRouter.get(
  "/",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const invoices = await ddbClient.send(
          new ScanCommand({
            FilterExpression: "userEmail = :userEmail",
            ExpressionAttributeValues: {
              ":userEmail": { S: req.userEmail },
            },
            ProjectionExpression:
              "amount, currency, createdAt, customerEmail, customerName, dueAt, products, notes, paid",
            TableName: "Invoices",
          })
        );
        if (invoices.Items) {
          res.send(
            invoices.Items?.map((invoice) => {
              return {
                amount: invoice.amount.N,
                currency: invoice.currency.S,
                createdAt: invoice.createdAt.N,
                customerEmail: invoice.customerEmail.S,
                customerName: invoice.customerName.S,
                dueAt: invoice.dueAt.N,
                products: invoice.products.L?.map((item) => {
                  return {
                    product: item.M?.product.S,
                    productName: item.M?.productName.S,
                    currency: item.M?.currency.S,
                    price: item.M?.price.N,
                    quantity: item.M?.quantity.N,
                  };
                }),
                notes: invoice.notes.S,
                paid: invoice.paid.BOOL,
                status: invoice.paid.BOOL
                  ? "Paid"
                  : Number(invoice.dueAt.N) > Date.parse(Date())
                  ? "Outstanding"
                  : "Past Due",
              };
            })
          );
        } else {
          next(createHttpError(404, "Failed to retrive invoices"));
        }
      } else {
        next(createHttpError(400, "Email not provided"));
      }
    } catch (error) {
      next(error);
    }
  }
);

invoiceRouter.get(
  "/csv",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const invoices = await ddbClient.send(
          new ScanCommand({
            FilterExpression: "userEmail = :userEmail",
            ExpressionAttributeValues: {
              ":userEmail": { S: req.userEmail },
            },
            ProjectionExpression:
              "amount, currency, createdAt, customerEmail, customerName, dueAt, products, notes, paid",
            TableName: "Invoices",
          })
        );
        if (invoices.Items) {
          const json2csvParser = new Json2csvParser({
            fields: [
              "amount",
              "currency",
              "createdAt",
              "customerEmail",
              "customerName",
              "dueAt",
              "products",
              "notes",
              "status",
            ],
          });
          const csvData = json2csvParser.parse(
            invoices.Items?.map((invoice) => {
              return {
                amount: invoice.amount.N,
                currency: invoice.currency.S,
                createdAt: invoice.createdAt.N,
                customerEmail: invoice.customerEmail.S,
                customerName: invoice.customerName.S,
                dueAt: invoice.dueAt.N,
                products: invoice.products.L?.map((item) => {
                  return {
                    product: item.M?.product.S,
                    productName: item.M?.productName.S,
                    currency: item.M?.currency.S,
                    price: item.M?.price.N,
                    quantity: item.M?.quantity.N,
                  };
                }),
                notes: invoice.notes.S,
                status: invoice.paid.BOOL
                  ? "Paid"
                  : Number(invoice.dueAt.N) > Date.parse(Date())
                  ? "Outstanding"
                  : "Past Due",
              };
            })
          );

          res.setHeader(
            "Content-Disposition",
            "attachment; filename = invoices.csv"
          );
          res.set("Content-Type", "text/csv");
          res.status(200).end(csvData);
        } else {
          next(createHttpError(404, "Failed to retrive invoices"));
        }
      } else {
        next(createHttpError(400, "Email not provided"));
      }
    } catch (error) {
      next(error);
    }
  }
);

// invoiceRouter.put(
//   "/",
//   authValidator,
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       if (req.userEmail) {
//         const { customerEmail, email, customerName, description } = req.body;
//         const updatedCustomer = await ddbClient.send(
//           new UpdateItemCommand({
//             TableName: "Customers",
//             Key: {
//               userEmail: { S: req.userEmail },
//               customerEmail: { S: customerEmail },
//             },
//             UpdateExpression:
//               "set email = :email, customerName = :customerName, description = :description",
//             ExpressionAttributeValues: {
//               ":email": { S: email },
//               ":customerName": { S: customerName },
//               ":description": { S: description },
//             },
//             ReturnValues: "ALL_NEW",
//           })
//         );
//         if (updatedCustomer.Attributes) {
//           res.send({
//             customerEmail: updatedCustomer.Attributes.customerEmail.S,
//             email: updatedCustomer.Attributes.email.S,
//             customerName: updatedCustomer.Attributes.customerName.S,
//             description: updatedCustomer.Attributes.description.S,
//             archived: updatedCustomer.Attributes.archived?.BOOL || false,
//           });
//         } else {
//           next(createHttpError(400, "Failed to update customer"));
//         }
//       } else {
//         next(createHttpError(400));
//       }
//     } catch (error) {
//       next(error);
//     }
//   }
// );

// invoiceRouter.put(
//   "/archive",
//   authValidator,
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       if (req.userEmail) {
//         const { customerEmail, archive } = req.body;

//         const archivedCustomer = await ddbClient.send(
//           new UpdateItemCommand({
//             TableName: "Customers",
//             Key: {
//               userEmail: { S: req.userEmail },
//               customerEmail: { S: customerEmail as string },
//             },
//             UpdateExpression: "set archived = :archive",
//             ExpressionAttributeValues: {
//               ":archive": { BOOL: archive },
//             },
//             ReturnValues: "ALL_NEW",
//           })
//         );

//         if (archivedCustomer.Attributes) {
//           res.send({
//             customerEmail: archivedCustomer.Attributes.customerEmail.S,
//             email: archivedCustomer.Attributes.email.S,
//             customerName: archivedCustomer.Attributes.customerName.S,
//             description: archivedCustomer.Attributes.description.S,
//             archived: archivedCustomer.Attributes.archived?.BOOL || false,
//           });
//         } else {
//           next(createHttpError(400, "Failed to update customer"));
//         }
//       } else {
//         next(createHttpError(400));
//       }
//     } catch (error) {
//       next(error);
//     }
//   }
// );

export default invoiceRouter;
