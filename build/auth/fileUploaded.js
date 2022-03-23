"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const ddbClient_1 = __importDefault(require("../db/ddbClient"));
const { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, BUCKET_NAME, CDN_URL, } = process.env;
// AWS.config.update({
//   region: AWS_REGION,
//   accessKeyId: AWS_ACCESS_KEY_ID,
//   secretAccessKey: AWS_SECRET_ACCESS_KEY,
// });
// const s3 = new AWS.S3();
const fileUploaded = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (req.file && req.userEmail) {
            const fileObject = req.file;
            const url = `${CDN_URL}/${fileObject.key}`;
            const user = yield ddbClient_1.default.send(new client_dynamodb_1.UpdateItemCommand({
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
            }));
            //   if (user.Attributes) {
            //     const pasok = await s3.deleteObject({
            //       Bucket: BUCKET_NAME as string,
            //       Key: user.Attributes.avatar.S?.split("/").reverse()[0] as string,
            //     });
            //     console.log(pasok);
            //   }
            next();
        }
        else {
            next();
        }
    }
    catch (error) {
        next(error);
    }
});
exports.default = fileUploaded;
