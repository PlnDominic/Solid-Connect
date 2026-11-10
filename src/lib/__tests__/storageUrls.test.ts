import { parseStorageUrl } from '../storageUrls';

const BASE = 'https://abc.supabase.co/storage/v1/object';

describe('parseStorageUrl', () => {
  it('reads the bucket and path from an old public URL', () => {
    expect(parseStorageUrl(`${BASE}/public/chat-photos/user-1/170000.jpg`)).toEqual({
      bucket: 'chat-photos',
      path: 'user-1/170000.jpg',
    });
  });
  it('reads a signed URL and ignores its token', () => {
    expect(parseStorageUrl(`${BASE}/sign/request-photos/user-2/9.jpg?token=abc.def`)).toEqual({
      bucket: 'request-photos',
      path: 'user-2/9.jpg',
    });
  });
  it('covers voice notes', () => {
    expect(parseStorageUrl(`${BASE}/public/chat-audio/u/1.m4a`)?.bucket).toBe('chat-audio');
  });
  it('leaves public buckets alone (profile and portfolio photos stay public)', () => {
    expect(parseStorageUrl(`${BASE}/public/profile-photos/u/me.jpg`)).toBeNull();
    expect(parseStorageUrl(`${BASE}/public/portfolio-photos/u/work.jpg`)).toBeNull();
  });
  it('decodes encoded paths', () => {
    expect(parseStorageUrl(`${BASE}/public/chat-photos/u/my%20photo.jpg`)?.path).toBe('u/my photo.jpg');
  });
  it('ignores anything that is not a storage URL, or is empty', () => {
    expect(parseStorageUrl('https://example.com/a.jpg')).toBeNull();
    expect(parseStorageUrl('')).toBeNull();
    expect(parseStorageUrl(null)).toBeNull();
    expect(parseStorageUrl(undefined)).toBeNull();
  });
});
