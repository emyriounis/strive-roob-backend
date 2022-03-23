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
const subscriptionRouter = (0, express_1.Router)();
const Json2csvParser = json2csv_1.default.Parser;
subscriptionRouter.post("/", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (req.userEmail) {
            const { customerEmail, startAt, freeTrialDays, endAt, products, notes, } = req.body;
            if (!customerEmail) {
                next((0, http_errors_1.default)(400, "No customer provided"));
            }
            else if (products.lenght <= 0) {
                next((0, http_errors_1.default)(400, "No customer provided"));
            }
            else {
                const customer = yield ddbClient_1.default.send(new client_dynamodb_1.GetItemCommand({
                    TableName: "Customers",
                    Key: {
                        userEmail: { S: req.userEmail },
                        customerEmail: { S: customerEmail },
                    },
                    AttributesToGet: ["email", "customerName"],
                }));
                const dbProducts = yield ddbClient_1.default.send(new client_dynamodb_1.ScanCommand({
                    FilterExpression: `userEmail = :userEmail`,
                    ExpressionAttributeValues: {
                        ":userEmail": { S: req.userEmail },
                    },
                    ProjectionExpression: "product, productName, currency, price, archived",
                    TableName: "Products",
                }));
                if (customer.Item && dbProducts.Items) {
                    const invoicedSubscriptions = products.filter((pr) => { var _a; return (_a = dbProducts.Items) === null || _a === void 0 ? void 0 : _a.map((pr) => pr.product.S).includes(pr.product); });
                    const currency = invoicedSubscriptions.length > 0 &&
                        new Set(invoicedSubscriptions.map((pr) => pr.currency))
                            .size === 1 &&
                        invoicedSubscriptions[0].currency;
                    const recurring = invoicedSubscriptions.length > 0 &&
                        new Set(invoicedSubscriptions.map((pr) => pr.recurring))
                            .size === 1 &&
                        invoicedSubscriptions[0].recurring;
                    if (!currency) {
                        next((0, http_errors_1.default)(400, "All products should have the same currency"));
                    }
                    else if (!recurring) {
                        next((0, http_errors_1.default)(400, "All products should have the same recurring period"));
                    }
                    else {
                        const amount = invoicedSubscriptions
                            .map((pr) => pr.price * pr.quantity)
                            .reduce((a, b) => a + b);
                        const createdAt = Date.parse(Date().toString());
                        const recurringEveryDays = recurring === "year"
                            ? 365
                            : recurring === "month"
                                ? 30
                                : recurring === "day"
                                    ? 1
                                    : 0;
                        const nextInvoiceAt = freeTrialDays === 0
                            ? startAt
                            : startAt + freeTrialDays * 24 * 60 * 60 * 1000;
                        const newSubscription = {
                            userEmail: { S: req.userEmail },
                            amount: { N: amount.toString() },
                            currency: { S: currency },
                            createdAt: { N: createdAt.toString() },
                            customerEmail: { S: customer.Item.email.S || "" },
                            customerName: { S: customer.Item.customerName.S || "" },
                            startAt: { N: startAt.toString() },
                            freeTrialDays: { N: freeTrialDays.toString() },
                            recurringEveryDays: { N: recurringEveryDays.toString() },
                            nextInvoiceAt: { N: nextInvoiceAt.toString() },
                            endAt: { N: endAt.toString() },
                            products: {
                                L: invoicedSubscriptions.map((pr) => {
                                    return {
                                        M: {
                                            product: {
                                                S: pr.product,
                                            },
                                            currency: {
                                                S: pr.currency,
                                            },
                                            quantity: {
                                                N: pr.quantity.toString(),
                                            },
                                            productName: {
                                                S: pr.productName,
                                            },
                                            price: {
                                                N: pr.price.toString(),
                                            },
                                        },
                                    };
                                }),
                            },
                            notes: { S: notes },
                            canceled: { BOOL: false },
                        };
                        yield ddbClient_1.default.send(new client_dynamodb_1.PutItemCommand({
                            TableName: "Subscriptions",
                            Item: newSubscription,
                            ConditionExpression: "userEmail <> :userEmail AND createdAt <> :createdAt",
                            ExpressionAttributeValues: {
                                ":userEmail": { S: req.userEmail },
                                ":createdAt": { N: createdAt.toString() },
                            },
                            ReturnValues: "ALL_OLD",
                        }));
                        const createdSubscription = yield ddbClient_1.default.send(new client_dynamodb_1.GetItemCommand({
                            TableName: "Subscriptions",
                            Key: {
                                userEmail: { S: req.userEmail },
                                createdAt: { N: createdAt.toString() },
                            },
                            AttributesToGet: [
                                "amount",
                                "currency",
                                "createdAt",
                                "customerEmail",
                                "customerName",
                                "startAt",
                                "freeTrialDays",
                                "recurringEveryDays",
                                "endAt",
                                "products",
                                "notes",
                                "canceled",
                            ],
                        }));
                        console.log(createdSubscription);
                        if (createdSubscription.Item) {
                            console.log(createdSubscription.Item);
                            res.status(201).send({
                                amount: createdSubscription.Item.amount.N,
                                currency: createdSubscription.Item.currency.S,
                                createdAt: createdSubscription.Item.createdAt.N,
                                customerEmail: createdSubscription.Item.customerEmail.S,
                                customerName: createdSubscription.Item.customerName.S,
                                startAt: createdSubscription.Item.startAt.N,
                                freeTrialDays: createdSubscription.Item.freeTrialDays.N,
                                recurringEveryDays: createdSubscription.Item.recurringEveryDays.N,
                                endAt: createdSubscription.Item.endAt.N,
                                products: (_a = createdSubscription.Item.products.L) === null || _a === void 0 ? void 0 : _a.map((item) => {
                                    var _a, _b, _c, _d, _e;
                                    return {
                                        product: (_a = item.M) === null || _a === void 0 ? void 0 : _a.product.S,
                                        productName: (_b = item.M) === null || _b === void 0 ? void 0 : _b.productName.S,
                                        currency: (_c = item.M) === null || _c === void 0 ? void 0 : _c.currency.S,
                                        price: (_d = item.M) === null || _d === void 0 ? void 0 : _d.price.N,
                                        quantity: (_e = item.M) === null || _e === void 0 ? void 0 : _e.quantity.N,
                                    };
                                }),
                                notes: createdSubscription.Item.notes.S,
                                canceled: createdSubscription.Item.canceled.BOOL,
                                status: createdSubscription.Item.canceled.BOOL
                                    ? "Canceled"
                                    : Number(createdSubscription.Item.endAt.N) <
                                        Date.parse(Date())
                                        ? "Completed"
                                        : Number(createdSubscription.Item.startAt.N) >
                                            Date.parse(Date())
                                            ? "Scheduled"
                                            : "Current",
                            });
                        }
                        else {
                            next((0, http_errors_1.default)(404, "Faild to retrive created user"));
                        }
                    }
                }
                else {
                    next((0, http_errors_1.default)(400, "Could not verify provided data"));
                }
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
subscriptionRouter.get("/", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    try {
        if (req.userEmail) {
            const subscriptions = yield ddbClient_1.default.send(new client_dynamodb_1.ScanCommand({
                FilterExpression: "userEmail = :userEmail",
                ExpressionAttributeValues: {
                    ":userEmail": { S: req.userEmail },
                },
                ProjectionExpression: "amount, currency, createdAt, customerEmail, customerName, startAt, freeTrialDays, recurringEveryDays, endAt, products, notes, canceled",
                TableName: "Subscriptions",
            }));
            if (subscriptions.Items) {
                res.send((_b = subscriptions.Items) === null || _b === void 0 ? void 0 : _b.map((subscription) => {
                    var _a;
                    return {
                        amount: subscription.amount.N,
                        currency: subscription.currency.S,
                        createdAt: subscription.createdAt.N,
                        customerEmail: subscription.customerEmail.S,
                        customerName: subscription.customerName.S,
                        startAt: subscription.startAt.N,
                        freeTrialDays: subscription.freeTrialDays.N,
                        recurringEveryDays: subscription.recurringEveryDays.N,
                        endAt: subscription.endAt.N,
                        products: (_a = subscription.products.L) === null || _a === void 0 ? void 0 : _a.map((item) => {
                            var _a, _b, _c, _d, _e;
                            return {
                                product: (_a = item.M) === null || _a === void 0 ? void 0 : _a.product.S,
                                productName: (_b = item.M) === null || _b === void 0 ? void 0 : _b.productName.S,
                                currency: (_c = item.M) === null || _c === void 0 ? void 0 : _c.currency.S,
                                price: (_d = item.M) === null || _d === void 0 ? void 0 : _d.price.N,
                                quantity: (_e = item.M) === null || _e === void 0 ? void 0 : _e.quantity.N,
                            };
                        }),
                        notes: subscription.notes.S,
                        canceled: subscription.canceled.BOOL,
                        status: subscription.canceled.BOOL
                            ? "Canceled"
                            : Number(subscription.endAt.N) < Date.parse(Date())
                                ? "Completed"
                                : Number(subscription.startAt.N) > Date.parse(Date())
                                    ? "Scheduled"
                                    : "Current",
                    };
                }));
            }
            else {
                next((0, http_errors_1.default)(404, "Failed to retrive subscriptions"));
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
subscriptionRouter.get("/csv", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    try {
        if (req.userEmail) {
            const subscriptions = yield ddbClient_1.default.send(new client_dynamodb_1.ScanCommand({
                FilterExpression: "userEmail = :userEmail",
                ExpressionAttributeValues: {
                    ":userEmail": { S: req.userEmail },
                },
                ProjectionExpression: "amount, currency, createdAt, customerEmail, customerName, startAt, freeTrialDays, recurringEveryDays, endAt, products, notes, canceled",
                TableName: "Subscriptions",
            }));
            if (subscriptions.Items) {
                const json2csvParser = new Json2csvParser({
                    fields: [
                        "amount",
                        "currency",
                        "createdAt",
                        "customerEmail",
                        "customerName",
                        "startAt",
                        "freeTrialDays",
                        "recurringEveryDays",
                        "endAt",
                        "products",
                        "notes",
                        "status",
                    ],
                });
                const csvData = json2csvParser.parse((_c = subscriptions.Items) === null || _c === void 0 ? void 0 : _c.map((subscription) => {
                    var _a;
                    return {
                        amount: subscription.amount.N,
                        currency: subscription.currency.S,
                        createdAt: subscription.createdAt.N,
                        customerEmail: subscription.customerEmail.S,
                        customerName: subscription.customerName.S,
                        startAt: subscription.startAt.N,
                        freeTrialDays: subscription.freeTrialDays.N,
                        recurringEveryDays: subscription.recurringEveryDays.N,
                        endAt: subscription.endAt.N,
                        products: (_a = subscription.products.L) === null || _a === void 0 ? void 0 : _a.map((item) => {
                            var _a, _b, _c, _d, _e;
                            return {
                                product: (_a = item.M) === null || _a === void 0 ? void 0 : _a.product.S,
                                productName: (_b = item.M) === null || _b === void 0 ? void 0 : _b.productName.S,
                                currency: (_c = item.M) === null || _c === void 0 ? void 0 : _c.currency.S,
                                price: (_d = item.M) === null || _d === void 0 ? void 0 : _d.price.N,
                                quantity: (_e = item.M) === null || _e === void 0 ? void 0 : _e.quantity.N,
                            };
                        }),
                        notes: subscription.notes.S,
                        canceled: subscription.canceled.BOOL,
                        status: subscription.canceled.BOOL
                            ? "Canceled"
                            : Number(subscription.endAt.N) < Date.parse(Date())
                                ? "Completed"
                                : Number(subscription.startAt.N) > Date.parse(Date())
                                    ? "Scheduled"
                                    : "Current",
                    };
                }));
                res.setHeader("Content-Disposition", "attachment; filename = subscriptions.csv");
                res.set("Content-Type", "text/csv");
                res.status(200).end(csvData);
            }
            else {
                next((0, http_errors_1.default)(404, "Failed to retrive subscriptions"));
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
subscriptionRouter.put("/", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _d;
    try {
        if (req.userEmail) {
            const { endAt, createdAt, canceled } = req.body;
            const updatedSubscription = yield ddbClient_1.default.send(new client_dynamodb_1.UpdateItemCommand({
                TableName: "Subscriptions",
                Key: {
                    userEmail: { S: req.userEmail },
                    createdAt: { N: createdAt.toString() },
                },
                UpdateExpression: "set endAt = :endAt, canceled = :canceled",
                ExpressionAttributeValues: {
                    ":endAt": { N: endAt.toString() },
                    ":canceled": { BOOL: canceled },
                },
                ReturnValues: "ALL_NEW",
            }));
            if (updatedSubscription.Attributes) {
                res.send({
                    amount: updatedSubscription.Attributes.amount.N,
                    currency: updatedSubscription.Attributes.currency.S,
                    createdAt: updatedSubscription.Attributes.createdAt.N,
                    customerEmail: updatedSubscription.Attributes.customerEmail.S,
                    customerName: updatedSubscription.Attributes.customerName.S,
                    startAt: updatedSubscription.Attributes.startAt.N,
                    freeTrialDays: updatedSubscription.Attributes.freeTrialDays.N,
                    recurringEveryDays: updatedSubscription.Attributes.recurringEveryDays.N,
                    endAt: updatedSubscription.Attributes.endAt.N,
                    products: (_d = updatedSubscription.Attributes.products.L) === null || _d === void 0 ? void 0 : _d.map((item) => {
                        var _a, _b, _c, _d, _e;
                        return {
                            product: (_a = item.M) === null || _a === void 0 ? void 0 : _a.product.S,
                            productName: (_b = item.M) === null || _b === void 0 ? void 0 : _b.productName.S,
                            currency: (_c = item.M) === null || _c === void 0 ? void 0 : _c.currency.S,
                            price: (_d = item.M) === null || _d === void 0 ? void 0 : _d.price.N,
                            quantity: (_e = item.M) === null || _e === void 0 ? void 0 : _e.quantity.N,
                        };
                    }),
                    notes: updatedSubscription.Attributes.notes.S,
                    canceled: updatedSubscription.Attributes.canceled.BOOL,
                    status: updatedSubscription.Attributes.canceled.BOOL
                        ? "Canceled"
                        : Number(updatedSubscription.Attributes.endAt.N) <
                            Date.parse(Date())
                            ? "Completed"
                            : Number(updatedSubscription.Attributes.startAt.N) >
                                Date.parse(Date())
                                ? "Scheduled"
                                : "Current",
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
// subscriptionRouter.put(
//   "/archive",
//   authValidator,
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       if (req.userEmail) {
//         const { customerEmail, archive } = req.body;
//         const archivedCustomer = await ddbClient.send(
//           new UpdateItemCommand({
//             TableName: "Customers",
//             Key: {
//               userEmail: { S: req.userEmail },
//               customerEmail: { S: customerEmail as string },
//             },
//             UpdateExpression: "set archived = :archive",
//             ExpressionAttributeValues: {
//               ":archive": { BOOL: archive },
//             },
//             ReturnValues: "ALL_NEW",
//           })
//         );
//         if (archivedCustomer.Attributes) {
//           res.send({
//             customerEmail: archivedCustomer.Attributes.customerEmail.S,
//             email: archivedCustomer.Attributes.email.S,
//             customerName: archivedCustomer.Attributes.customerName.S,
//             description: archivedCustomer.Attributes.description.S,
//             archived: archivedCustomer.Attributes.archived?.BOOL || false,
//           });
//         } else {
//           next(createHttpError(400, "Failed to update customer"));
//         }
//       } else {
//         next(createHttpError(400));
//       }
//     } catch (error) {
//       next(error);
//     }
//   }
// );
exports.default = subscriptionRouter;
