import bcrypt from "bcrypt";

const authenticatePassword = async (
  plainPassword: string,
  encryptedPassword: string
) => await bcrypt.compare(plainPassword, encryptedPassword);

export default authenticatePassword;
