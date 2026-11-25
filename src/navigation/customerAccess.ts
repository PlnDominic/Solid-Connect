import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_ACTION_KEY = 'solid-connect:pending-customer-action';
const ACTION_VALID_FOR_MS = 24 * 60 * 60 * 1000;

export type AccountTab = 'ActivityTab' | 'ChatTab' | 'ProfileTab';

export type CustomerAction =
  | { screen: 'PostJob'; params?: { initialCategoryId?: string; initialDescription?: string } }
  | {
      screen: 'NewRequest';
      params: {
        initialCategoryId?: string;
        initialCategoryName?: string;
        initialDescription?: string;
        preferredProviderId?: string;
        preferredProviderName?: string;
      };
    };

export function openCustomerAction(
  navigation: { navigate: (screen: string, params?: object) => void },
  signedIn: boolean,
  action: CustomerAction,
) {
  if (!signedIn) {
    navigation.navigate('Auth', { action });
    return;
  }
  navigation.navigate(action.screen, action.params);
}

export async function saveCustomerAction(email: string, action: CustomerAction) {
  await AsyncStorage.setItem(PENDING_ACTION_KEY, JSON.stringify({
    email: email.trim().toLowerCase(),
    action,
    expiresAt: Date.now() + ACTION_VALID_FOR_MS,
  }));
}

export async function takeCustomerAction(email: string | null | undefined): Promise<CustomerAction | undefined> {
  const raw = await AsyncStorage.getItem(PENDING_ACTION_KEY);
  if (!raw) return undefined;
  const pending = JSON.parse(raw);
  if (!pending || !(pending.expiresAt > Date.now())) {
    await AsyncStorage.removeItem(PENDING_ACTION_KEY);
    return undefined;
  }
  if (pending.email !== email?.trim().toLowerCase()) return undefined;
  await AsyncStorage.removeItem(PENDING_ACTION_KEY);
  if (pending.action?.screen === 'PostJob' || pending.action?.screen === 'NewRequest') return pending.action;
  return undefined;
}
