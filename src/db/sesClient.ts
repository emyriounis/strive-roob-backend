import { SESClient } from "@aws-sdk/client-ses";

const sesClient = new SESClient({ region: process.env.AWS_REGION });

export default sesClient;
