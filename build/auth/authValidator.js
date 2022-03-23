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
const validatorJWT_1 = __importDefault(require("../tools/validatorJWT"));
const authValidator = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (req.cookies.accessToken) {
            const payload = yield (0, validatorJWT_1.default)(req.cookies.accessToken);
            if (payload.email) {
                req.userEmail = payload.email;
                next();
            }
            else {
                next((0, http_errors_1.default)(401, "Token not valid"));
            }
        }
        else {
            next((0, http_errors_1.default)(400, "No access token"));
        }
    }
    catch (error) {
        next(error);
    }
});
exports.default = authValidator;
