import {
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import Stripe from "stripe";
import ddbClient from "../db/ddbClient";
import sendEmail from "../tools/sendEmail";

const stripe = new Stripe(process.env.STRIPE_TEST_KEY as string, {
  apiVersion: "2020-08-27",
});

const invoiceSubscriptions = async () => {
  console.log("running");

  const subscriptionsToInvoice = await ddbClient.send(
    new ScanCommand({
      FilterExpression:
        "nextInvoiceAt < :currentDateInMill AND canceled = :canceled",
      ExpressionAttributeValues: {
        ":currentDateInMill": {
          N: Date.parse(Date()).toString(),
        },
        ":canceled": { BOOL: false },
      },
      TableName: "Subscriptions",
    })
  );

  subscriptionsToInvoice.Items?.forEach(async (sub, index) => {
    try {
      const {
        userEmail,
        createdAt,
        amount,
        currency,
        nextInvoiceAt,
        customerEmail,
        customerName,
        products,
        notes,
        endAt,
        recurringEveryDays,
      } = sub;

      if (Number(nextInvoiceAt.N)) {
        const user = await ddbClient.send(
          new GetItemCommand({
            TableName: "Users",
            Key: {
              email: userEmail,
            },
            AttributesToGet: ["firstName", "lastName", "stripeId"],
          })
        );

        const paymentIntent = await stripe.paymentIntents.create(
          {
            payment_method_types: ["card"],
            amount: 100 * Number(amount.N),
            currency: currency.S as string,
            application_fee_amount: Number(amount.N), // 0.01 * 100 => 1
          },
          {
            stripeAccount: user.Item?.stripeId?.S,
          }
        );

        const createdDate = { N: (Date.parse(Date()) + index).toString() };
        const newInvoice = {
          userEmail,
          createdAt: createdDate,
          amount,
          paymentIntentClientSecret: {
            S: paymentIntent.client_secret as string,
          },
          currency,
          customerEmail,
          customerName,
          dueAt: { N: "0" },
          products,
          notes,
          paid: { BOOL: false },
        };

        await ddbClient.send(
          new PutItemCommand({
            TableName: "Invoices",
            Item: newInvoice,
            ConditionExpression:
              "userEmail <> :userEmail AND createdAt <> :createdAt",
            ExpressionAttributeValues: {
              ":userEmail": userEmail,
              ":createdAt": createdDate,
            },
            ReturnValues: "ALL_OLD",
          })
        );

        const canceledSub =
          Number(endAt.N) < Date.parse(Date()) ||
          !Boolean(Number(recurringEveryDays));

        const nextInvoiceDate = canceledSub
          ? 0
          : Number(nextInvoiceAt.N) + Number(recurringEveryDays.N) * 86400000;

        await ddbClient.send(
          new UpdateItemCommand({
            TableName: "Subscriptions",
            Key: {
              userEmail,
              createdAt,
            },
            UpdateExpression:
              "set nextInvoiceAt = :nextInvoiceAt, canceled = :canceled",
            ExpressionAttributeValues: {
              ":nextInvoiceAt": { N: nextInvoiceDate.toString() },
              ":canceled": { BOOL: canceledSub },
            },
            ReturnValues: "ALL_NEW",
          })
        );

        await sendEmail(
          [customerEmail.S as string],
          [],
          "",
          `You can pay your invoice here: ${process.env.FE_URL}/payInvoice/${user.Item?.stripeId?.S}/${paymentIntent.client_secret}`,
          `Roob. Your invoice from ${user.Item?.firstName.S} ${user.Item?.lastName.S}`
        );
      }
    } catch (error) {
      console.log({ error });
    }
  });
};

export default invoiceSubscriptions;
