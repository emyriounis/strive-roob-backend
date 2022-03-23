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
const invoiceRouter = (0, express_1.Router)();
const Json2csvParser = json2csv_1.default.Parser;
invoiceRouter.post("/", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        if (req.userEmail) {
            const { customerEmail, dueAt, products, notes } = req.body;
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
                    const currency = ((_a = dbProducts.Items) === null || _a === void 0 ? void 0 : _a.length) > 0 &&
                        new Set(dbProducts.Items.map((pr) => pr.currency.S)).size !== 1 &&
                        dbProducts.Items[0].currency.S;
                    if (!currency) {
                        next((0, http_errors_1.default)(400, "All products should have the same currency"));
                    }
                    else {
                        const invoicedProducts = products.filter((pr) => { var _a; return (_a = dbProducts.Items) === null || _a === void 0 ? void 0 : _a.map((pr) => pr.product.S).includes(pr.product); });
                        const amount = invoicedProducts
                            .map((pr) => pr.price * pr.quantity)
                            .reduce((a, b) => a + b);
                        const createdAt = Date.parse(Date().toString());
                        const newInvoice = {
                            userEmail: { S: req.userEmail },
                            amount: { N: amount.toString() },
                            currency: { S: currency },
                            createdAt: { N: createdAt.toString() },
                            customerEmail: { S: customer.Item.email.S || "" },
                            customerName: { S: customer.Item.customerName.S || "" },
                            dueAt: { N: dueAt.toString() },
                            products: {
                                L: invoicedProducts.map((pr) => {
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
                            paid: { BOOL: false },
                        };
                        yield ddbClient_1.default.send(new client_dynamodb_1.PutItemCommand({
                            TableName: "Invoices",
                            Item: newInvoice,
                            ConditionExpression: "userEmail <> :userEmail AND createdAt <> :createdAt",
                            ExpressionAttributeValues: {
                                ":userEmail": { S: req.userEmail },
                                ":createdAt": { N: createdAt.toString() },
                            },
                            ReturnValues: "ALL_OLD",
                        }));
                        const createdInvoice = yield ddbClient_1.default.send(new client_dynamodb_1.GetItemCommand({
                            TableName: "Invoices",
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
                                "dueAt",
                                "products",
                                "notes",
                                "paid",
                            ],
                        }));
                        console.log(createdInvoice);
                        if (createdInvoice.Item) {
                            console.log(createdInvoice.Item);
                            res.status(201).send({
                                amount: createdInvoice.Item.amount.N,
                                currency: createdInvoice.Item.currency.S,
                                createdAt: createdInvoice.Item.createdAt.N,
                                customerEmail: createdInvoice.Item.customerEmail.S,
                                customerName: createdInvoice.Item.customerName.S,
                                dueAt: createdInvoice.Item.dueAt.N,
                                products: (_b = createdInvoice.Item.products.L) === null || _b === void 0 ? void 0 : _b.map((item) => {
                                    var _a, _b, _c, _d, _e;
                                    return {
                                        product: (_a = item.M) === null || _a === void 0 ? void 0 : _a.product.S,
                                        productName: (_b = item.M) === null || _b === void 0 ? void 0 : _b.productName.S,
                                        currency: (_c = item.M) === null || _c === void 0 ? void 0 : _c.currency.S,
                                        price: (_d = item.M) === null || _d === void 0 ? void 0 : _d.price.N,
                                        quantity: (_e = item.M) === null || _e === void 0 ? void 0 : _e.quantity.N,
                                    };
                                }),
                                notes: createdInvoice.Item.notes.S,
                                paid: createdInvoice.Item.paid.BOOL,
                                status: createdInvoice.Item.paid.BOOL
                                    ? "Paid"
                                    : Number(createdInvoice.Item.dueAt.N) > Date.parse(Date())
                                        ? "Outstanding"
                                        : "Past Due",
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
invoiceRouter.get("/", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    try {
        if (req.userEmail) {
            const invoices = yield ddbClient_1.default.send(new client_dynamodb_1.ScanCommand({
                FilterExpression: "userEmail = :userEmail",
                ExpressionAttributeValues: {
                    ":userEmail": { S: req.userEmail },
                },
                ProjectionExpression: "amount, currency, createdAt, customerEmail, customerName, dueAt, products, notes, paid",
                TableName: "Invoices",
            }));
            if (invoices.Items) {
                res.send((_c = invoices.Items) === null || _c === void 0 ? void 0 : _c.map((invoice) => {
                    var _a;
                    return {
                        amount: invoice.amount.N,
                        currency: invoice.currency.S,
                        createdAt: invoice.createdAt.N,
                        customerEmail: invoice.customerEmail.S,
                        customerName: invoice.customerName.S,
                        dueAt: invoice.dueAt.N,
                        products: (_a = invoice.products.L) === null || _a === void 0 ? void 0 : _a.map((item) => {
                            var _a, _b, _c, _d, _e;
                            return {
                                product: (_a = item.M) === null || _a === void 0 ? void 0 : _a.product.S,
                                productName: (_b = item.M) === null || _b === void 0 ? void 0 : _b.productName.S,
                                currency: (_c = item.M) === null || _c === void 0 ? void 0 : _c.currency.S,
                                price: (_d = item.M) === null || _d === void 0 ? void 0 : _d.price.N,
                                quantity: (_e = item.M) === null || _e === void 0 ? void 0 : _e.quantity.N,
                            };
                        }),
                        notes: invoice.notes.S,
                        paid: invoice.paid.BOOL,
                        status: invoice.paid.BOOL
                            ? "Paid"
                            : Number(invoice.dueAt.N) > Date.parse(Date())
                                ? "Outstanding"
                                : "Past Due",
                    };
                }));
            }
            else {
                next((0, http_errors_1.default)(404, "Failed to retrive invoices"));
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
invoiceRouter.get("/paid", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _d;
    try {
        if (req.userEmail) {
            const invoices = yield ddbClient_1.default.send(new client_dynamodb_1.ScanCommand({
                FilterExpression: "userEmail = :userEmail AND paid = :paid",
                ExpressionAttributeValues: {
                    ":userEmail": { S: req.userEmail },
                    ":paid": { BOOL: true },
                },
                ProjectionExpression: "amount, currency, createdAt, customerEmail, customerName, dueAt, products, notes, paid, paidAt",
                TableName: "Invoices",
            }));
            if (invoices.Items) {
                res.send((_d = invoices.Items) === null || _d === void 0 ? void 0 : _d.map((invoice) => {
                    var _a;
                    return {
                        amount: invoice.amount.N,
                        currency: invoice.currency.S,
                        createdAt: invoice.createdAt.N,
                        customerEmail: invoice.customerEmail.S,
                        customerName: invoice.customerName.S,
                        dueAt: invoice.dueAt.N,
                        products: (_a = invoice.products.L) === null || _a === void 0 ? void 0 : _a.map((item) => {
                            var _a, _b, _c, _d, _e;
                            return {
                                product: (_a = item.M) === null || _a === void 0 ? void 0 : _a.product.S,
                                productName: (_b = item.M) === null || _b === void 0 ? void 0 : _b.productName.S,
                                currency: (_c = item.M) === null || _c === void 0 ? void 0 : _c.currency.S,
                                price: (_d = item.M) === null || _d === void 0 ? void 0 : _d.price.N,
                                quantity: (_e = item.M) === null || _e === void 0 ? void 0 : _e.quantity.N,
                            };
                        }),
                        notes: invoice.notes.S,
                        paid: invoice.paid.BOOL,
                        paidAt: invoice.paidAt.N,
                        status: invoice.paid.BOOL
                            ? "Paid"
                            : Number(invoice.dueAt.N) > Date.parse(Date())
                                ? "Outstanding"
                                : "Past Due",
                    };
                }));
            }
            else {
                next((0, http_errors_1.default)(404, "Failed to retrive invoices"));
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
invoiceRouter.get("/csv", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _e;
    try {
        if (req.userEmail) {
            const invoices = yield ddbClient_1.default.send(new client_dynamodb_1.ScanCommand({
                FilterExpression: "userEmail = :userEmail",
                ExpressionAttributeValues: {
                    ":userEmail": { S: req.userEmail },
                },
                ProjectionExpression: "amount, currency, createdAt, customerEmail, customerName, dueAt, products, notes, paid",
                TableName: "Invoices",
            }));
            if (invoices.Items) {
                const json2csvParser = new Json2csvParser({
                    fields: [
                        "amount",
                        "currency",
                        "createdAt",
                        "customerEmail",
                        "customerName",
                        "dueAt",
                        "products",
                        "notes",
                        "status",
                    ],
                });
                const csvData = json2csvParser.parse((_e = invoices.Items) === null || _e === void 0 ? void 0 : _e.map((invoice) => {
                    var _a;
                    return {
                        amount: invoice.amount.N,
                        currency: invoice.currency.S,
                        createdAt: invoice.createdAt.N,
                        customerEmail: invoice.customerEmail.S,
                        customerName: invoice.customerName.S,
                        dueAt: invoice.dueAt.N,
                        products: (_a = invoice.products.L) === null || _a === void 0 ? void 0 : _a.map((item) => {
                            var _a, _b, _c, _d, _e;
                            return {
                                product: (_a = item.M) === null || _a === void 0 ? void 0 : _a.product.S,
                                productName: (_b = item.M) === null || _b === void 0 ? void 0 : _b.productName.S,
                                currency: (_c = item.M) === null || _c === void 0 ? void 0 : _c.currency.S,
                                price: (_d = item.M) === null || _d === void 0 ? void 0 : _d.price.N,
                                quantity: (_e = item.M) === null || _e === void 0 ? void 0 : _e.quantity.N,
                            };
                        }),
                        notes: invoice.notes.S,
                        status: invoice.paid.BOOL
                            ? "Paid"
                            : Number(invoice.dueAt.N) > Date.parse(Date())
                                ? "Outstanding"
                                : "Past Due",
                    };
                }));
                res.setHeader("Content-Disposition", "attachment; filename = invoices.csv");
                res.set("Content-Type", "text/csv");
                res.status(200).end(csvData);
            }
            else {
                next((0, http_errors_1.default)(404, "Failed to retrive invoices"));
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
// invoiceRouter.put(
//   "/",
//   authValidator,
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       if (req.userEmail) {
//         const { customerEmail, email, customerName, description } = req.body;
//         const updatedCustomer = await ddbClient.send(
//           new UpdateItemCommand({
//             TableName: "Customers",
//             Key: {
//               userEmail: { S: req.userEmail },
//               customerEmail: { S: customerEmail },
//             },
//             UpdateExpression:
//               "set email = :email, customerName = :customerName, description = :description",
//             ExpressionAttributeValues: {
//               ":email": { S: email },
//               ":customerName": { S: customerName },
//               ":description": { S: description },
//             },
//             ReturnValues: "ALL_NEW",
//           })
//         );
//         if (updatedCustomer.Attributes) {
//           res.send({
//             customerEmail: updatedCustomer.Attributes.customerEmail.S,
//             email: updatedCustomer.Attributes.email.S,
//             customerName: updatedCustomer.Attributes.customerName.S,
//             description: updatedCustomer.Attributes.description.S,
//             archived: updatedCustomer.Attributes.archived?.BOOL || false,
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
// invoiceRouter.put(
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
exports.default = invoiceRouter;
