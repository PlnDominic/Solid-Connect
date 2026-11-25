import { openCustomerAction, saveCustomerAction, takeCustomerAction, type CustomerAction } from '../../navigation/customerAccess';

const directRequest: CustomerAction = {
  screen: 'NewRequest',
  params: { preferredProviderId: 'provider-id', initialCategoryName: 'Plumbing' },
};

it('passes the selected provider into the guest sign-in flow', () => {
  const navigate = jest.fn();
  openCustomerAction({ navigate }, false, directRequest);
  expect(navigate).toHaveBeenCalledWith('Auth', { action: directRequest });
});

it('opens the same request directly for a signed-in customer', () => {
  const navigate = jest.fn();
  openCustomerAction({ navigate }, true, directRequest);
  expect(navigate).toHaveBeenCalledWith('NewRequest', directRequest.params);
});

it('asks guests to sign in before they can post a job', () => {
  const navigate = jest.fn();
  openCustomerAction({ navigate }, false, { screen: 'PostJob' });
  expect(navigate).toHaveBeenCalledWith('Auth', { action: { screen: 'PostJob' } });
});

it('resumes a saved request only for its matching account and consumes it once', async () => {
  await saveCustomerAction('customer@example.com', directRequest);
  await expect(takeCustomerAction('someone@example.com')).resolves.toBeUndefined();
  await expect(takeCustomerAction('Customer@example.com')).resolves.toEqual(directRequest);
  await expect(takeCustomerAction('customer@example.com')).resolves.toBeUndefined();
});
