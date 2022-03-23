"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_ses_1 = require("@aws-sdk/client-ses");
const sesClient = new client_ses_1.SESClient({ region: process.env.AWS_REGION });
exports.default = sesClient;
