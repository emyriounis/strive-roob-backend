import bcrypt from "bcrypt";

const encryptPassword = async (plainPassword: string) =>
  await bcrypt.hash(plainPassword, 10);

export default encryptPassword;
