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
const variableValidator_1 = __importDefault(require("../tools/variableValidator"));
const json2csv_1 = __importDefault(require("json2csv"));
const productRoute = (0, express_1.Router)();
const Json2csvParser = json2csv_1.default.Parser;
productRoute.post("/", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (req.userEmail) {
            const { product, productName, price, currency, recurring } = req.body;
            if ((0, variableValidator_1.default)(currency, ["usd", "eur", "gbp"]) &&
                (0, variableValidator_1.default)(recurring, [
                    "one-time",
                    "day",
                    "week",
                    "month",
                    "year",
                ])) {
                const newProduct = {
                    userEmail: { S: req.userEmail },
                    product: { S: productName },
                    productName: { S: productName },
                    price: { N: price.toString() },
                    currency: { S: currency },
                    recurring: { S: recurring },
                };
                yield ddbClient_1.default.send(new client_dynamodb_1.PutItemCommand({
                    TableName: "Products",
                    Item: newProduct,
                    ConditionExpression: "userEmail <> :userEmail AND product <> :product",
                    ExpressionAttributeValues: {
                        ":userEmail": { S: req.userEmail },
                        ":product": { S: productName },
                    },
                    ReturnValues: "ALL_OLD",
                }));
                const createdProduct = yield ddbClient_1.default.send(new client_dynamodb_1.GetItemCommand({
                    TableName: "Products",
                    Key: {
                        userEmail: { S: req.userEmail },
                        product: { S: productName },
                    },
                    AttributesToGet: [
                        "product",
                        "productName",
                        "price",
                        "currency",
                        "recurring",
                    ],
                }));
                if (createdProduct.Item) {
                    res.status(201).send({
                        product: createdProduct.Item.product.S,
                        productName: createdProduct.Item.productName.S,
                        recurring: createdProduct.Item.recurring.S,
                        currency: createdProduct.Item.currency.S,
                        price: createdProduct.Item.price.N,
                    });
                }
                else {
                    next((0, http_errors_1.default)(404, "Faild to retrive created product"));
                }
            }
            else {
                next((0, http_errors_1.default)(400, "Product info not valid"));
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
productRoute.get("/", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (req.userEmail) {
            const products = yield ddbClient_1.default.send(new client_dynamodb_1.ScanCommand({
                FilterExpression: "userEmail = :userEmail ",
                ExpressionAttributeValues: {
                    ":userEmail": { S: req.userEmail },
                },
                ProjectionExpression: "product, productName, price, currency, recurring, archived",
                TableName: "Products",
            }));
            if (products) {
                res.send((_a = products.Items) === null || _a === void 0 ? void 0 : _a.map((product) => {
                    var _a;
                    return {
                        product: product.product.S,
                        productName: product.productName.S,
                        recurring: product.recurring.S,
                        currency: product.currency.S,
                        price: product.price.N,
                        archived: ((_a = product.archived) === null || _a === void 0 ? void 0 : _a.BOOL) || false,
                    };
                }));
            }
            else {
                next((0, http_errors_1.default)(404, "Failed to retrive products"));
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
productRoute.get("/csv", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    try {
        if (req.userEmail) {
            const products = yield ddbClient_1.default.send(new client_dynamodb_1.ScanCommand({
                FilterExpression: "userEmail = :userEmail ",
                ExpressionAttributeValues: {
                    ":userEmail": { S: req.userEmail },
                },
                ProjectionExpression: "productName, price, currency, recurring, archived",
                TableName: "Products",
            }));
            if (products.Items) {
                const json2csvParser = new Json2csvParser({
                    fields: [
                        "productName",
                        "recurring",
                        "currency",
                        "price",
                        "archived",
                    ],
                });
                const csvData = json2csvParser.parse((_b = products.Items) === null || _b === void 0 ? void 0 : _b.map((product) => {
                    var _a;
                    return {
                        productName: product.productName.S,
                        recurring: product.recurring.S,
                        currency: product.currency.S,
                        price: product.price.N,
                        archived: ((_a = product.archived) === null || _a === void 0 ? void 0 : _a.BOOL) || false ? "yes" : "no",
                    };
                }));
                res.setHeader("Content-Disposition", "attachment; filename = products.csv");
                res.set("Content-Type", "text/csv");
                res.status(200).end(csvData);
            }
            else {
                next((0, http_errors_1.default)(404, "Failed to retrive products"));
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
productRoute.put("/", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    try {
        if (req.userEmail) {
            const { product, productName, price, currency, recurring } = req.body;
            const updatedProduct = yield ddbClient_1.default.send(new client_dynamodb_1.UpdateItemCommand({
                TableName: "Products",
                Key: {
                    userEmail: { S: req.userEmail },
                    product: { S: product },
                },
                UpdateExpression: "set productName = :productName, price = :price, currency = :currency, recurring = :recurring",
                ExpressionAttributeValues: {
                    ":productName": { S: productName },
                    ":price": { N: price.toString() },
                    ":currency": { S: currency },
                    ":recurring": { S: recurring },
                },
                ReturnValues: "ALL_NEW",
            }));
            if (updatedProduct.Attributes) {
                res.send({
                    product: updatedProduct.Attributes.product.S,
                    productName: updatedProduct.Attributes.productName.S,
                    recurring: updatedProduct.Attributes.recurring.S,
                    currency: updatedProduct.Attributes.currency.S,
                    price: updatedProduct.Attributes.price.N,
                    archived: ((_c = updatedProduct.Attributes.archived) === null || _c === void 0 ? void 0 : _c.BOOL) || false,
                });
            }
            else {
                next((0, http_errors_1.default)(400, "Failed to update product"));
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
productRoute.put("/archive", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _d;
    try {
        if (req.userEmail) {
            const { product, archive } = req.body;
            const archivedProduct = yield ddbClient_1.default.send(new client_dynamodb_1.UpdateItemCommand({
                TableName: "Products",
                Key: {
                    userEmail: { S: req.userEmail },
                    product: { S: product },
                },
                UpdateExpression: "set archived = :archive",
                ExpressionAttributeValues: {
                    ":archive": { BOOL: archive },
                },
                ReturnValues: "ALL_NEW",
            }));
            if (archivedProduct.Attributes) {
                res.send({
                    product: archivedProduct.Attributes.product.S,
                    productName: archivedProduct.Attributes.productName.S,
                    recurring: archivedProduct.Attributes.recurring.S,
                    currency: archivedProduct.Attributes.currency.S,
                    price: archivedProduct.Attributes.price.N,
                    archived: ((_d = archivedProduct.Attributes.archived) === null || _d === void 0 ? void 0 : _d.BOOL) || false,
                });
            }
            else {
                next((0, http_errors_1.default)(400, "Failed to update product"));
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
exports.default = productRoute;
