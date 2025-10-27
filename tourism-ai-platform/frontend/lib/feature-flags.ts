import { create } from 'zustand';

interface FeatureFlagState {
  speech: boolean;
  vision: boolean;
  personalization: boolean;
}

const defaultFlags: FeatureFlagState = {
  speech: (process.env.NEXT_PUBLIC_FEATURE_SPEECH ?? 'false').toLowerCase() === 'true',
  vision: (process.env.NEXT_PUBLIC_FEATURE_VISION ?? 'false').toLowerCase() === 'true',
  personalization: (process.env.NEXT_PUBLIC_FEATURE_PERSONALIZATION ?? 'false').toLowerCase() === 'true',
};

export const useFeatureFlags = create<FeatureFlagState>(() => defaultFlags);
