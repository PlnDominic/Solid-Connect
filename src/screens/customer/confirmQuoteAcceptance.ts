import { Alert } from 'react-native';
import { friendlyActionError } from '../../api/quotes';

export function confirmQuoteAcceptance(providerName: string, price: number, onConfirm: () => Promise<void>) {
  Alert.alert('Accept this quote?', `Hire ${providerName} for GHS ${price.toLocaleString()}?`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Accept quote',
      onPress: async () => {
        try {
          await onConfirm();
        } catch (error) {
          Alert.alert('Could not accept quote', friendlyActionError(error, 'Please try again.'));
        }
      },
    },
  ]);
}
