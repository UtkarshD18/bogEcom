import jwt from "jsonwebtoken";
import InfluencerModel from "../models/influencer.model.js";
import {
  INFLUENCER_REFRESH_TOKEN_SECRET_KEYS,
  getInfluencerRefreshTokenSecret,
} from "../config/authSecrets.js";

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

  await InfluencerModel.updateOne(
    { _id: influencerId },
    { refreshToken: token },
  );

  return token;
};

export default generateInfluencerRefreshToken;
