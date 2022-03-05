import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import UserModel from "../schemas/user";
import * as globalTypes from "../types/global";
import ddbClient from "../db/ddbClient";
import encryptPassword from "../tools/encryptPassword";

const registerMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    const newUser = {
      email: { S: email },
      password: { S: await encryptPassword(password) },
      firstName: { S: firstName },
      lastName: { S: lastName },
    };
    // const newUser = new UserModel({ firstName, lastName, email, password });
    // const createdUser = await newUser.save();
    const data = await ddbClient.send(
      new PutItemCommand({
        TableName: "Users",
        Item: newUser,
        ReturnValues: "ALL_OLD",
      })
    );
    console.log(data);

    // if (createdUser) {
    //   const { _id } = createdUser.toJSON();
    //   req.userID = _id as string;

    //   next();
    // } else {
    //   next(createHttpError(400, "failed to create user"));
    // }
    next();
  } catch (error: any) {
    // if (error.code === 11000) {
    //   next(
    //     createHttpError(
    //       409,
    //       `User already exists, try a different ${Object.keys(
    //         error.keyPattern
    //       ).join("/")}`
    //     )
    //   );
    // } else {
    next(error);
    // }
  }
};

export default registerMiddleware;
