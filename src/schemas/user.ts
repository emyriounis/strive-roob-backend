import bcrypt from "bcrypt";
import { Schema, model } from "mongoose";
import { UserDocument, UserModel } from "../types/user";

const userSchema = new Schema<UserDocument>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String },
    refreshToken: { type: String },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  const user = this;
  const plainPassword = user.password;

  if (plainPassword && user.isModified("password")) {
    const encryptedPassword = await bcrypt.hash(plainPassword, 10);
    user.password = encryptedPassword;
  }

  next();
});

userSchema.methods.toJSON = function () {
  const userDocument = this;
  const userObject = userDocument.toObject();

  delete userObject.password;
  delete userObject.refreshToken;
  delete userObject.createdAt;
  delete userObject.updatedAt;
  delete userObject.__v;

  return userObject;
};

userSchema.statics.authenticate = async function (
  identifier: string,
  plainPassword: string
) {
  const user: UserDocument = await this.findOne({ email: identifier });

  if (user && user.password) {
    const isMatch = await bcrypt.compare(plainPassword, user.password);

    if (isMatch) {
      return user;
    } else {
      return null;
    }
  } else {
    return null;
  }
};

export default model<UserDocument, UserModel>("User", userSchema);
