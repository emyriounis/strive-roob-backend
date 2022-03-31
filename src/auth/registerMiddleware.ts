import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import Stripe from "stripe";
import * as globalTypes from "../types/global";
import ddbClient from "../db/ddbClient";
import encryptPassword from "../tools/encryptPassword";
import sendEmail from "../tools/sendEmail";
import generatorJWT from "../tools/generatorJWT";

const stripe = new Stripe(process.env.STRIPE_TEST_KEY as string, {
  apiVersion: "2020-08-27",
});

const registerMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const stripeAccount = await stripe.accounts.create({
      type: "standard",
    });
    console.log(stripeAccount);

    const newUser = {
      email: { S: email },
      password: { S: await encryptPassword(password) },
      firstName: { S: firstName },
      lastName: { S: lastName },
      emailVerified: { BOOL: false },
      stripeId: { S: stripeAccount.id },
    };

    const createdUser = await ddbClient.send(
      new PutItemCommand({
        TableName: "Users",
        Item: newUser,
        ConditionExpression: "#email <>  :email",
        ExpressionAttributeNames: {
          "#email": "email",
        },
        ExpressionAttributeValues: {
          ":email": { S: email },
        },
        ReturnValues: "ALL_OLD",
      })
    );

    if (createdUser) {
      const token = await generatorJWT(email, "1w");
      await sendEmail(
        [email],
        [],
        "",
        `You can validate your email here: ${process.env.FE_URL}/validateEmail/${token}\n\nIt is valid for 1 week`,
        "Roob. Validate your email"
      );
      req.userEmail = email;
      next();
    } else {
      next(createHttpError(400, "Failed to register user"));
    }
  } catch (error: any) {
    if (error.name === "ConditionalCheckFailedException") {
      next(createHttpError(400, "This email is already been used"));
    } else {
      next(error);
    }
  }
};

export default registerMiddleware;
