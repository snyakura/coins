import { DerivApiError } from "./types";

/** Customer-safe message for any Deriv/internal error. Details go to server logs only. */
export function friendlyMessage(e: unknown): string {
  if (!(e instanceof DerivApiError)) return "Unable to process the transaction at the moment. Please try again later.";
  switch (e.code) {
    case "InvalidOTP": return "That verification code is incorrect. Please check it and try again.";
    case "OTPExpired": case "OTPValidationFailed": return "That verification code has expired. Please request a new one.";
    case "OtpRateLimitExceeded": case "OtpValidationRateLimitExceeded": return "Too many attempts. Please wait a moment before trying again.";
    case "WalletFundsInsufficient": return "Insufficient funds to complete this transaction.";
    case "NicknameNotFound": return "We couldn't find that Deriv account nickname. Please check it.";
    case "InvalidCurrency": case "AgentCurrencyUnsupported": return "This currency isn't supported.";
    case "InvalidAmount": case "WithdrawalAmountMinimum": case "WithdrawalAmountMaximum": return "That amount is outside the allowed limits.";
    case "DailyWithdrawalCountLimit": case "DailyWithdrawalAmountLimit": case "DailyTransferCountLimit": case "DailyTransferAmountLimit":
      return "Daily limit reached. Please try again tomorrow.";
    case "RequestIDUsed": return "This transaction was already submitted.";
    case "ClientCountryUnsupported": return "This service isn't available for your country.";
    case "Timeout": case "NetworkError": return "Deriv is taking longer than expected. We'll keep checking and update your status.";
    case "HTTP_401": return "Please reconnect your Deriv account.";
    default: return "Unable to process the transaction at the moment. Please try again later.";
  }
}

/** Token missing/expired/revoked: the customer must run the Connect flow again. */
export const needsReconnect = (e: unknown) => e instanceof DerivApiError && (e.httpStatus === 401 || e.code === "HTTP_401");
/** Deriv definitively refused (no money moved). Safe to mark FAILED. Excludes uncertain outcomes and duplicates. */
export const isDefiniteRejection = (e: unknown) =>
  e instanceof DerivApiError && !e.uncertain && e.httpStatus >= 400 && e.httpStatus < 500 && e.code !== "RequestIDUsed";
