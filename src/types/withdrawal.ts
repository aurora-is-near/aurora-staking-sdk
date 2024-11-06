import { BigNumber } from 'ethers';

export interface Withdrawal {
  id: number;
  amount: BigNumber;
  decimals: number;
  releaseTime: number;
}
