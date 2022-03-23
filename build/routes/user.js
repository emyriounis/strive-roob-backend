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
const express_1 = require("express");
const http_errors_1 = __importDefault(require("http-errors"));
const multer_1 = __importDefault(require("multer"));
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const multer_s3_1 = __importDefault(require("multer-s3"));
const providerJWT_1 = __importDefault(require("../auth/providerJWT"));
const loginMiddleware_1 = __importDefault(require("../auth/loginMiddleware"));
const refreshMiddleware_1 = __importDefault(require("../auth/refreshMiddleware"));
const registerMiddleware_1 = __importDefault(require("../auth/registerMiddleware"));
const sendCookies_1 = __importDefault(require("../auth/sendCookies"));
const authValidator_1 = __importDefault(require("../auth/authValidator"));
const ddbClient_1 = __importDefault(require("../db/ddbClient"));
const fileUploaded_1 = __importDefault(require("../auth/fileUploaded"));
const generatorJWT_1 = __importDefault(require("../tools/generatorJWT"));
const validatorJWT_1 = __importDefault(require("../tools/validatorJWT"));
const encryptPassword_1 = __importDefault(require("../tools/encryptPassword"));
const sendEmail_1 = __importDefault(require("../tools/sendEmail"));
const userRouter = (0, express_1.Router)();
const { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, BUCKET_NAME, CDN_URL, SENDER_EMAIL_ADDRESS, FE_URL, } = process.env;
aws_sdk_1.default.config.update({
    region: AWS_REGION,
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
});
const s3 = new aws_sdk_1.default.S3();
const profileImageUploader = (0, multer_1.default)({
    storage: (0, multer_s3_1.default)({
        s3: s3,
        bucket: BUCKET_NAME,
        key: function (req, file, cb) {
            cb(null, file.originalname.split(".").reverse().pop() + Date.now());
        },
    }),
});
userRouter.post("/register", registerMiddleware_1.default, providerJWT_1.default, sendCookies_1.default);
userRouter.post("/login", loginMiddleware_1.default, providerJWT_1.default, sendCookies_1.default);
userRouter.post("/refresh", refreshMiddleware_1.default, providerJWT_1.default, sendCookies_1.default);
userRouter.post("/verifyEmail", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        if (req.body.token) {
            const payload = yield (0, validatorJWT_1.default)(req.body.token);
            if (payload.email) {
                const user = yield ddbClient_1.default.send(new client_dynamodb_1.UpdateItemCommand({
                    TableName: "Users",
                    Key: {
                        email: { S: payload.email },
                    },
                    UpdateExpression: "set emailVerified = :ev",
                    ExpressionAttributeValues: {
                        ":ev": { BOOL: true },
                    },
                    ReturnValues: "ALL_NEW",
                }));
                if (user.Attributes) {
                    res.send({
                        email: (_a = user.Attributes.email) === null || _a === void 0 ? void 0 : _a.S,
                        emailVerified: (_b = user.Attributes.emailVerified) === null || _b === void 0 ? void 0 : _b.S,
                    });
                }
                else {
                    next((0, http_errors_1.default)(404, "User not found"));
                }
            }
            else {
                next((0, http_errors_1.default)(400, "Token not valid"));
            }
        }
        else {
            next((0, http_errors_1.default)(400, "Please provide token"));
        }
    }
    catch (error) {
        if (error.name === "JsonWebTokenError") {
            next((0, http_errors_1.default)(400, "Token not valid"));
        }
        else {
            next(error);
        }
    }
}));
userRouter.post("/sendVerificationEmail", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (req.userEmail) {
            const token = yield (0, generatorJWT_1.default)(req.userEmail, "1w");
            yield (0, sendEmail_1.default)([req.userEmail], [], "", `You can validate your email here: ${process.env.FE_URL}/validateEmail/${token}\n\nIt is valid for 1 week`, "Roob. Validate your email");
        }
        else {
            next((0, http_errors_1.default)(400, "Email not provided"));
        }
    }
    catch (error) {
        next(error);
    }
}));
userRouter.post("/forgotPassword", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (req.body.email) {
            const user = yield ddbClient_1.default.send(new client_dynamodb_1.GetItemCommand({
                TableName: "Users",
                Key: {
                    email: { S: req.body.email },
                },
                AttributesToGet: ["email"],
            }));
            if (user.Item) {
                const token = yield (0, generatorJWT_1.default)(req.body.email, "1w");
                const email = yield (0, sendEmail_1.default)([req.body.email], [], "", `You can create a new password here: ${FE_URL}/resetPassword/${token}\n\nIt is valid for 1 week`, "Roob. Create new password");
                console.log(email);
                if (email) {
                    res.send({ emailSent: true });
                }
                else {
                    next((0, http_errors_1.default)(400, "Failed to send email"));
                }
            }
            else {
                next((0, http_errors_1.default)(404, "User does not exist"));
            }
        }
        else {
            next((0, http_errors_1.default)(400, "Please provide email"));
        }
    }
    catch (error) {
        next(error);
    }
}));
userRouter.post("/resetPassword", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { password, token } = req.body;
        const payload = yield (0, validatorJWT_1.default)(token);
        if (payload.email) {
            const user = yield ddbClient_1.default.send(new client_dynamodb_1.UpdateItemCommand({
                TableName: "Users",
                Key: {
                    email: { S: payload.email },
                },
                UpdateExpression: "set password = :pw",
                ExpressionAttributeValues: {
                    ":pw": { S: yield (0, encryptPassword_1.default)(password) },
                },
                ReturnValues: "ALL_NEW",
            }));
            if (user) {
                req.userEmail = payload.email;
                next();
            }
            else {
                next((0, http_errors_1.default)(400, "Failed to reset password"));
            }
        }
        else {
            next((0, http_errors_1.default)(400, "Token not valid"));
        }
    }
    catch (error) {
        next(error);
    }
}), providerJWT_1.default, sendCookies_1.default);
userRouter.post("/logout", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (req.userEmail) {
            yield ddbClient_1.default.send(new client_dynamodb_1.UpdateItemCommand({
                TableName: "Users",
                Key: {
                    email: { S: req.userEmail },
                },
                UpdateExpression: "set refreshToken = :rt",
                ExpressionAttributeValues: {
                    ":rt": { S: "" },
                },
                ReturnValues: "ALL_NEW",
            }));
        }
        res
            .clearCookie("accessToken")
            .clearCookie("refreshToken", {
            path: "/users/refresh",
        })
            .send({ logout: true });
        res.send();
    }
    catch (error) {
        next(error);
    }
}));
userRouter.get("/me", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _c, _d, _e, _f, _g;
    try {
        if (req.userEmail) {
            const user = yield ddbClient_1.default.send(new client_dynamodb_1.GetItemCommand({
                TableName: "Users",
                Key: {
                    email: { S: req.userEmail },
                },
                AttributesToGet: [
                    "email",
                    "firstName",
                    "lastName",
                    "avatar",
                    "emailVerified",
                ],
            }));
            if (user.Item) {
                res.send({
                    email: (_c = user.Item.email) === null || _c === void 0 ? void 0 : _c.S,
                    firstName: (_d = user.Item.firstName) === null || _d === void 0 ? void 0 : _d.S,
                    lastName: (_e = user.Item.lastName) === null || _e === void 0 ? void 0 : _e.S,
                    avatar: (_f = user.Item.avatar) === null || _f === void 0 ? void 0 : _f.S,
                    emailVerified: ((_g = user.Item.emailVerified) === null || _g === void 0 ? void 0 : _g.BOOL) || false,
                });
            }
            else {
                next((0, http_errors_1.default)(404, "User not found"));
            }
        }
        else {
            next((0, http_errors_1.default)(400, "Failed to authenticate user"));
        }
    }
    catch (error) {
        next(error);
    }
}));
userRouter.put("/me", authValidator_1.default, profileImageUploader.single("profileImage"), fileUploaded_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _h, _j, _k, _l, _m, _o, _p, _q;
    try {
        if (req.userEmail) {
            const user = yield ddbClient_1.default.send(new client_dynamodb_1.UpdateItemCommand({
                TableName: "Users",
                Key: {
                    email: { S: req.userEmail },
                },
                UpdateExpression: "set firstName = :fn, lastName = :ln",
                ExpressionAttributeValues: {
                    ":fn": { S: req.body.firstName },
                    ":ln": { S: req.body.lastName },
                },
                ReturnValues: "ALL_NEW",
            }));
            if (user.Attributes) {
                res.send({
                    email: (_j = (_h = user.Attributes) === null || _h === void 0 ? void 0 : _h.email) === null || _j === void 0 ? void 0 : _j.S,
                    firstName: (_l = (_k = user.Attributes) === null || _k === void 0 ? void 0 : _k.firstName) === null || _l === void 0 ? void 0 : _l.S,
                    lastName: (_o = (_m = user.Attributes) === null || _m === void 0 ? void 0 : _m.lastName) === null || _o === void 0 ? void 0 : _o.S,
                    avatar: (_q = (_p = user.Attributes) === null || _p === void 0 ? void 0 : _p.avatar) === null || _q === void 0 ? void 0 : _q.S,
                });
            }
            else {
                next((0, http_errors_1.default)(404, "User not found"));
            }
        }
        else {
            next((0, http_errors_1.default)(400, "Failed to authenticate user"));
        }
    }
    catch (error) {
        next(error);
    }
}));
userRouter.delete("/me", authValidator_1.default, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (req.userEmail) {
            const user = yield ddbClient_1.default.send(new client_dynamodb_1.DeleteItemCommand({
                TableName: "Users",
                Key: {
                    email: { S: req.userEmail },
                },
            }));
            console.log(user);
            if (user) {
                res
                    .status(204)
                    .clearCookie("accessToken")
                    .clearCookie("refreshToken", {
                    path: "/users/refresh",
                })
                    .send();
            }
            else {
                next((0, http_errors_1.default)(404, "User not found"));
            }
        }
        else {
            next((0, http_errors_1.default)(400, "Failed to authenticate user"));
        }
    }
    catch (error) {
        next(error);
    }
}));
exports.default = userRouter;
