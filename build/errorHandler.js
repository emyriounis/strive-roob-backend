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
const errorHandler = (error, req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    switch (error.status) {
        case 400:
            res.status(400).send(error.message || "Bad request");
            break;
        case 401:
            res.status(401).send(error.message || "Unauthorised");
            break;
        case 403:
            res.status(403).send(error.message || "Forbidden");
            break;
        case 404:
            res.status(404).send(error.message || "Not Found");
            break;
        case 409:
            res.status(409).send(error.message || "Conflict");
            break;
        default:
            console.log(error);
            res.status(500).send(error.name || "Unknown server error");
    }
});
exports.default = errorHandler;
