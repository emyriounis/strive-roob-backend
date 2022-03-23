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
const http_errors_1 = __importDefault(require("http-errors"));
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const ddbClient_1 = __importDefault(require("../db/ddbClient"));
const encryptPassword_1 = __importDefault(require("../tools/encryptPassword"));
const sendEmail_1 = __importDefault(require("../tools/sendEmail"));
const generatorJWT_1 = __importDefault(require("../tools/generatorJWT"));
const registerMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { firstName, lastName, email, password } = req.body;
        const newUser = {
            email: { S: email },
            password: { S: yield (0, encryptPassword_1.default)(password) },
            firstName: { S: firstName },
            lastName: { S: lastName },
            emailVerified: { BOOL: false },
        };
        const createdUser = yield ddbClient_1.default.send(new client_dynamodb_1.PutItemCommand({
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
        }));
        if (createdUser) {
            const token = yield (0, generatorJWT_1.default)(email, "1w");
            yield (0, sendEmail_1.default)([email], [], "", `You can validate your email here: ${process.env.FE_URL}/validateEmail/${token}\n\nIt is valid for 1 week`, "Roob. Validate your email");
            req.userEmail = email;
            next();
        }
        else {
            next((0, http_errors_1.default)(400, "Failed to register user"));
        }
    }
    catch (error) {
        if (error.name === "ConditionalCheckFailedException") {
            next((0, http_errors_1.default)(400, "This email is already been used"));
        }
        else {
            next(error);
        }
    }
});
exports.default = registerMiddleware;
