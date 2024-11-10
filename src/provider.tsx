import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BigNumber, ethers } from 'ethers';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import {
  approveStaking,
  calculateAprs,
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
} from './utils';
import { sleep } from './sleep';
import useWeb3Provider from './hooks/useWeb3Provider';
import { Stream } from './types/stream';
import { Withdrawal } from './types/withdrawal';
import { StakingContext } from './context';
import { erc20abi } from './abis/erc20';
import { AuroraNetwork } from './types/network';
import { config } from './config';

type StakingProviderProps = {
  isConnected: boolean;
  network: AuroraNetwork;
  children: ReactNode;
  getStreamPrices: (streamNames: string[]) => Promise<{
    prices: number[];
    marketCaps: number[];
  }>;
};

export const StakingProvider = ({
  isConnected,
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

  const voteIndex = tokenStreams.findIndex((s) => s.symbol === 'VOTE');
  const voteId = tokenStreams.find((s) => s.symbol === 'VOTE')!.id;

  const { current: provider } = useRef(
    new ethers.providers.JsonRpcBatchProvider(networkConfig.rpcUrl),
  );

  const { current: voteToken } = useRef(
    new ethers.Contract(tokenStreams[voteIndex]!.address, erc20abi, provider),
  );

  const { current: auroraToken } = useRef(
    new ethers.Contract(networkConfig.tokenContractAddress, erc20abi, provider),
  );

  const [accountSynced, setAccountSynced] = useState(false);
  const [balance, setBalance] = useState(ethers.BigNumber.from(0));
  const [voteBalance, setVoteBalance] = useState(ethers.BigNumber.from(0));
  const [voteTotalBalance, setVoteTotalBalance] = useState(
    ethers.BigNumber.from(0),
  );

  const [withdrawableVoteBalance, setWithdrawableVoteBalance] = useState(
    ethers.BigNumber.from(0),
  );

  const [votePowerPct, setVotePowerPct] = useState(0);
  const [voteSupply, setVoteSupply] = useState(ethers.BigNumber.from(0));
  const [allowance, setAllowance] = useState(ethers.BigNumber.from(0));
  const [deposit, setDeposit] = useState(ethers.BigNumber.from(0));
  const [userSharesValue, setUserSharesValue] = useState(
    ethers.BigNumber.from(0),
  );

  const [userShares, setUserShares] = useState(ethers.BigNumber.from(0));
  const [pendingWithdrawals, setPendingWithdrawals] = useState<
    Withdrawal[] | undefined
  >();

  const [isPaused, setIsPaused] = useState(false);
  const [streams, setStreams] = useState<Stream[]>(tokenStreams);
  const [totalApr, setTotalApr] = useState(0);
  const [auroraApr, setAuroraApr] = useState(0);
  const [stakedPct, setStakedPct] = useState(0);
  const { address: account } = useAccount();
  const web3Provider = useWeb3Provider();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();

  useEffect(() => {
    if (voteSupply.isZero()) {
      return;
    }

    const votePower =
      (Number(
        ethers.utils.formatUnits(
          voteTotalBalance,
          streamDecimals[voteIndex + 1],
        ),
      ) *
        100) /
      Number(
        ethers.utils.formatUnits(voteSupply, streamDecimals[voteIndex + 1]),
      );

    setVotePowerPct(votePower);
  }, [streamDecimals, voteIndex, voteSupply, voteTotalBalance]);

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
        getDeposit(account, provider, networkConfig),
        getUserShares(account, 0, provider, networkConfig),
        getTotalShares(provider, networkConfig),
        getTotalStaked(provider, networkConfig),
        getPendingWithdrawals(
          streamIds,
          streamDecimals,
          account,
          provider,
          networkConfig,
        ),
        getStreamedAmounts(
          streamIds.slice(1),
          account,
          provider,
          networkConfig,
        ),
        getStreamPrices([
          'aurora-near',
          ...tokenStreams.map((stream) => stream.coingeckoName),
        ]),
        getIsPaused(provider, networkConfig),
      ]);

      setBalance(newBalance);
      setVoteBalance(newVoteBalance);
      const newWithdrawableVoteBalance =
        newPendingWithdrawals.find((w) => w.id === voteId)?.amount ??
        BigNumber.from(0);

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
        previousStreams.map((stream, i) => ({
          ...stream,
          amount: streamedAmounts[i],
          price: streamPrices.prices[i + 1],
        })),
      );

      if (!totalShares.isZero()) {
        setUserSharesValue(totalStaked.mul(userShares).div(totalShares));
      }

      setAccountSynced(true);
    } catch (error) {
      console.error(error, 'Failed to sync account');
    }
  }, [
    account,
    auroraToken,
    getStreamPrices,
    networkConfig,
    provider,
    streamDecimals,
    streamIds,
    tokenStreams,
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
      getTotalStaked(provider, networkConfig),
      getStreamsSchedule(streamIds, provider, networkConfig),
      getStreamPrices([
        'aurora-near',
        ...tokenStreams.map((stream) => stream.coingeckoName),
      ]),
    ]);

    const aprs = calculateAprs(
      streamsSchedule,
      streamDecimals,
      streamPrices.prices,
      totalStaked,
    );

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
          percentage: streamsProgress[i + 1],
          startTimestamp: firstScheduleTime
            ? firstScheduleTime.toNumber() * 1000
            : 0,
          endTimestamp: lastScheduleTime
            ? lastScheduleTime.toNumber() * 1000
            : 0,
          isStarted:
            firstScheduleTime &&
            Date.now() >= firstScheduleTime.toNumber() * 1000,
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
    getStreamPrices,
    networkConfig,
    provider,
    streamDecimals,
    streamIds,
    tokenStreams,
    voteIndex,
  ]);

  useEffect(() => {
    init().catch((error) => {
      console.error(`Failed to initialize Staking Provider: ${error}`);
    });
  }, [init]);

  useEffect(() => {
    if (!isConnected) {
      // Hide balances if user's MetaMask is locked.
      setUserSharesValue(ethers.BigNumber.from(0));
      setBalance(ethers.BigNumber.from(0));
      setAllowance(ethers.BigNumber.from(0));
      setDeposit(ethers.BigNumber.from(0));

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

    await approveStaking(web3Provider, networkConfig);
    await sleep(2000);
    await syncAllowance();
  }, [chainId, networkConfig, switchChain, syncAllowance, web3Provider]);

  const stakeAndSync = useCallback(
    async (amount: BigNumber) => {
      if (!web3Provider) {
        return;
      }

      if (chainId !== networkConfig.chainId) {
        switchChain?.({ chainId: networkConfig.chainId });

        return;
      }

      await stake(amount, web3Provider, networkConfig);
      await sleep(2000);
      await syncConnectedAccount();
    },
    [chainId, networkConfig, switchChain, syncConnectedAccount, web3Provider],
  );

  const unstakeAndSync = useCallback(
    async (amount: BigNumber) => {
      if (!web3Provider) {
        return;
      }

      if (chainId !== networkConfig.chainId) {
        switchChain?.({ chainId: networkConfig.chainId });

        return;
      }

      await unstake(amount, web3Provider, networkConfig);
      await sleep(2000);
      await syncConnectedAccount();
    },
    [chainId, networkConfig, switchChain, syncConnectedAccount, web3Provider],
  );

  const unstakeAllAndSync = useCallback(async () => {
    if (!web3Provider) {
      return;
    }

    if (chainId !== networkConfig.chainId) {
      switchChain?.({ chainId: networkConfig.chainId });

      return;
    }

    await unstakeAll(web3Provider, networkConfig);
    await sleep(2000);
    await syncConnectedAccount();
  }, [chainId, networkConfig, switchChain, syncConnectedAccount, web3Provider]);

  const withdrawAndSync = useCallback(
    async (streamId: number) => {
      if (!web3Provider) {
        return;
      }

      if (chainId !== networkConfig.chainId) {
        switchChain?.({ chainId: networkConfig.chainId });

        return;
      }

      await withdraw(streamId, web3Provider, networkConfig);
      await sleep(2000);
      await syncConnectedAccount();
    },
    [chainId, networkConfig, switchChain, syncConnectedAccount, web3Provider],
  );

  const withdrawAllAndSync = useCallback(async () => {
    if (!web3Provider) {
      return;
    }

    if (chainId !== networkConfig.chainId) {
      switchChain?.({ chainId: networkConfig.chainId });

      return;
    }

    await withdrawAll(web3Provider, networkConfig);
    await sleep(2000);
    await syncConnectedAccount();
  }, [chainId, networkConfig, switchChain, syncConnectedAccount, web3Provider]);

  const claimAndSync = useCallback(
    async (streamId: number) => {
      if (!web3Provider) {
        return;
      }

      if (chainId !== networkConfig.chainId) {
        switchChain?.({ chainId: networkConfig.chainId });

        return;
      }

      await claim(streamId, web3Provider, networkConfig);
      await sleep(2000);
      await syncConnectedAccount();
    },
    [chainId, networkConfig, switchChain, syncConnectedAccount, web3Provider],
  );

  const claimAllAndSync = useCallback(async () => {
    if (!web3Provider) {
      return;
    }

    if (chainId !== networkConfig.chainId) {
      switchChain?.({ chainId: networkConfig.chainId });

      return;
    }

    await claimAll(web3Provider, networkConfig);
    await sleep(2000);
    await syncConnectedAccount();
  }, [chainId, networkConfig, switchChain, syncConnectedAccount, web3Provider]);

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
    ],
  );

  return (
    <StakingContext.Provider value={value}>{children}</StakingContext.Provider>
  );
};
