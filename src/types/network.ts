import { Stream, VoteStream } from './stream';

export type AuroraNetwork = 'testnet' | 'mainnet';

export type AuroraNetworkConfig = {
  tokenContractAddress: string;
  stakingContractAddress: string;
  rpcUrl: string;
  chainId: number;
  tokenStreams: [...Stream[], VoteStream];
};
