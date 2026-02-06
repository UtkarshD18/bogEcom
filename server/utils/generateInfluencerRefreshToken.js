import jwt from "jsonwebtoken";
import InfluencerModel from "../models/influencer.model.js";

const DEFAULT_EXPIRY = "30d";

const generateInfluencerRefreshToken = async (influencerId) => {
  const secret =
    process.env.INFLUENCER_REFRESH_TOKEN_SECRET ||
    process.env.INFLUENCER_JWT_SECRET ||
    process.env.JSON_WEB_TOKEN_SECRET_KEY ||
    "";

  if (!secret) {
    throw new Error(
      "INFLUENCER_REFRESH_TOKEN_SECRET or INFLUENCER_JWT_SECRET is not defined",
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
