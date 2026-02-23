import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

export const IST_TIMEZONE = "Asia/Kolkata";
export const IST_TICKET_TIMESTAMP_FORMAT = "DD MMM YYYY, hh:mm a";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault(IST_TIMEZONE);

export const getIstNow = () => dayjs().tz(IST_TIMEZONE);

export const formatIstTicketTimestamp = (value) => {
  const source = value ? dayjs(value).tz(IST_TIMEZONE) : getIstNow();
  if (!source.isValid()) return "N/A";
  return source.format(IST_TICKET_TIMESTAMP_FORMAT);
};

export const getIstYear = (value) => {
  const source = value ? dayjs(value).tz(IST_TIMEZONE) : getIstNow();
  if (!source.isValid()) return getIstNow().format("YYYY");
  return source.format("YYYY");
};

export const buildIstTicketTimestampPayload = (value) => {
  const source = value ? dayjs(value).tz(IST_TIMEZONE) : getIstNow();
  const safeSource = source.isValid() ? source : getIstNow();

  return {
    formatted: safeSource.format(IST_TICKET_TIMESTAMP_FORMAT),
    unixMs: safeSource.valueOf(),
  };
};

export const parseIstDateBoundary = (value, { endOfDay = false } = {}) => {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return null;

  const timePart = endOfDay ? "23:59:59.999" : "00:00:00.000";
  const parsed = dayjs.tz(`${normalizedValue}T${timePart}`, IST_TIMEZONE);
  if (!parsed.isValid()) return null;

  return parsed.valueOf();
};

export default dayjs;
