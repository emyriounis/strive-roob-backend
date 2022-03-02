import jwt from "jsonwebtoken";

const generatorJWT = (
  _id: string,
  expiresIn: string
): Promise<string | undefined> =>
  new Promise((resolve, reject) =>
    jwt.sign(
      { _id },
      process.env.JWT_SECRET as string,
      { expiresIn },
      (err: Error | null, token: string | undefined) => {
        if (err) reject(err);
        else resolve(token);
      }
    )
  );

export default generatorJWT;
