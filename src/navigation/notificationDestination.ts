import type { AppNotification, Role } from '../types/database';

export function notificationDestination(notice: Pick<AppNotification, 'id' | 'data'>, role: Role) {
  const { postId, jobId, disputeId, requestId, threadId, peerId, url } = notice.data ?? {};
  if (typeof disputeId === 'string' && typeof jobId === 'string') {
    return { tab: 'ActivityTab', screen: 'Dispute', params: { jobId } };
  }
  if (typeof jobId === 'string') {
    return { tab: 'ActivityTab', screen: 'JobDetail', params: { jobId } };
  }
  if (typeof postId === 'string') {
    return role === 'customer'
      ? { tab: 'HomeTab', screen: 'JobPostDetail', params: { postId } }
      : { tab: 'FeedTab', screen: 'JobPost', params: { postId } };
  }
  if (typeof threadId === 'string') {
    return typeof peerId === 'string'
      ? { tab: 'ChatTab', screen: 'ChatThread', params: { threadId, peerId } }
      : { tab: 'ChatTab', screen: 'ChatList' };
  }
  if (typeof requestId === 'string' && role === 'customer') {
    return { tab: 'ActivityTab', screen: 'ActivityHome', params: { requestId, notificationId: notice.id } };
  }
  if (typeof url === 'string' && url.startsWith('solidconnect://')) return { url };
  if (typeof requestId === 'string') {
    return { tab: 'FeedTab', screen: 'RequestDetail', params: { requestId } };
  }
  return null;
}
