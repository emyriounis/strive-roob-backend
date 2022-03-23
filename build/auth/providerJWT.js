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
const generatorJWT_1 = __importDefault(require("../tools/generatorJWT"));
const ddbClient_1 = __importDefault(require("../db/ddbClient"));
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const providerJWT = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const email = req.userEmail;
        if (email) {
            const accessToken = yield (0, generatorJWT_1.default)(email, "15m");
            const refreshToken = yield (0, generatorJWT_1.default)(email, "2w");
            if (accessToken && refreshToken) {
                const user = yield ddbClient_1.default.send(new client_dynamodb_1.UpdateItemCommand({
                    TableName: "Users",
                    Key: {
                        email: { S: email },
                    },
                    UpdateExpression: "set refreshToken = :rt",
                    ExpressionAttributeValues: {
                        ":rt": { S: refreshToken },
                    },
                    ReturnValues: "ALL_NEW",
                }));
                if (user.Attributes) {
                    req.tokens = { accessToken, refreshToken };
                    next();
                }
                else {
                    next((0, http_errors_1.default)(404, "User not found"));
                }
            }
            else {
                next((0, http_errors_1.default)(500, "Failed to generate JWT tokens"));
            }
        }
        else {
            next((0, http_errors_1.default)(400, "User not provided"));
        }
    }
    catch (error) {
        next(error);
    }
});
exports.default = providerJWT;
