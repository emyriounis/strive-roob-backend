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
Object.defineProperty(exports, "__esModule", { value: true });
const sendCookies = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        res
            .cookie("accessToken", (_a = req.tokens) === null || _a === void 0 ? void 0 : _a.accessToken, {
            // domain: process.env.FE_URL,
            httpOnly: true,
            // secure: true, // only https requests
            maxAge: 15 * 60 * 1000,
        })
            .cookie("refreshToken", (_b = req.tokens) === null || _b === void 0 ? void 0 : _b.refreshToken, {
            // domain: process.env.FE_URL,
            path: "/users/refresh",
            httpOnly: true,
            // secure: true, // only https requests
            maxAge: 14 * 24 * 60 * 60 * 1000,
        })
            .send({ login: true, email: req.userEmail });
    }
    catch (error) {
        next(error);
    }
});
exports.default = sendCookies;
