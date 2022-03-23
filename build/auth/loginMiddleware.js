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
const http_errors_1 = __importDefault(require("http-errors"));
const ddbClient_1 = __importDefault(require("../db/ddbClient"));
const authenticatePassword_1 = __importDefault(require("../tools/authenticatePassword"));
const loginMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (req.body.identifier && req.body.password) {
            const { identifier, password } = req.body;
            const user = yield ddbClient_1.default.send(new client_dynamodb_1.GetItemCommand({
                TableName: "Users",
                Key: {
                    email: { S: identifier },
                },
                AttributesToGet: ["email", "password"],
            }));
            if (user.Item) {
                const isAuthenticated = yield (0, authenticatePassword_1.default)(password, user.Item.password.S);
                if (isAuthenticated) {
                    req.userEmail = identifier;
                }
                else {
                    next((0, http_errors_1.default)(401, "Credentials are not ok!"));
                }
                next();
            }
            else {
                next((0, http_errors_1.default)(401, "Credentials are not ok!"));
            }
        }
        else {
            next((0, http_errors_1.default)(401, "Please provide credentials!"));
        }
    }
    catch (error) {
        next(error);
    }
});
exports.default = loginMiddleware;
