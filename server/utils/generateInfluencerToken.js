import jwt from "jsonwebtoken";
import {
  INFLUENCER_ACCESS_TOKEN_SECRET_KEYS,
  getInfluencerAccessTokenSecret,
} from "../config/authSecrets.js";

const DEFAULT_EXPIRY = "7d";

const generateInfluencerToken = (influencerId) => {
  const secret = getInfluencerAccessTokenSecret();

  if (!secret) {
    throw new Error(
      `Influencer access token secret is not configured. Expected one of: ${INFLUENCER_ACCESS_TOKEN_SECRET_KEYS.join(", ")}`,
    );
  }

  return jwt.sign(
    { id: influencerId, role: "INFLUENCER" },
    secret,
    { expiresIn: DEFAULT_EXPIRY },
  );
};

export default generateInfluencerToken;
