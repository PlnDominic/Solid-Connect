import { onSessionEnded, signOut } from '../auth';

let mockEmit: (event: string) => void = () => {};

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: (event: string) => void) => {
        mockEmit = callback;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: async () => mockEmit('SIGNED_OUT'),
    },
  },
}));

describe('onSessionEnded', () => {
  it('runs when the session ends by itself, not when the person signs out', async () => {
    const handler = jest.fn();
    onSessionEnded(handler);

    await signOut();
    mockEmit('TOKEN_REFRESHED');
    expect(handler).not.toHaveBeenCalled();

    mockEmit('SIGNED_OUT');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
