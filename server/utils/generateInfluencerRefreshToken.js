import jwt from "jsonwebtoken";
import InfluencerModel from "../models/influencer.model.js";
import {
  INFLUENCER_REFRESH_TOKEN_SECRET_KEYS,
  getInfluencerRefreshTokenSecret,
} from "../config/authSecrets.js";
import { hashTokenValue } from "./tokenHash.js";

const DEFAULT_EXPIRY = "30d";

const generateInfluencerRefreshToken = async (influencerId) => {
  const secret = getInfluencerRefreshTokenSecret();

  if (!secret) {
    throw new Error(
      `Influencer refresh token secret is not configured. Expected one of: ${INFLUENCER_REFRESH_TOKEN_SECRET_KEYS.join(", ")}`,
    );
  }

  const token = jwt.sign({ id: influencerId }, secret, {
    expiresIn: DEFAULT_EXPIRY,
  });
  const hashedToken = hashTokenValue(token);

  await InfluencerModel.updateOne(
    { _id: influencerId },
    { refreshToken: hashedToken || token },
  );

  return token;
};

export default generateInfluencerRefreshToken;
