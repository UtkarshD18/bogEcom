import UserModel from "../models/user.model.js";
import jwt from "jsonwebtoken";
import {
  REFRESH_TOKEN_SECRET_KEYS,
  getRefreshTokenSecret,
} from "../config/authSecrets.js";

const generateRefreshToken = async (userId) => {
  const secret = getRefreshTokenSecret();
  if (!secret) {
    throw new Error(
      `Refresh token secret is not configured. Expected one of: ${REFRESH_TOKEN_SECRET_KEYS.join(", ")}`,
    );
  }

  const token = jwt.sign({ id: userId }, secret, { expiresIn: "7d" });

  await UserModel.updateOne(
    { _id: userId },
    { refreshToken: token },
  );

  return token;
};

export default generateRefreshToken;
