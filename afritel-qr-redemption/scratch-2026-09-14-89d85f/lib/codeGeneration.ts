import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';

/**
 * Convert UUID to Base62 for compact, URL-safe codes
 */
function uuidToBase62(uuid: string): string {
  // Remove hyphens from UUID
  const hex = uuid.replace(/-/g, '');
  // Convert hex to BigInt, then to Base62
  let num = BigInt(`0x${hex}`);
  const base62Alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';

  if (num === 0n) {
    return '0';
  }

  while (num > 0n) {
    result = base62Alphabet[Number(num % 62n)] + result;
    num = num / 62n;
  }

  return result;
}

/**
 * Generate a single unguessable redemption code
 */
export function generateRedemptionCode(): string {
  const uuid = uuidv4();
  return uuidToBase62(uuid);
}

/**
 * Generate a batch of redemption codes (max 5000 for v1)
 */
export function generateRedemptionCodeBatch(quantity: number): string[] {
  if (quantity > 5000) {
    throw new Error('Batch size cannot exceed 5000 codes for v1');
  }
  const codes = new Set<string>();
  while (codes.size < quantity) {
    codes.add(generateRedemptionCode());
  }
  return Array.from(codes);
}

/**
 * Generate QR code image for a redemption code
 * Returns data URI (data:image/png;base64,...)
 */
export async function generateQRCodeDataUri(code: string, appUrl: string): Promise<string> {
  const redemptionUrl = `${appUrl}/r/${code}`;
  const qrImage = await QRCode.toDataURL(redemptionUrl, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: 300,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
  return qrImage;
}

/**
 * Generate QR codes for a batch of redemption codes
 */
export async function generateQRCodesForBatch(
  codes: string[],
  appUrl: string
): Promise<Array<{ code: string; qrCodeDataUri: string }>> {
  const results = await Promise.all(
    codes.map(async (code) => ({
      code,
      qrCodeDataUri: await generateQRCodeDataUri(code, appUrl),
    }))
  );
  return results;
}
