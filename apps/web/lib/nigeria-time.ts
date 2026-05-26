export const NIGERIA_TIME_ZONE = "Africa/Lagos";

const defaultTimeOptions: Intl.DateTimeFormatOptions = {
  timeZone: NIGERIA_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true
};

function toDate(value: string | number | Date) {
  return value instanceof Date ? value : new Date(value);
}

export function formatNigeriaTime(value: string | number | Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-NG", { ...defaultTimeOptions, ...options }).format(toDate(value));
}

export function formatNigeriaDateTime(value: string | number | Date) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: NIGERIA_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(toDate(value));
}

export function formatNigeriaClockLabel(value: string | number | Date) {
  return `${formatNigeriaDateTime(value)} WAT`;
}
