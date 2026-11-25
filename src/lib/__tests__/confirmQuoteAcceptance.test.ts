import { Alert } from 'react-native';
import { confirmQuoteAcceptance } from '../../screens/customer/confirmQuoteAcceptance';

jest.mock('react-native', () => ({ Alert: { alert: jest.fn() } }));
jest.mock('../../api/quotes', () => ({
  friendlyActionError: (_error: unknown, fallback: string) => fallback,
}));

const alert = jest.mocked(Alert.alert);

beforeEach(() => alert.mockClear());

it('shows the provider and price before committing to a quote', async () => {
  const accept = jest.fn().mockResolvedValue(undefined);
  confirmQuoteAcceptance('Ama', 350, accept);

  expect(accept).not.toHaveBeenCalled();
  const [title, message, buttons] = alert.mock.calls[0];
  expect(title).toBe('Accept this quote?');
  expect(message).toBe('Hire Ama for GHS 350?');
  expect(buttons?.[0].style).toBe('cancel');
  await buttons?.[0].onPress?.();
  expect(accept).not.toHaveBeenCalled();
  await buttons?.[1].onPress?.();
  expect(accept).toHaveBeenCalledTimes(1);
});

it('surfaces a failed acceptance', async () => {
  const accept = jest.fn().mockRejectedValue(new Error('Network error'));
  confirmQuoteAcceptance('Ama', 350, accept);

  await alert.mock.calls[0][2]?.[1].onPress?.();
  expect(alert).toHaveBeenLastCalledWith('Could not accept quote', 'Please try again.');
});
