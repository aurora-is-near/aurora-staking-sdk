import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ethers, parseUnits } from 'ethers';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import {
  approveStaking,
  calculateStakedPctOfSupply,
  claim,
  claimAll,
  getDeposit,
  getIsPaused,
  getPendingWithdrawals,
  getStreamedAmounts,
  getStreamsProgress,
  getStreamsSchedule,
  getTotalShares,
  getTotalStaked,
  getUserShares,
  getVoteSupply,
  stake,
  unstake,
  unstakeAll,
  withdraw,
  withdrawAll,
} from './utils/staking.js';
import { calculateAprs } from './utils/apr.js';
import { sleep } from './utils/sleep.js';
import { useWeb3Provider } from './hooks/useWeb3Provider.js';
import { Stream } from './types/stream.js';
import { Withdrawal } from './types/withdrawal.js';
import { StakingContext } from './context.js';
import { AuroraNetwork } from './types/network.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { getTokenContract } from './contracts.js';
import { erc20Abi } from './abis/erc20.js';

type StakingProviderProps = {
  network: AuroraNetwork;
  children: ReactNode;
  getStreamPrices: (streamNames: string[]) => Promise<{
    prices: number[];
    marketCaps: number[];
  }>;
};

export const StakingProvider = ({
  network,
  children,
  getStreamPrices,
}: StakingProviderProps) => {
  const networkConfig = config[network];
  const { tokenStreams } = networkConfig;

  const streamIds = useMemo(
    () => [0, ...tokenStreams.map((stream) => stream.id)],
    [tokenStreams],
  );

  const streamDecimals = useMemo(
    () => [18, ...tokenStreams.map((s) => s.decimals)],
    [tokenStreams],
  );

  const voteTokenConfig = tokenStreams.find((s) => s.symbol === 'VOTE');

  if (!voteTokenConfig) {
    throw new Error('VOTE token not found in tokenStreams');
  }

  const voteIndex = tokenStreams.indexOf(voteTokenConfig);
  const voteId = voteTokenConfig.id;

  const { current: provider } = useRef(
    new ethers.JsonRpcProvider(networkConfig.rpcUrl),
  );

  const { current: voteToken } = useRef(
    getTokenContract(voteTokenConfig.address, provider),
  );

  const { current: auroraToken } = useRef(
    getTokenContract(networkConfig.tokenContractAddress, provider),
  );

  const [accountSynced, setAccountSynced] = useState(false);
  const [balance, setBalance] = useState(0n);
  const [voteBalance, setVoteBalance] = useState(0n);
  const [voteTotalBalance, setVoteTotalBalance] = useState(0n);
  const [withdrawableVoteBalance, setWithdrawableVoteBalance] = useState(0n);
  const [votePowerPct, setVotePowerPct] = useState(0);
  const [voteSupply, setVoteSupply] = useState(0n);
  const [allowance, setAllowance] = useState(0n);
  const [deposit, setDeposit] = useState(0n);
  const [userSharesValue, setUserSharesValue] = useState(0n);

  const [userShares, setUserShares] = useState(0n);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<
    Withdrawal[] | undefined
  >();

  const [isPaused, setIsPaused] = useState(false);
  const [streams, setStreams] = useState<Stream[]>(tokenStreams);
  const [totalApr, setTotalApr] = useState(0);
  const [auroraApr, setAuroraApr] = useState(0);
  const [stakedPct, setStakedPct] = useState(0);
  const { isConnected, address: account } = useAccount();
  const web3Provider = useWeb3Provider();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();

  useEffect(() => {
    if (Number(voteSupply) === 0) {
      return;
    }

    const votePower =
      (Number(
        ethers.formatUnits(voteTotalBalance, streamDecimals[voteIndex + 1]),
      ) *
        100) /
      Number(ethers.formatUnits(voteSupply, streamDecimals[voteIndex + 1]));

    setVotePowerPct(votePower);
  }, [streamDecimals, voteIndex, voteSupply, voteTotalBalance]);

  const fetchStreamPrices = useCallback(async () => {
    return getStreamPrices([
      'aurora-near',
      ...tokenStreams
        .map((stream) => stream.coingeckoName)
        .filter((name) => name !== 'vote'),
    ]);
  }, [getStreamPrices, tokenStreams]);

  const syncConnectedAccount = useCallback(async () => {
    try {
      if (!account) {
        return;
      }

      setAccountSynced(false);
      const [
        newBalance,
        newVoteBalance,
        newAllowance,
        newDeposit,
        newUserShares,
        totalShares,
        totalStaked,
        newPendingWithdrawals,
        streamedAmounts,
        streamPrices,
        newIsPaused,
      ] = await Promise.all([
        auroraToken.balanceOf(account),
        voteToken.balanceOf(account),
        auroraToken.allowance(account, networkConfig.stakingContractAddress),
        getDeposit(account, provider, network),
        getUserShares(account, 0, provider, network),
        getTotalShares(provider, network),
        getTotalStaked(provider, network),
        getPendingWithdrawals(
          streamIds,
          streamDecimals,
          account,
          provider,
          network,
        ),
        getStreamedAmounts(streamIds.slice(1), account, provider, network),
        fetchStreamPrices(),
        getIsPaused(provider, network),
      ]);

      setBalance(newBalance);
      setVoteBalance(newVoteBalance);
      const newWithdrawableVoteBalance =
        newPendingWithdrawals.find((w) => w.id === voteId)?.amount ?? 0n;

      setWithdrawableVoteBalance(newWithdrawableVoteBalance);
      setVoteTotalBalance(
        newVoteBalance
          .add(streamedAmounts[voteIndex])
          .add(newWithdrawableVoteBalance),
      );
      setAllowance(newAllowance);
      setDeposit(newDeposit);
      setUserShares(newUserShares);
      setPendingWithdrawals(newPendingWithdrawals);
      setIsPaused(newIsPaused);
      setStreams((previousStreams) =>
        previousStreams.map((stream, i) => {
          const amount = streamedAmounts[i];

          if (!amount) {
            logger.error(`Failed to get amount for stream ${i}, setting to 0`);
          }

          return {
            ...stream,
            amount: amount ?? 0n,
            price: streamPrices.prices[i + 1],
          };
        }),
      );

      if (Number(totalShares) !== 0) {
        setUserSharesValue(totalStaked.mul(userShares).div(totalShares));
      }

      setAccountSynced(true);
    } catch (error) {
      logger.error(error, 'Failed to sync account');
    }
  }, [
    account,
    auroraToken,
    fetchStreamPrices,
    network,
    networkConfig.stakingContractAddress,
    provider,
    streamDecimals,
    streamIds,
    userShares,
    voteId,
    voteIndex,
    voteToken,
  ]);

  const syncAllowance = useCallback(async () => {
    if (!account) {
      return;
    }

    const newAllowance = await auroraToken.allowance(
      account,
      networkConfig.stakingContractAddress,
    );

    setAllowance(newAllowance);
  }, [account, auroraToken, networkConfig.stakingContractAddress]);

  const init = useCallback(async () => {
    const [totalStaked, streamsSchedule, streamPrices] = await Promise.all([
      getTotalStaked(provider, network),
      getStreamsSchedule(streamIds, provider, network),
      fetchStreamPrices(),
    ]);

    const aprs = calculateAprs({
      streamsSchedule,
      streamDecimals,
      streamPrices: streamPrices.prices,
      totalStaked,
    });

    const streamsProgress = getStreamsProgress(streamsSchedule);

    const schedule = streamsSchedule[voteIndex + 1];

    if (schedule) {
      setVoteSupply(getVoteSupply(schedule));
    }

    setAuroraApr(aprs.aurora);
    setTotalApr(aprs.total);
    setStreams((previousStreams) =>
      previousStreams.map((stream, i) => {
        const { scheduleTimes } = streamsSchedule[i + 1] ?? {};
        const firstScheduleTime = scheduleTimes?.[0];
        const lastScheduleTime = scheduleTimes?.[scheduleTimes.length - 1];

        return {
          ...stream,
          apr: aprs.streams[i],
          percentage: streamsProgress[i + 1] ?? 0,
          startTimestamp: firstScheduleTime
            ? Number(firstScheduleTime) * 1000
            : 0,
          endTimestamp: lastScheduleTime ? Number(lastScheduleTime) * 1000 : 0,
          isStarted:
            firstScheduleTime && Date.now() >= Number(firstScheduleTime) * 1000,
          price: streamPrices.prices[i + 1],
        };
      }),
    );

    const newPrice = streamPrices.prices[0];
    const newMarketCap = streamPrices.marketCaps[0];

    if (!newPrice || !newMarketCap) {
      return;
    }

    const newStakedPct = calculateStakedPctOfSupply(
      totalStaked,
      newPrice,
      newMarketCap,
    );

    setStakedPct(newStakedPct);
  }, [
    fetchStreamPrices,
    network,
    provider,
    streamDecimals,
    streamIds,
    voteIndex,
  ]);

  useEffect(() => {
    init().catch((error) => {
      logger.error(
        new Error(`Failed to initialize staking provider: ${error.message}`),
      );
    });
  }, [init]);

  useEffect(() => {
    if (!isConnected) {
      // Hide balances if user's MetaMask is locked.
      setUserSharesValue(0n);
      setBalance(0n);
      setAllowance(0n);
      setDeposit(0n);

      return;
    }

    void syncConnectedAccount();
  }, [account, isConnected, syncConnectedAccount]);

  const approveAndSync = useCallback(async () => {
    if (!web3Provider) {
      return;
    }

    if (chainId !== networkConfig.chainId) {
      switchChain?.({ chainId: networkConfig.chainId });

      return;
    }

    await approveStaking(web3Provider, network);
    await sleep(2000);
    await syncAllowance();
  }, [
    chainId,
    network,
    networkConfig,
    switchChain,
    syncAllowance,
    web3Provider,
  ]);

  const stakeAndSync = useCallback(
    async (amount: bigint) => {
      if (!web3Provider) {
        return;
      }

      if (chainId !== networkConfig.chainId) {
        switchChain?.({ chainId: networkConfig.chainId });

        return;
      }

      await stake(amount, web3Provider, network);
      await sleep(2000);
      await syncConnectedAccount();
    },
    [
      chainId,
      network,
      networkConfig,
      switchChain,
      syncConnectedAccount,
      web3Provider,
    ],
  );

  const unstakeAndSync = useCallback(
    async (amount: bigint) => {
      if (!web3Provider) {
        return;
      }

      if (chainId !== networkConfig.chainId) {
        switchChain?.({ chainId: networkConfig.chainId });

        return;
      }

      await unstake(amount, web3Provider, network);
      await sleep(2000);
      await syncConnectedAccount();
    },
    [
      chainId,
      network,
      networkConfig,
      switchChain,
      syncConnectedAccount,
      web3Provider,
    ],
  );

  const unstakeAllAndSync = useCallback(async () => {
    if (!web3Provider) {
      return;
    }

    if (chainId !== networkConfig.chainId) {
      switchChain?.({ chainId: networkConfig.chainId });

      return;
    }

    await unstakeAll(web3Provider, network);
    await sleep(2000);
    await syncConnectedAccount();
  }, [
    chainId,
    network,
    networkConfig,
    switchChain,
    syncConnectedAccount,
    web3Provider,
  ]);

  const withdrawAndSync = useCallback(
    async (streamId: number) => {
      if (!web3Provider) {
        return;
      }

      if (chainId !== networkConfig.chainId) {
        switchChain?.({ chainId: networkConfig.chainId });

        return;
      }

      await withdraw(streamId, web3Provider, network);
      await sleep(2000);
      await syncConnectedAccount();
    },
    [
      chainId,
      network,
      networkConfig,
      switchChain,
      syncConnectedAccount,
      web3Provider,
    ],
  );

  const withdrawAllAndSync = useCallback(async () => {
    if (!web3Provider) {
      return;
    }

    if (chainId !== networkConfig.chainId) {
      switchChain?.({ chainId: networkConfig.chainId });

      return;
    }

    await withdrawAll(web3Provider, network);
    await sleep(2000);
    await syncConnectedAccount();
  }, [
    chainId,
    network,
    networkConfig,
    switchChain,
    syncConnectedAccount,
    web3Provider,
  ]);

  const claimAndSync = useCallback(
    async (streamId: number) => {
      if (!web3Provider) {
        return;
      }

      if (chainId !== networkConfig.chainId) {
        switchChain?.({ chainId: networkConfig.chainId });

        return;
      }

      await claim(streamId, web3Provider, network);
      await sleep(2000);
      await syncConnectedAccount();
    },
    [
      chainId,
      network,
      networkConfig,
      switchChain,
      syncConnectedAccount,
      web3Provider,
    ],
  );

  const claimAllAndSync = useCallback(async () => {
    if (!web3Provider) {
      return;
    }

    if (chainId !== networkConfig.chainId) {
      switchChain?.({ chainId: networkConfig.chainId });

      return;
    }

    await claimAll(web3Provider, network);
    await sleep(2000);
    await syncConnectedAccount();
  }, [
    chainId,
    network,
    networkConfig,
    switchChain,
    syncConnectedAccount,
    web3Provider,
  ]);

  const hasPendingRewards = streams.some(
    ({ amount, decimals }) => amount > parseUnits('0.0001', decimals),
  );

  const value = useMemo(
    () => ({
      accountSynced,
      balance,
      voteBalance,
      voteTotalBalance,
      withdrawableVoteBalance,
      voteSupply,
      votePowerPct,
      allowance,
      deposit,
      userSharesValue,
      userShares,
      pendingWithdrawals,
      streams,
      auroraApr,
      totalApr,
      isPaused,
      stakedPct,
      hasPendingRewards,
      syncConnectedAccount,
      syncAllowance,
      approveAndSync,
      stakeAndSync,
      unstakeAndSync,
      unstakeAllAndSync,
      withdrawAndSync,
      withdrawAllAndSync,
      claimAndSync,
      claimAllAndSync,
    }),
    [
      accountSynced,
      allowance,
      approveAndSync,
      auroraApr,
      balance,
      claimAllAndSync,
      claimAndSync,
      deposit,
      isPaused,
      pendingWithdrawals,
      stakeAndSync,
      stakedPct,
      streams,
      syncAllowance,
      syncConnectedAccount,
      totalApr,
      unstakeAllAndSync,
      unstakeAndSync,
      userShares,
      userSharesValue,
      voteBalance,
      votePowerPct,
      voteSupply,
      voteTotalBalance,
      withdrawAllAndSync,
      withdrawAndSync,
      withdrawableVoteBalance,
      hasPendingRewards,
    ],
  );

  return (
    <StakingContext.Provider value={value}>{children}</StakingContext.Provider>
  );
};
