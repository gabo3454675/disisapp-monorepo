import speakeasy from "speakeasy";

const TOTP_STEP_SECONDS = 60;
const TOTP_DIGITS = 6;

export function generateClientQrSecret(): string {
  const secret = speakeasy.generateSecret({ length: 20 });
  return secret.base32;
}

export function generateDynamicToken(clientSecret: string): string {
  return speakeasy.totp({
    secret: clientSecret,
    encoding: "base32",
    step: TOTP_STEP_SECONDS,
    digits: TOTP_DIGITS,
  });
}

export function verifyDynamicToken(token: string, clientSecret: string): boolean {
  return speakeasy.totp.verify({
    secret: clientSecret,
    encoding: "base32",
    token,
    step: TOTP_STEP_SECONDS,
    digits: TOTP_DIGITS,
    window: 0,
  });
}
