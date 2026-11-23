/**
 * GSM 7-bit default alphabet character set (3GPP TS 23.038 / GSM 03.38).
 */
const GSM_7BIT_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
);

/**
 * GSM 7-bit extension table characters (each counts as 2 characters in GSM-7).
 * Escape character 0x1B prefix needed.
 */
const GSM_7BIT_EXTENDED = new Set('|^€{}[]~\\');

export type SmsEncoding = 'GSM_7' | 'UNICODE';

export interface SmsCalculationResult {
  encoding: SmsEncoding;
  charCount: number;
  /** Effective character units (accounting for 2-char escape sequences in GSM-7 or surrogate pairs in Unicode) */
  effectiveLength: number;
  segmentCount: number;
  segments: number;
  creditsNeeded: number;
  maxCharsPerSegment: number;
  charsRemainingInCurrentSegment: number;
}

/**
 * Accurately analyzes text and computes SMS segments and credit requirements
 * following international GSM 03.38 and UCS-2 standards adopted by SMSLenz.
 *
 * Rules:
 * - GSM-7:
 *   - Single message: up to 160 characters (1 segment)
 *   - Multipart: 153 characters per segment (7 septets reserved for UDH concatenation header)
 * - Unicode (Sinhala, Tamil, Arabic, Chinese, Emoji, etc.):
 *   - Single message: up to 70 characters (1 segment)
 *   - Multipart: 67 characters per segment (6 octets reserved for UDH concatenation header)
 */
export function calculateSmsSegments(
  text: string,
  creditsPerSegment: number = 1,
): SmsCalculationResult {
  if (!text || text.length === 0) {
    return {
      encoding: 'GSM_7',
      charCount: 0,
      effectiveLength: 0,
      segmentCount: 0,
      segments: 0,
      creditsNeeded: 0,
      maxCharsPerSegment: 160,
      charsRemainingInCurrentSegment: 160,
    };
  }

  let isUnicode = false;
  let gsmEffectiveLength = 0;

  for (const char of text) {
    if (GSM_7BIT_EXTENDED.has(char)) {
      gsmEffectiveLength += 2; // Extended character takes 2 GSM-7 septets
    } else if (GSM_7BIT_BASIC.has(char)) {
      gsmEffectiveLength += 1;
    } else {
      isUnicode = true;
      break;
    }
  }

  if (isUnicode) {
    // Unicode (UCS-2 / UTF-16)
    // In UCS-2, standard characters are 1 code unit, emoji / astral plane are 2 code units (surrogate pairs)
    // Array.from splits correctly by unicode code points
    const codePoints = Array.from(text);
    const length = codePoints.length;

    let segmentCount = 1;
    let maxCharsPerSegment = 70;
    let charsRemaining = 70 - length;

    if (length > 70) {
      maxCharsPerSegment = 67;
      segmentCount = Math.ceil(length / 67);
      const usedInLastSegment = length % 67 === 0 ? 67 : length % 67;
      charsRemaining = 67 - usedInLastSegment;
    }

    return {
      encoding: 'UNICODE',
      charCount: text.length,
      effectiveLength: length,
      segmentCount,
      segments: segmentCount,
      creditsNeeded: Math.max(1, segmentCount * creditsPerSegment),
      maxCharsPerSegment,
      charsRemainingInCurrentSegment: Math.max(0, charsRemaining),
    };
  }

  // Pure GSM-7
  let segmentCount = 1;
  let maxCharsPerSegment = 160;
  let charsRemaining = 160 - gsmEffectiveLength;

  if (gsmEffectiveLength > 160) {
    maxCharsPerSegment = 153;
    segmentCount = Math.ceil(gsmEffectiveLength / 153);
    const usedInLastSegment = gsmEffectiveLength % 153 === 0 ? 153 : gsmEffectiveLength % 153;
    charsRemaining = 153 - usedInLastSegment;
  }

  return {
    encoding: 'GSM_7',
    charCount: text.length,
    effectiveLength: gsmEffectiveLength,
    segmentCount,
    segments: segmentCount,
    creditsNeeded: Math.max(1, segmentCount * creditsPerSegment),
    maxCharsPerSegment,
    charsRemainingInCurrentSegment: Math.max(0, charsRemaining),
  };
}

/**
 * Masks a phone number for user privacy and security in UI & audit logs.
 * Example: "+94771234567" -> "+94 77 *** *567"
 * Example: "0771234567" -> "077 *** *567"
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return '—';
  const cleaned = phone.replace(/[\s\-()]/g, '');

  if (cleaned.length < 7) {
    return cleaned;
  }

  if (cleaned.startsWith('+94') && cleaned.length >= 11) {
    const prefix = cleaned.slice(0, 5); // +9477
    const suffix = cleaned.slice(-3); // 567
    return `${prefix.slice(0, 3)} ${prefix.slice(3)} *** *${suffix}`;
  }

  if (cleaned.startsWith('0') && cleaned.length >= 10) {
    const prefix = cleaned.slice(0, 3); // 077
    const suffix = cleaned.slice(-3); // 567
    return `${prefix} *** *${suffix}`;
  }

  const prefix = cleaned.slice(0, 3);
  const suffix = cleaned.slice(-3);
  return `${prefix}****${suffix}`;
}
