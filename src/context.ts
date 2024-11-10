import { BigNumber } from 'ethers';
import { createContext } from 'react';
import { Withdrawal } from './types/withdrawal';
import { Stream } from './types/stream';

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
