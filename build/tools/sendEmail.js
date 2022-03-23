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
const client_ses_1 = require("@aws-sdk/client-ses");
const sesClient_1 = __importDefault(require("../db/sesClient"));
const { SENDER_EMAIL_ADDRESS } = process.env;
const sendEmail = (ToAddresses, CcAddresses, HtmlData, TextData, SubjectData) => __awaiter(void 0, void 0, void 0, function* () {
    return yield sesClient_1.default.send(new client_ses_1.SendEmailCommand({
        Destination: {
            CcAddresses,
            ToAddresses,
        },
        Message: {
            Body: {
                // Html: {
                //   Charset: "UTF-8",
                //   Data: HtmlData,
                // },
                Text: {
                    Charset: "UTF-8",
                    Data: TextData,
                },
            },
            Subject: {
                Charset: "UTF-8",
                Data: SubjectData,
            },
        },
        Source: SENDER_EMAIL_ADDRESS,
        ReplyToAddresses: [SENDER_EMAIL_ADDRESS],
    }));
});
exports.default = sendEmail;
