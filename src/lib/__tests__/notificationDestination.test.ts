import { notificationDestination } from '../../navigation/notificationDestination';

it('opens the request from a decline notice without a URL', () => {
  expect(notificationDestination({ id: 'notice', data: { requestId: 'request' } }, 'customer')).toEqual({
    tab: 'ActivityTab',
    screen: 'ActivityHome',
    params: { requestId: 'request', notificationId: 'notice' },
  });
});

it('routes post notices according to the signed-in role', () => {
  const notice = { id: 'notice', data: { postId: 'post' } };
  expect(notificationDestination(notice, 'customer')).toMatchObject({ tab: 'HomeTab', screen: 'JobPostDetail' });
  expect(notificationDestination(notice, 'provider')).toMatchObject({ tab: 'FeedTab', screen: 'JobPost' });
});
