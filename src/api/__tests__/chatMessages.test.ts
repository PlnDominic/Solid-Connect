import { createElement, act } from 'react';
import { createRoot } from 'test-renderer';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { useMessages } from '../chat';

// 150 messages, m0 the oldest.
const mockAll = Array.from({ length: 150 }, (_, i) => ({ id: `m${i}` }));
let mockFail = false;

jest.mock('../../lib/api', () => ({ isApiConfigured: () => false, apiFetch: jest.fn() }));
jest.mock('../../lib/imageCompression', () => ({ compressImage: jest.fn() }));
jest.mock('../../lib/supabase', () => {
  const channel: any = { on: () => channel, subscribe: () => channel };
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: async (n: number) =>
      mockFail ? { data: null, error: new Error('offline') } : { data: [...mockAll].reverse().slice(0, n), error: null },
  };
  return { supabase: { from: () => builder, channel: () => channel, removeChannel: () => {} } };
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
notifyManager.setScheduler((callback) => callback());

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 10)));

describe('useMessages', () => {
  it('shows the newest messages oldest first, and keeps them if loading earlier ones fails', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let latest!: ReturnType<typeof useMessages>;
    function Probe() {
      latest = useMessages('t1');
      // Read during render, as a screen does.
      void latest.data;
      return null;
    }
    const root = createRoot();
    await act(async () => root.render(createElement(QueryClientProvider, { client }, createElement(Probe))));
    await settle();

    expect(latest.data).toHaveLength(100);
    expect(latest.data?.[0].id).toBe('m50');
    expect(latest.data?.[99].id).toBe('m149');
    expect(latest.hasEarlier).toBe(true);

    mockFail = true;
    let ok = true;
    await act(async () => {
      ok = await latest.loadEarlier();
    });
    await settle();
    expect(ok).toBe(false);
    expect(latest.data).toHaveLength(100);
    expect(latest.hasEarlier).toBe(true);

    mockFail = false;
    await act(async () => {
      ok = await latest.loadEarlier();
    });
    await settle();
    expect(ok).toBe(true);
    expect(latest.data).toHaveLength(150);
    expect(latest.data?.[0].id).toBe('m0');
    expect(latest.hasEarlier).toBe(false);

    await act(async () => root.unmount());
    client.clear();
  });
});
