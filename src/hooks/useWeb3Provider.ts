import { useMemo } from 'react';
import { providers } from 'ethers';
import { useWalletClient } from 'wagmi';

export const useWeb3Provider = () => {
  const { data: walletClient } = useWalletClient();

  return useMemo(() => {
    if (!walletClient) {
      return null;
    }

    const { chain, transport } = walletClient;
    const network = {
      chainId: chain.id,
      name: chain.name,
    };

    const web3Provider = new providers.Web3Provider(transport, network);

    return web3Provider;
  }, [walletClient]);
};
