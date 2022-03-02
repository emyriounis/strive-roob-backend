import { Document, Model } from "mongoose";

export interface UserType {
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  avatar?: string;
  refreshToken?: string;
}

export interface UserDocument extends Document, UserType {}

export interface UserModel extends Model<UserDocument> {
  authenticate(
    identifier: string,
    plainPassword: string
  ): Promise<UserDocument | null>;
}
