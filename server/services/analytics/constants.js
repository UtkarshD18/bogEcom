export const TRACKED_EVENT_TYPES = [
  "page_view",
  "page_view_started",
  "page_view_ended",
  "active_heartbeat",
  "product_view",
  "add_to_cart",
  "remove_from_cart",
  "checkout_started",
  "purchase_completed",
  "combo_view",
  "combo_click",
  "combo_add_to_cart",
  "combo_purchase",
  "search",
  "search_query",
  "results_count",
  "login",
  "signup",
  "logout",
  "click_event",
  "section_view_start",
  "section_view_end",
  "section_visible_duration",
  "scroll_depth",
  "rage_click",
  "hover_duration",
  "session_start",
  "session_end",
];

export const TRACKED_EVENT_SET = new Set(TRACKED_EVENT_TYPES);

export const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export const DEFAULT_ANALYTICS_PUBSUB_TOPIC = "user-behavior-events";
export const DEFAULT_ANALYTICS_SESSION_COOKIE = "hog_sid";
export const DEFAULT_ANALYTICS_CONSENT_COOKIE = "analytics_consent";
export const DEFAULT_TRACKING_BATCH_MAX_EVENTS = 500;
export const DEFAULT_TRACKING_BATCH_MAX_BYTES = 256 * 1024;

export const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /passcode/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /cookie/i,
  /otp/i,
  /cvv/i,
  /card/i,
  /iban/i,
  /ssn/i,
  /upi/i,
];

export const SENSITIVE_QUERY_KEYS = new Set([
  "token",
  "access_token",
  "refresh_token",
  "password",
  "secret",
  "code",
  "otp",
  "session",
]);
