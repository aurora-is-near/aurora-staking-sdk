import { Contract, JsonRpcProvider } from 'ethers';
import { TypedContract } from 'ethers-abitype';
import { AuroraNetwork } from './types/network.js';
import { config } from './config.js';
import { stakingAbi } from './abis/staking.js';
import { erc20Abi } from './abis/erc20.js';

/**
 * Get the staking contract for the given network.
 */
export const getStakingContract = (
  network: AuroraNetwork,
  signerOrProvider?: JsonRpcProvider,
) => {
  const { stakingContractAddress } = config[network];

  return new Contract(
    stakingContractAddress,
    stakingAbi,
    signerOrProvider,
  ) as unknown as TypedContract<typeof stakingAbi>;
};

export const getTokenContract = (
  contractAddress: string,
  signerOrProvider?: JsonRpcProvider,
) => {
  return new Contract(
    contractAddress,
    erc20Abi,
    signerOrProvider,
  ) as unknown as TypedContract<typeof erc20Abi>;
};
