import bcrypt from "bcrypt";

const encryptPassword = async (plainPassword: string) =>
  await bcrypt.hash(plainPassword, 10);
// new Promise((resolve, reject) =>
//   jwt.verify(token, process.env.JWT_SECRET as string, (err, payload) => {
//     if (err) reject(err);
//     else resolve(payload);
//   })
// );

export default encryptPassword;

// const encryptedPassword = await bcrypt.hash(plainPassword, 10);
