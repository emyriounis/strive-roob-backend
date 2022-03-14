import {
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { NextFunction, Request, Response, Router } from "express";
import createHttpError from "http-errors";
import authValidator from "../auth/authValidator";
import ddbClient from "../db/ddbClient";
import variableValidator from "../tools/variableValidator";
import json2csv from "json2csv";

const productRoute = Router();
const Json2csvParser = json2csv.Parser;

productRoute.post(
  "/",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const { product, productName, price, currency, recurring } = req.body;
        if (
          variableValidator(currency, ["usd", "eur", "gbp"]) &&
          variableValidator(recurring, [
            "one-time",
            "day",
            "week",
            "month",
            "year",
          ])
        ) {
          const newProduct = {
            userEmail: { S: req.userEmail },
            product: { S: productName as string },
            productName: { S: productName as string },
            price: { N: price.toString() },
            currency: { S: currency as string },
            recurring: { S: recurring as string },
          };

          await ddbClient.send(
            new PutItemCommand({
              TableName: "Products",
              Item: newProduct,
              ConditionExpression:
                "userEmail <> :userEmail AND product <> :product",
              ExpressionAttributeValues: {
                ":userEmail": { S: req.userEmail },
                ":product": { S: productName as string },
              },
              ReturnValues: "ALL_OLD",
            })
          );
          const createdProduct = await ddbClient.send(
            new GetItemCommand({
              TableName: "Products",
              Key: {
                userEmail: { S: req.userEmail },
                product: { S: productName as string },
              },
              AttributesToGet: [
                "product",
                "productName",
                "price",
                "currency",
                "recurring",
              ],
            })
          );

          if (createdProduct.Item) {
            res.status(201).send({
              product: createdProduct.Item.product.S,
              productName: createdProduct.Item.productName.S,
              recurring: createdProduct.Item.recurring.S,
              currency: createdProduct.Item.currency.S,
              price: createdProduct.Item.price.N,
            });
          } else {
            next(createHttpError(404, "Faild to retrive created product"));
          }
        } else {
        }
      } else {
        next(createHttpError(400, "Email not provided"));
      }
    } catch (error) {
      next(error);
    }
  }
);

productRoute.get(
  "/",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const products = await ddbClient.send(
          new ScanCommand({
            FilterExpression: "userEmail = :userEmail ",
            ExpressionAttributeValues: {
              ":userEmail": { S: req.userEmail },
            },
            ProjectionExpression:
              "product, productName, price, currency, recurring, archived",
            TableName: "Products",
          })
        );
        if (products) {
          console.log(products.Items);

          res.send(
            products.Items?.map((product) => {
              return {
                product: product.product.S,
                productName: product.productName.S,
                recurring: product.recurring.S,
                currency: product.currency.S,
                price: product.price.N,
                archived: product.archived?.BOOL || false,
              };
            })
          );
        } else {
          next(createHttpError(404, "Failed to retrive products"));
        }
      } else {
        next(createHttpError(400, "Email not provided"));
      }
    } catch (error) {
      next(error);
    }
  }
);

productRoute.get(
  "/csv",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const products = await ddbClient.send(
          new ScanCommand({
            FilterExpression: "userEmail = :userEmail ",
            ExpressionAttributeValues: {
              ":userEmail": { S: req.userEmail },
            },
            ProjectionExpression: "productName, price, currency, recurring",
            TableName: "Products",
          })
        );
        if (products.Items) {
          console.log(products);
          const json2csvParser = new Json2csvParser({
            fields: [
              "productName",
              "recurring",
              "currency",
              "price",
              "archived",
            ],
          });
          const csvData = json2csvParser.parse(
            products.Items?.map((product) => {
              return {
                productName: product.productName.S,
                recurring: product.recurring.S,
                currency: product.currency.S,
                price: product.price.N,
                archived: product.archived?.BOOL || false,
              };
            })
          );
          res.setHeader(
            "Content-Disposition",
            "attachment; filename = experiences.csv"
          );
          res.set("Content-Type", "text/csv");
          res.status(200).end(csvData);
        } else {
          next(createHttpError(404, "Failed to retrive products"));
        }
      } else {
        next(createHttpError(400, "Email not provided"));
      }
    } catch (error) {
      next(error);
    }
  }
);

productRoute.put(
  "/",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const { product, productName, price, currency, recurring } = req.body;
        const updatedProduct = await ddbClient.send(
          new UpdateItemCommand({
            TableName: "Products",
            Key: {
              userEmail: { S: req.userEmail },
              product: { S: product },
            },
            UpdateExpression:
              "set productName = :productName, price = :price, currency = :currency, recurring = :recurring",
            ExpressionAttributeValues: {
              ":productName": { S: productName },
              ":price": { N: price.toString() },
              ":currency": { S: currency },
              ":recurring": { S: recurring },
            },
            ReturnValues: "ALL_NEW",
          })
        );
        if (updatedProduct.Attributes) {
          res.send({
            product: updatedProduct.Attributes.product.S,
            productName: updatedProduct.Attributes.productName.S,
            recurring: updatedProduct.Attributes.recurring.S,
            currency: updatedProduct.Attributes.currency.S,
            price: updatedProduct.Attributes.price.N,
            archived: updatedProduct.Attributes.archived?.BOOL || false,
          });
        } else {
          next(createHttpError(400, "Failed to update product"));
        }
      } else {
        next(createHttpError(400));
      }
    } catch (error) {
      next(error);
    }
  }
);

productRoute.put(
  "/archive",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const { product, archive } = req.body;
        console.log(product, archive);

        const archivedProduct = await ddbClient.send(
          new UpdateItemCommand({
            TableName: "Products",
            Key: {
              userEmail: { S: req.userEmail },
              product: { S: product as string },
            },
            UpdateExpression: "set archived = :archive",
            ExpressionAttributeValues: {
              ":archive": { BOOL: archive },
            },
            ReturnValues: "ALL_NEW",
          })
        );
        console.log(archivedProduct);

        if (archivedProduct.Attributes) {
          res.send({
            product: archivedProduct.Attributes.product.S,
            productName: archivedProduct.Attributes.productName.S,
            recurring: archivedProduct.Attributes.recurring.S,
            currency: archivedProduct.Attributes.currency.S,
            price: archivedProduct.Attributes.price.N,
            archived: archivedProduct.Attributes.archived?.BOOL || false,
          });
        } else {
          next(createHttpError(400, "Failed to update product"));
        }
      } else {
        next(createHttpError(400));
      }
    } catch (error) {
      next(error);
    }
  }
);

export default productRoute;
