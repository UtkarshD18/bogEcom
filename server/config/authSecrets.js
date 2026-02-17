const normalizeEnvValue = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : "";
};

const readFirstDefinedEnv = (keys) => {
  for (const key of keys) {
    const value = normalizeEnvValue(process.env[key]);
    if (value) {
      return value;
    }
  }
  return "";
};

export const ACCESS_TOKEN_SECRET_KEYS = Object.freeze([
  "ACCESS_TOKEN_SECRET",
  "SECRET_KEY_ACCESS_TOKEN",
  "JSON_WEB_TOKEN_SECRET_KEY",
  "JWT_SECRET",
]);

export const REFRESH_TOKEN_SECRET_KEYS = Object.freeze([
  "REFRESH_TOKEN_SECRET",
  "SECRET_KEY_REFRESH_TOKEN",
  "JSON_WEB_TOKEN_SECRET_KEY",
  "JWT_SECRET",
]);

export const INFLUENCER_ACCESS_TOKEN_SECRET_KEYS = Object.freeze([
  "INFLUENCER_JWT_SECRET",
  "ACCESS_TOKEN_SECRET",
  "SECRET_KEY_ACCESS_TOKEN",
  "JSON_WEB_TOKEN_SECRET_KEY",
  "JWT_SECRET",
]);

export const INFLUENCER_REFRESH_TOKEN_SECRET_KEYS = Object.freeze([
  "INFLUENCER_REFRESH_TOKEN_SECRET",
  "INFLUENCER_JWT_SECRET",
  "REFRESH_TOKEN_SECRET",
  "SECRET_KEY_REFRESH_TOKEN",
  "JSON_WEB_TOKEN_SECRET_KEY",
  "JWT_SECRET",
]);

export const getAccessTokenSecret = () =>
  readFirstDefinedEnv(ACCESS_TOKEN_SECRET_KEYS);

export const getRefreshTokenSecret = () =>
  readFirstDefinedEnv(REFRESH_TOKEN_SECRET_KEYS);

export const getInfluencerAccessTokenSecret = () =>
  readFirstDefinedEnv(INFLUENCER_ACCESS_TOKEN_SECRET_KEYS);

export const getInfluencerRefreshTokenSecret = () =>
  readFirstDefinedEnv(INFLUENCER_REFRESH_TOKEN_SECRET_KEYS);
