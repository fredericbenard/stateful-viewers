import { t, type UiLocale } from "../i18n";

export function apiTimeoutMessage(locale: UiLocale, seconds: number): string {
  return t(locale, "apiErrors.requestTimedOut", { seconds });
}

export function apiNetworkUnreachableMessage(locale: UiLocale): string {
  return t(locale, "apiErrors.networkCouldNotReachServer");
}

export function apiRetriesExhaustedHint(locale: UiLocale): string {
  return t(locale, "apiErrors.retriesExhaustedHint");
}

export function apiHttpStatusErrorMessage(
  locale: UiLocale,
  provider: string,
  status: number,
  message: string,
  hint = ""
): string {
  return t(locale, "apiErrors.httpStatusError", { provider, status, message, hint });
}

export function apiNoContentReturnedMessage(
  locale: UiLocale,
  provider: string,
  hint = ""
): string {
  return t(locale, "apiErrors.noContentReturned", { provider, hint });
}

