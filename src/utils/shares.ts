import { providers } from 'ethers';
import { AuroraNetwork } from '../types/network';
import { config } from '../config';
import { getUserShares } from './staking';

/**
 * Confirm that a user's account has shares.
 */
export const hasShares = async (
  network: AuroraNetwork,
  address: string,
): Promise<boolean> => {
  const networkConfig = config[network];
  const { rpcUrl } = networkConfig;
  const provider = new providers.JsonRpcProvider(rpcUrl);

  // Confirm that account has shares
  const userShares = await getUserShares(address, 0, provider, networkConfig);

  return !userShares.isZero();
};
