import { BigNumber } from 'ethers';

type CoingeckoToken =
  | 'aurora-near'
  | 'aurigami'
  | 'trisolaris'
  | 'bastion-protocol'
  | 'usn'
  | 'vote';

export type Stream = {
  address: string;
  amount: BigNumber;
  coingeckoName: CoingeckoToken;
  decimals: number;
  id: number;
  percentage: number;
  symbol: string;
  name: string;
  price?: number;
  apr?: number;
  isStarted?: boolean;
  startTimestamp?: number;
  endTimestamp?: number;
};

export type VoteStream = Omit<Stream, 'symbol'> & {
  symbol: 'VOTE';
};

export type StreamSchedule = {
  scheduleTimes: BigNumber[];
  scheduleRewards: BigNumber[];
};
