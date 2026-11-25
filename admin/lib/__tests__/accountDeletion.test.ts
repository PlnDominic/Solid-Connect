import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { removePersonalData } from '../accountDeletion';

function fakeClient(files: Record<string, string[]>, opts: { failBucket?: string; removeNothing?: boolean } = {}) {
  const rowChanges: string[] = [];
  const client = {
    storage: {
      from: (bucket: string) => ({
        list: async (folder: string, { limit }: { limit: number }) => ({
          data: (files[bucket] ?? [])
            .filter((path) => path.startsWith(`${folder}/`))
            .slice(0, limit)
            .map((path) => ({ name: path.slice(folder.length + 1) })),
          error: null,
        }),
        remove: async (paths: string[]) => {
          if (opts.failBucket === bucket) return { data: null, error: { message: 'storage down' } };
          if (opts.removeNothing) return { data: [], error: null };
          files[bucket] = files[bucket].filter((path) => !paths.includes(path));
          return { data: paths, error: null };
        },
      }),
    },
    from: (table: string) => {
      const run = { eq: async () => (rowChanges.push(table), { error: null }) };
      return { delete: () => run, update: () => run };
    },
  } as unknown as SupabaseClient;
  return { client, rowChanges };
}

describe('removePersonalData', () => {
  it('removes every page of this user’s ID, profile and portfolio files only', async () => {
    const files = {
      'verification-docs': ['u1/id.jpg', 'u2/id.jpg'],
      'profile-photos': ['u1/me.jpg'],
      'portfolio-photos': Array.from({ length: 150 }, (_, i) => `u1/${i}.jpg`),
      'chat-photos': ['u1/chat.jpg'],
    };
    const { client, rowChanges } = fakeClient(files);
    await removePersonalData(client, 'u1');
    expect(files).toEqual({
      'verification-docs': ['u2/id.jpg'],
      'profile-photos': [],
      'portfolio-photos': [],
      'chat-photos': ['u1/chat.jpg'],
    });
    expect(rowChanges).toEqual(['provider_portfolio_photos', 'provider_verifications', 'users', 'provider_presence']);
  });

  it('throws and keeps the rows when storage fails', async () => {
    const { client, rowChanges } = fakeClient({ 'verification-docs': ['u1/id.jpg'] }, { failBucket: 'verification-docs' });
    await expect(removePersonalData(client, 'u1')).rejects.toThrow('storage down');
    expect(rowChanges).toEqual([]);
  });

  it('stops instead of looping when nothing gets removed', async () => {
    const { client } = fakeClient({ 'profile-photos': ['u1/me.jpg'] }, { removeNothing: true });
    await expect(removePersonalData(client, 'u1')).rejects.toThrow('no files were removed');
  });

  it('refuses an empty account id', async () => {
    const { client } = fakeClient({});
    await expect(removePersonalData(client, '')).rejects.toThrow('no account id');
  });
});
