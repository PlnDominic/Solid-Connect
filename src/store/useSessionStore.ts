import { create } from 'zustand';
import type { Profile } from '../types/database';

interface SessionState {
  userId: string | null;
  profile: Profile | null;
  bootstrapping: boolean;
  hasOnboarded: boolean;
  setUserId: (id: string | null) => void;
  setProfile: (p: Profile | null) => void;
  setBootstrapping: (b: boolean) => void;
  setHasOnboarded: (b: boolean) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  userId: null,
  profile: null,
  bootstrapping: true,
  hasOnboarded: false,
  setUserId: (userId) => set({ userId }),
  setProfile: (profile) => set({ profile }),
  setBootstrapping: (bootstrapping) => set({ bootstrapping }),
  setHasOnboarded: (hasOnboarded) => set({ hasOnboarded }),
}));
