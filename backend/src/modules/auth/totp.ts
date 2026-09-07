import { OTP } from 'otplib';
import QRCode from 'qrcode';

const otp = new OTP(); // TOTP, 6 digits, 30s period, SHA-1

export function generateTotpSecret(): string {
  return otp.generateSecret();
}

export async function generateTotpQrCode(email: string, secret: string): Promise<string> {
  const uri = otp.generateURI({ issuer: 'Evently', label: email, secret });
  return QRCode.toDataURL(uri);
}

// epochTolerance absorbs clock drift between server and phone
export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const result = await otp.verify({ secret, token: code, epochTolerance: 30 });
  return result.valid;
}
