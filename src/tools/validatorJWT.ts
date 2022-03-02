import jwt from "jsonwebtoken";

const validatorJWT = (token: string) =>
  new Promise((resolve, reject) =>
    jwt.verify(token, process.env.JWT_SECRET as string, (err, payload) => {
      if (err) reject(err);
      else resolve(payload);
    })
  );

export default validatorJWT;
