import { SendEmailCommand } from "@aws-sdk/client-ses";
import sesClient from "../db/sesClient";
const { SENDER_EMAIL_ADDRESS } = process.env;

const sendEmail = async (
  ToAddresses: string[],
  CcAddresses: string[],
  HtmlData: string,
  TextData: string,
  SubjectData: string
) =>
  await sesClient.send(
    new SendEmailCommand({
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
      Source: SENDER_EMAIL_ADDRESS as string,
      ReplyToAddresses: [SENDER_EMAIL_ADDRESS as string],
    })
  );

export default sendEmail;
