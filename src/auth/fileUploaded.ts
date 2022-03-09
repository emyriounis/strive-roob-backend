import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
// import AWS from "aws-sdk";
import { NextFunction, Request, Response } from "express";
import ddbClient from "../db/ddbClient";

const {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  BUCKET_NAME,
  CDN_URL,
} = process.env;

// AWS.config.update({
//   region: AWS_REGION,
//   accessKeyId: AWS_ACCESS_KEY_ID,
//   secretAccessKey: AWS_SECRET_ACCESS_KEY,
// });
// const s3 = new AWS.S3();
const fileUploaded = async (req: any, res: Response, next: NextFunction) => {
  try {
    if (req.file && req.userEmail) {
      const fileObject: any = req.file;

      const url = `${CDN_URL}/${fileObject.key}`;
      const user = await ddbClient.send(
        new UpdateItemCommand({
          TableName: "Users",
          Key: {
            email: { S: req.userEmail },
          },
          UpdateExpression: "set firstName = :fn, lastName = :ln, avatar = :av",
          ExpressionAttributeValues: {
            ":fn": { S: req.body.firstName },
            ":ln": { S: req.body.lastName },
            ":av": { S: url },
          },
          ReturnValues: "ALL_OLD",
        })
      );
      //   if (user.Attributes) {

      //     const pasok = await s3.deleteObject({
      //       Bucket: BUCKET_NAME as string,
      //       Key: user.Attributes.avatar.S?.split("/").reverse()[0] as string,
      //     });
      //     console.log(pasok);
      //   }
      next();
    } else {
      next();
    }
  } catch (error) {
    next(error);
  }
};

export default fileUploaded;
