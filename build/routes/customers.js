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
const express_1 = require("express");
const http_errors_1 = __importDefault(require("http-errors"));
const authValidator_1 = __importDefault(require("../auth/authValidator"));
const ddbClient_1 = __importDefault(require("../db/ddbClient"));
const json2csv_1 = __importDefault(require("json2csv"));
const customerRouter = (0, express_1.Router)();
const Json2csvParser = json2csv_1.default.Parser;
customerRouter.post("/", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (req.userEmail) {
            const { customerEmail, email, customerName, description } = req.body;
            const newCustomer = {
                userEmail: { S: req.userEmail },
                customerEmail: { S: email },
                email: { S: email },
                customerName: { S: customerName },
                description: { S: description },
            };
            yield ddbClient_1.default.send(new client_dynamodb_1.PutItemCommand({
                TableName: "Customers",
                Item: newCustomer,
                ConditionExpression: "userEmail <> :userEmail AND customerEmail <> :customerEmail",
                ExpressionAttributeValues: {
                    ":userEmail": { S: req.userEmail },
                    ":customerEmail": { S: email },
                },
                ReturnValues: "ALL_OLD",
            }));
            const createdCustomer = yield ddbClient_1.default.send(new client_dynamodb_1.GetItemCommand({
                TableName: "Customers",
                Key: {
                    userEmail: { S: req.userEmail },
                    customerEmail: { S: email },
                },
                AttributesToGet: [
                    "customerEmail",
                    "email",
                    "customerName",
                    "description",
                ],
            }));
            if (createdCustomer.Item) {
                res.status(201).send({
                    customerEmail: createdCustomer.Item.customerEmail.S,
                    email: createdCustomer.Item.email.S,
                    customerName: createdCustomer.Item.customerName.S,
                    description: createdCustomer.Item.description.S,
                });
            }
            else {
                next((0, http_errors_1.default)(404, "Faild to retrive created user"));
            }
        }
        else {
            next((0, http_errors_1.default)(400, "Email not provided"));
        }
    }
    catch (error) {
        next(error);
    }
}));
customerRouter.get("/", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (req.userEmail) {
            const customers = yield ddbClient_1.default.send(new client_dynamodb_1.ScanCommand({
                FilterExpression: "userEmail = :userEmail",
                ExpressionAttributeValues: {
                    ":userEmail": { S: req.userEmail },
                },
                ProjectionExpression: "customerEmail, email, customerName, description, archived",
                TableName: "Customers",
            }));
            if (customers) {
                res.send((_a = customers.Items) === null || _a === void 0 ? void 0 : _a.map((customer) => {
                    var _a;
                    return {
                        customerEmail: customer.customerEmail.S,
                        email: customer.email.S,
                        customerName: customer.customerName.S,
                        description: customer.description.S,
                        archived: ((_a = customer.archived) === null || _a === void 0 ? void 0 : _a.BOOL) || false,
                    };
                }));
            }
            else {
                next((0, http_errors_1.default)(404, "Failed to retrive customers"));
            }
        }
        else {
            next((0, http_errors_1.default)(400, "Email not provided"));
        }
    }
    catch (error) {
        next(error);
    }
}));
customerRouter.get("/csv", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    try {
        if (req.userEmail) {
            const customers = yield ddbClient_1.default.send(new client_dynamodb_1.ScanCommand({
                FilterExpression: "userEmail = :userEmail ",
                ExpressionAttributeValues: {
                    ":userEmail": { S: req.userEmail },
                },
                ProjectionExpression: "email, customerName, description, archived",
                TableName: "Customers",
            }));
            if (customers.Items) {
                const json2csvParser = new Json2csvParser({
                    fields: ["email", "customerName", "description", "archived"],
                });
                const csvData = json2csvParser.parse((_b = customers.Items) === null || _b === void 0 ? void 0 : _b.map((customer) => {
                    var _a;
                    return {
                        email: customer.email.S,
                        customerName: customer.customerName.S,
                        description: customer.description.S,
                        archived: ((_a = customer.archived) === null || _a === void 0 ? void 0 : _a.BOOL) || false ? "yes" : "no",
                    };
                }));
                res.setHeader("Content-Disposition", "attachment; filename = customers.csv");
                res.set("Content-Type", "text/csv");
                res.status(200).end(csvData);
            }
            else {
                next((0, http_errors_1.default)(404, "Failed to retrive customers"));
            }
        }
        else {
            next((0, http_errors_1.default)(400, "Email not provided"));
        }
    }
    catch (error) {
        next(error);
    }
}));
customerRouter.put("/", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    try {
        if (req.userEmail) {
            const { customerEmail, email, customerName, description } = req.body;
            const updatedCustomer = yield ddbClient_1.default.send(new client_dynamodb_1.UpdateItemCommand({
                TableName: "Customers",
                Key: {
                    userEmail: { S: req.userEmail },
                    customerEmail: { S: customerEmail },
                },
                UpdateExpression: "set email = :email, customerName = :customerName, description = :description",
                ExpressionAttributeValues: {
                    ":email": { S: email },
                    ":customerName": { S: customerName },
                    ":description": { S: description },
                },
                ReturnValues: "ALL_NEW",
            }));
            if (updatedCustomer.Attributes) {
                res.send({
                    customerEmail: updatedCustomer.Attributes.customerEmail.S,
                    email: updatedCustomer.Attributes.email.S,
                    customerName: updatedCustomer.Attributes.customerName.S,
                    description: updatedCustomer.Attributes.description.S,
                    archived: ((_c = updatedCustomer.Attributes.archived) === null || _c === void 0 ? void 0 : _c.BOOL) || false,
                });
            }
            else {
                next((0, http_errors_1.default)(400, "Failed to update customer"));
            }
        }
        else {
            next((0, http_errors_1.default)(400));
        }
    }
    catch (error) {
        next(error);
    }
}));
customerRouter.put("/archive", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _d;
    try {
        if (req.userEmail) {
            const { customerEmail, archive } = req.body;
            const archivedCustomer = yield ddbClient_1.default.send(new client_dynamodb_1.UpdateItemCommand({
                TableName: "Customers",
                Key: {
                    userEmail: { S: req.userEmail },
                    customerEmail: { S: customerEmail },
                },
                UpdateExpression: "set archived = :archive",
                ExpressionAttributeValues: {
                    ":archive": { BOOL: archive },
                },
                ReturnValues: "ALL_NEW",
            }));
            if (archivedCustomer.Attributes) {
                res.send({
                    customerEmail: archivedCustomer.Attributes.customerEmail.S,
                    email: archivedCustomer.Attributes.email.S,
                    customerName: archivedCustomer.Attributes.customerName.S,
                    description: archivedCustomer.Attributes.description.S,
                    archived: ((_d = archivedCustomer.Attributes.archived) === null || _d === void 0 ? void 0 : _d.BOOL) || false,
                });
            }
            else {
                next((0, http_errors_1.default)(400, "Failed to update customer"));
            }
        }
        else {
            next((0, http_errors_1.default)(400));
        }
    }
    catch (error) {
        next(error);
    }
}));
exports.default = customerRouter;
