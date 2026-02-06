import jwt from "jsonwebtoken";

const DEFAULT_EXPIRY = "7d";

const generateInfluencerToken = (influencerId) => {
  const secret =
    process.env.INFLUENCER_JWT_SECRET ||
    process.env.JSON_WEB_TOKEN_SECRET_KEY ||
    "";

  if (!secret) {
    throw new Error(
      "INFLUENCER_JWT_SECRET or JSON_WEB_TOKEN_SECRET_KEY is not defined",
    );
  }

  return jwt.sign(
    { id: influencerId, role: "INFLUENCER" },
    secret,
    { expiresIn: DEFAULT_EXPIRY },
  );
};

export default generateInfluencerToken;
