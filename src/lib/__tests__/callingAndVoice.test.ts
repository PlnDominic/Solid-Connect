export function formatVoiceDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function cleanPhoneForDialing(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export function validateChatMessageContent(msg: {
  text?: string | null;
  image_url?: string | null;
  audio_url?: string | null;
}): boolean {
  return Boolean(msg.text?.trim() || msg.image_url || msg.audio_url);
}

describe('callingAndVoice', () => {
  describe('formatVoiceDuration', () => {
    it('formats 0 seconds', () => {
      expect(formatVoiceDuration(0)).toBe('0:00');
    });

    it('formats single-digit seconds with leading zero', () => {
      expect(formatVoiceDuration(7)).toBe('0:07');
    });

    it('formats multi-minute durations accurately', () => {
      expect(formatVoiceDuration(75)).toBe('1:15');
      expect(formatVoiceDuration(182)).toBe('3:02');
    });
  });

  describe('cleanPhoneForDialing', () => {
    it('removes whitespace and dashes', () => {
      expect(cleanPhoneForDialing('024 123 4567')).toBe('0241234567');
      expect(cleanPhoneForDialing('+233 20-000-0000')).toBe('+233200000000');
    });

    it('preserves leading plus for international dialing', () => {
      expect(cleanPhoneForDialing('+233 55 987 6543')).toBe('+233559876543');
    });
  });

  describe('validateChatMessageContent', () => {
    it('accepts messages with text only', () => {
      expect(validateChatMessageContent({ text: 'Hello' })).toBe(true);
    });

    it('accepts messages with image only', () => {
      expect(validateChatMessageContent({ image_url: 'https://example.com/photo.jpg' })).toBe(true);
    });

    it('accepts messages with audio only (voice notes)', () => {
      expect(validateChatMessageContent({ audio_url: 'https://example.com/audio.m4a' })).toBe(true);
    });

    it('rejects empty messages without text, image, or audio', () => {
      expect(validateChatMessageContent({})).toBe(false);
      expect(validateChatMessageContent({ text: '   ' })).toBe(false);
    });
  });
});
