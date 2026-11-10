import { greetingKeyForHour } from '../index';

describe('greetingKeyForHour', () => {
  it('uses morning from 5am to 11am', () => {
    expect(greetingKeyForHour(5)).toBe('home.greetingMorning');
    expect(greetingKeyForHour(11)).toBe('home.greetingMorning');
  });
  it('uses afternoon from noon to 4pm', () => {
    expect(greetingKeyForHour(12)).toBe('home.greetingAfternoon');
    expect(greetingKeyForHour(16)).toBe('home.greetingAfternoon');
  });
  it('uses evening from 5pm through the night', () => {
    expect(greetingKeyForHour(17)).toBe('home.greetingEvening');
    expect(greetingKeyForHour(23)).toBe('home.greetingEvening');
    expect(greetingKeyForHour(0)).toBe('home.greetingEvening');
    expect(greetingKeyForHour(4)).toBe('home.greetingEvening');
  });
});
