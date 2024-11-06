import { ethers } from 'ethers';
import { AuroraNetwork, AuroraNetworkConfig } from './types/network';

export const config: Record<AuroraNetwork, AuroraNetworkConfig> = {
  testnet: {
    tokenContractAddress: '0x9D58bDE565c43727469B5972DE5768A31e5FAf12',
    stakingContractAddress: '0xC36692270012752e209ec7d074140eb1aF9065F6',
    rpcUrl: 'https://testnet.aurora.dev',
    chainId: 1313161555,
    tokenStreams: [
      {
        name: 'Trisolaris',
        coingeckoName: 'trisolaris',
        symbol: 'TRI',
        decimals: 18,
        amount: ethers.BigNumber.from(0),
        percentage: 0,
        address: '0x42Fe1195219bBD26a530c189624CB4B268527596',
        id: 2,
      },
      {
        name: 'Bastion',
        coingeckoName: 'bastion-protocol',
        symbol: 'BSTN',
        decimals: 18,
        amount: ethers.BigNumber.from(0),
        percentage: 0,
        address: '0xB8793D1c6cc0cfE9C128700dCF2b3DAA072ed7EE',
        id: 3,
      },
      {
        name: 'Aurora Vote Token',
        coingeckoName: 'vote',
        symbol: 'VOTE',
        decimals: 18,
        amount: ethers.BigNumber.from(0),
        percentage: 0,
        address: '0xB8793D1c6cc0cfE9C128700dCF2b3DAA072ed7EE', // Dummy, reusing bastion.
        id: 3, // Dummy, reusing bastion
      },
    ],
  },
  mainnet: {
    tokenContractAddress: '0x8bec47865ade3b172a928df8f990bc7f2a3b9f79',
    stakingContractAddress: '0xccc2b1aD21666A5847A804a73a41F904C4a4A0Ec',
    rpcUrl: 'https://mainnet.aurora.dev',
    chainId: 1313161554,
    tokenStreams: [
      {
        name: 'Aurigami Token',
        coingeckoName: 'aurigami',
        symbol: 'PLY',
        decimals: 18,
        amount: ethers.BigNumber.from(0),
        percentage: 0,
        address: '0x09C9D464b58d96837f8d8b6f4d9fE4aD408d3A4f',
        id: 1,
      },
      {
        name: 'Trisolaris',
        coingeckoName: 'trisolaris',
        symbol: 'TRI',
        decimals: 18,
        amount: ethers.BigNumber.from(0),
        percentage: 0,
        address: '0xFa94348467f64D5A457F75F8bc40495D33c65aBB',
        id: 2,
      },
      {
        name: 'Bastion',
        coingeckoName: 'bastion-protocol',
        symbol: 'BSTN',
        decimals: 18,
        amount: ethers.BigNumber.from(0),
        percentage: 0,
        address: '0x9f1f933c660a1dc856f0e0fe058435879c5ccef0',
        id: 3,
      },
      {
        name: 'USN',
        coingeckoName: 'usn',
        symbol: 'USN',
        decimals: 18,
        amount: ethers.BigNumber.from(0),
        percentage: 0,
        address: '0x5183e1b1091804bc2602586919e6880ac1cf2896',
        id: 4,
      },
      {
        name: 'Aurora Vote Token',
        coingeckoName: 'vote',
        symbol: 'VOTE',
        decimals: 18,
        amount: ethers.BigNumber.from(0),
        percentage: 0,
        address: '0x6edE987A51d7b4d3945E7a76Af59Ff2b968910A8',
        id: 5,
      },
    ],
  },
};
