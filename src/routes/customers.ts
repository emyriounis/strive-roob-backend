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

const customerRouter = Router();
const Json2csvParser = json2csv.Parser;

customerRouter.post(
  "/",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const { customerEmail, email, customerName, description } = req.body;
        const newCustomer = {
          userEmail: { S: req.userEmail },
          customerEmail: { S: email as string },
          email: { S: email as string },
          customerName: { S: customerName as string },
          description: { S: description as string },
        };

        await ddbClient.send(
          new PutItemCommand({
            TableName: "Customers",
            Item: newCustomer,
            ConditionExpression:
              "userEmail <> :userEmail AND customerEmail <> :customerEmail",
            ExpressionAttributeValues: {
              ":userEmail": { S: req.userEmail },
              ":customerEmail": { S: email as string },
            },
            ReturnValues: "ALL_OLD",
          })
        );
        const createdCustomer = await ddbClient.send(
          new GetItemCommand({
            TableName: "Customers",
            Key: {
              userEmail: { S: req.userEmail },
              customerEmail: { S: email as string },
            },
            AttributesToGet: [
              "customerEmail",
              "email",
              "customerName",
              "description",
            ],
          })
        );

        if (createdCustomer.Item) {
          res.status(201).send({
            customerEmail: createdCustomer.Item.customerEmail.S,
            email: createdCustomer.Item.email.S,
            customerName: createdCustomer.Item.customerName.S,
            description: createdCustomer.Item.description.S,
          });
        } else {
          next(createHttpError(404, "Faild to retrive created user"));
        }
      } else {
        next(createHttpError(400, "Email not provided"));
      }
    } catch (error) {
      next(error);
    }
  }
);

customerRouter.get(
  "/",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const customers = await ddbClient.send(
          new ScanCommand({
            FilterExpression: "userEmail = :userEmail",
            ExpressionAttributeValues: {
              ":userEmail": { S: req.userEmail },
            },
            ProjectionExpression:
              "customerEmail, email, customerName, description, archived",
            TableName: "Customers",
          })
        );
        if (customers) {
          res.send(
            customers.Items?.map((customer) => {
              return {
                customerEmail: customer.customerEmail.S,
                email: customer.email.S,
                customerName: customer.customerName.S,
                description: customer.description.S,
                archived: customer.archived?.BOOL || false,
              };
            })
          );
        } else {
          next(createHttpError(404, "Failed to retrive customers"));
        }
      } else {
        next(createHttpError(400, "Email not provided"));
      }
    } catch (error) {
      next(error);
    }
  }
);

customerRouter.get(
  "/csv",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const customers = await ddbClient.send(
          new ScanCommand({
            FilterExpression: "userEmail = :userEmail ",
            ExpressionAttributeValues: {
              ":userEmail": { S: req.userEmail },
            },
            ProjectionExpression: "email, customerName, description, archived",
            TableName: "Customers",
          })
        );
        if (customers.Items) {
          const json2csvParser = new Json2csvParser({
            fields: ["email", "customerName", "description", "archived"],
          });
          const csvData = json2csvParser.parse(
            customers.Items?.map((customer) => {
              return {
                email: customer.email.S,
                customerName: customer.customerName.S,
                description: customer.description.S,
                archived: customer.archived?.BOOL || false ? "yes" : "no",
              };
            })
          );
          res.setHeader(
            "Content-Disposition",
            "attachment; filename = customers.csv"
          );
          res.set("Content-Type", "text/csv");
          res.status(200).end(csvData);
        } else {
          next(createHttpError(404, "Failed to retrive customers"));
        }
      } else {
        next(createHttpError(400, "Email not provided"));
      }
    } catch (error) {
      next(error);
    }
  }
);

customerRouter.put(
  "/",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const { customerEmail, email, customerName, description } = req.body;
        const updatedCustomer = await ddbClient.send(
          new UpdateItemCommand({
            TableName: "Customers",
            Key: {
              userEmail: { S: req.userEmail },
              customerEmail: { S: customerEmail },
            },
            UpdateExpression:
              "set email = :email, customerName = :customerName, description = :description",
            ExpressionAttributeValues: {
              ":email": { S: email },
              ":customerName": { S: customerName },
              ":description": { S: description },
            },
            ReturnValues: "ALL_NEW",
          })
        );
        if (updatedCustomer.Attributes) {
          res.send({
            customerEmail: updatedCustomer.Attributes.customerEmail.S,
            email: updatedCustomer.Attributes.email.S,
            customerName: updatedCustomer.Attributes.customerName.S,
            description: updatedCustomer.Attributes.description.S,
            archived: updatedCustomer.Attributes.archived?.BOOL || false,
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

customerRouter.put(
  "/archive",
  authValidator,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.userEmail) {
        const { customerEmail, archive } = req.body;

        const archivedCustomer = await ddbClient.send(
          new UpdateItemCommand({
            TableName: "Customers",
            Key: {
              userEmail: { S: req.userEmail },
              customerEmail: { S: customerEmail as string },
            },
            UpdateExpression: "set archived = :archive",
            ExpressionAttributeValues: {
              ":archive": { BOOL: archive },
            },
            ReturnValues: "ALL_NEW",
          })
        );

        if (archivedCustomer.Attributes) {
          res.send({
            customerEmail: archivedCustomer.Attributes.customerEmail.S,
            email: archivedCustomer.Attributes.email.S,
            customerName: archivedCustomer.Attributes.customerName.S,
            description: archivedCustomer.Attributes.description.S,
            archived: archivedCustomer.Attributes.archived?.BOOL || false,
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

export default customerRouter;
