import { useContext } from 'react';
import { StakingContext } from '../context.js';

export const useStaking = () => {
  const ctx = useContext(StakingContext);

  if (!ctx) {
    throw new Error(
      'The useStaking hook must be used from within a StakingProvider',
    );
  }

  return ctx;
};
