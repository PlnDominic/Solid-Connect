import { Alert } from 'react-native';
import type { Role } from '../types/database';

/** What switching roles means, in plain words, before it happens. */
export function roleSwitchCopy(to: Role): { title: string; message: string; confirm: string } {
  if (to === 'provider') {
    return {
      title: 'Switch to provider?',
      message:
        "You'll see jobs near you and can send quotes. Choose your services and set your hours so customers can find you. Your first job is free, then a yearly fee, with no commission. You can switch back any time.",
      confirm: 'Switch to provider',
    };
  }
  return {
    title: 'Switch to customer?',
    message: "You'll go back to posting jobs and hiring providers. Your provider profile is kept for when you switch back.",
    confirm: 'Switch to customer',
  };
}

export function confirmRoleSwitch(to: Role, onConfirm: () => void) {
  const { title, message, confirm } = roleSwitchCopy(to);
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirm, onPress: onConfirm },
  ]);
}
