import jwt from "jsonwebtoken";
import {
  ACCESS_TOKEN_SECRET_KEYS,
  getAccessTokenSecret,
} from "../config/authSecrets.js";

const generateAccessToken = async (userId) => {
  const secret = getAccessTokenSecret();
  if (!secret) {
    throw new Error(
      `Access token secret is not configured. Expected one of: ${ACCESS_TOKEN_SECRET_KEYS.join(", ")}`,
    );
  }

  const token = jwt.sign({ id: userId }, secret, { expiresIn: "15m" });
  return token;
};

export default generateAccessToken;
