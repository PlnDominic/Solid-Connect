import type { VerificationStatus } from './types';

export interface VerificationRecord {
  id: string;
  providerId: string;
  status: VerificationStatus;
}

export interface VerificationRepo {
  getById(id: string): Promise<VerificationRecord | null>;
  markApproved(id: string, adminId: string): Promise<boolean>;
  markRejected(id: string, adminId: string, note: string): Promise<boolean>;
  setProviderVerified(providerId: string): Promise<void>;
}
