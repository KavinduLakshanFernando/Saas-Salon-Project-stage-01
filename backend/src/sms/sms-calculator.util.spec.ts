import {
  calculateSmsSegments,
  maskPhoneNumber,
} from './sms-calculator.util';

describe('sms-calculator.util', () => {
  describe('calculateSmsSegments', () => {
    it('handles empty message', () => {
      const res = calculateSmsSegments('');
      expect(res.segmentCount).toBe(0);
      expect(res.creditsNeeded).toBe(0);
      expect(res.encoding).toBe('GSM_7');
    });

    it('calculates single-part GSM-7 message (<= 160 chars)', () => {
      const msg = 'Dear customer, your appointment at Dart Smart Salon is confirmed for tomorrow.';
      const res = calculateSmsSegments(msg);
      expect(res.encoding).toBe('GSM_7');
      expect(res.charCount).toBe(msg.length);
      expect(res.segmentCount).toBe(1);
      expect(res.creditsNeeded).toBe(1);
    });

    it('calculates multi-part GSM-7 message (> 160 chars, 153 chars/segment)', () => {
      const msg = 'A'.repeat(161);
      const res = calculateSmsSegments(msg);
      expect(res.encoding).toBe('GSM_7');
      expect(res.segmentCount).toBe(2);
      expect(res.creditsNeeded).toBe(2);
      expect(res.maxCharsPerSegment).toBe(153);
    });

    it('handles extended GSM characters counting as 2 chars each', () => {
      // 10 euro signs = 20 effective chars
      const msg = '€'.repeat(10);
      const res = calculateSmsSegments(msg);
      expect(res.encoding).toBe('GSM_7');
      expect(res.effectiveLength).toBe(20);
      expect(res.segmentCount).toBe(1);
    });

    it('detects Unicode for Sinhala and calculates single-part (<= 70 chars)', () => {
      // Sinhala text: "ඔබගේ වේලාව වෙන්කරවා ගැනීම තහවුරු කරන ලදී."
      const sinhalaText = 'ඔබගේ වේලාව වෙන්කරවා ගැනීම තහවුරු කරන ලදී.';
      const res = calculateSmsSegments(sinhalaText);
      expect(res.encoding).toBe('UNICODE');
      expect(res.segmentCount).toBe(1);
      expect(res.creditsNeeded).toBe(1);
      expect(res.maxCharsPerSegment).toBe(70);
    });

    it('calculates multi-part Unicode for long Sinhala message (> 70 chars, 67 chars/segment)', () => {
      const longSinhala = 'ඔබගේ වේලාව වෙන්කරවා ගැනීම තහවුරු කරන ලදී. '.repeat(4); // > 100 chars
      const res = calculateSmsSegments(longSinhala);
      expect(res.encoding).toBe('UNICODE');
      expect(res.segmentCount).toBeGreaterThanOrEqual(2);
      expect(res.creditsNeeded).toBe(res.segmentCount);
      expect(res.maxCharsPerSegment).toBe(67);
    });

    it('detects Unicode for Tamil text', () => {
      const tamilText = 'உங்கள் முன்பதிவு உறுதி செய்யப்பட்டது.';
      const res = calculateSmsSegments(tamilText);
      expect(res.encoding).toBe('UNICODE');
      expect(res.segmentCount).toBe(1);
    });

    it('detects Unicode for emojis', () => {
      const emojiMsg = 'Thank you for visiting! 😊';
      const res = calculateSmsSegments(emojiMsg);
      expect(res.encoding).toBe('UNICODE');
    });

    it('respects custom credits per segment factor', () => {
      const msg = 'A'.repeat(161); // 2 segments
      const res = calculateSmsSegments(msg, 2);
      expect(res.segmentCount).toBe(2);
      expect(res.creditsNeeded).toBe(4);
    });
  });

  describe('maskPhoneNumber', () => {
    it('masks Sri Lankan +94 format phone numbers', () => {
      expect(maskPhoneNumber('+94771234567')).toBe('+94 77 *** *567');
    });

    it('masks Sri Lankan 0-prefixed phone numbers', () => {
      expect(maskPhoneNumber('0771234567')).toBe('077 *** *567');
    });

    it('handles empty or missing phone numbers gracefully', () => {
      expect(maskPhoneNumber(null)).toBe('—');
      expect(maskPhoneNumber('')).toBe('—');
    });
  });
});
