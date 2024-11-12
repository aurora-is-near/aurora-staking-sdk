import { BigNumber } from 'ethers';
import { createContext } from 'react';
import { type Withdrawal } from './types/withdrawal.js';
import { Stream } from './types/stream.js';

export type StakingContextType = {
  accountSynced: boolean;
  balance: BigNumber;
  voteBalance: BigNumber;
  voteTotalBalance: BigNumber;
  withdrawableVoteBalance: BigNumber;
  voteSupply: BigNumber;
  votePowerPct: number;
  allowance: BigNumber;
  deposit: BigNumber;
  userSharesValue: BigNumber;
  userShares: BigNumber;
  pendingWithdrawals?: Withdrawal[];
  streams: Stream[];
  auroraApr: number;
  totalApr: number;
  isPaused: boolean;
  stakedPct: number;
  hasPendingRewards: boolean;
  syncConnectedAccount: () => void;
  syncAllowance: () => void;
  approveAndSync: () => void;
  stakeAndSync: (amount: BigNumber) => Promise<void>;
  unstakeAndSync: (amount: BigNumber) => Promise<void>;
  unstakeAllAndSync: () => Promise<void>;
  withdrawAndSync: (streamId: number) => Promise<void>;
  withdrawAllAndSync: () => Promise<void>;
  claimAndSync: (streamId: number) => Promise<void>;
  claimAllAndSync: () => Promise<void>;
};

export const StakingContext = createContext<StakingContextType | null>(null);
