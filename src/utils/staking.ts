import { BigNumber, ethers, providers } from 'ethers';
import { stakingAbi } from '../abis/staking.js';
import { erc20abi } from '../abis/erc20.js';
import { type AuroraNetworkConfig } from '../types/network.js';
import { logger } from '../logger.js';
import { isDefined } from './is-defined.js';
import { StreamSchedule } from '../types/stream.js';
import { getScheduleStartAndEndTimes } from './schedule.js';

export const getDeposit = async (
  account: string,
  provider: providers.JsonRpcProvider,
  networkConfig: AuroraNetworkConfig,
): Promise<BigNumber> => {
  const staking = new ethers.Contract(
    networkConfig.stakingContractAddress,
    stakingAbi,
    provider,
  );

  const deposit: BigNumber = await staking.getUserTotalDeposit(account);

  return deposit;
};

export const getUserShares = async (
  account: string,
  streamId: number,
  provider: providers.JsonRpcProvider,
  networkConfig: AuroraNetworkConfig,
): Promise<BigNumber> => {
  const staking = new ethers.Contract(
    networkConfig.stakingContractAddress,
    stakingAbi,
    provider,
  );

  const shares: BigNumber = await staking.getAmountOfShares(streamId, account);

  return shares;
};

export const getTotalShares = async (
  provider: providers.JsonRpcProvider,
  networkConfig: AuroraNetworkConfig,
): Promise<BigNumber> => {
  const staking = new ethers.Contract(
    networkConfig.stakingContractAddress,
    stakingAbi,
    provider,
  );

  const shares: BigNumber = await staking.totalAuroraShares();

  return shares;
};

export const getTotalStaked = async (
  provider: providers.JsonRpcProvider,
  networkConfig: AuroraNetworkConfig,
): Promise<BigNumber> => {
  const staking = new ethers.Contract(
    networkConfig.stakingContractAddress,
    stakingAbi,
    provider,
  );

  const totalStaked: BigNumber = await staking.getTotalAmountOfStakedAurora();

  return totalStaked;
};

export const getPendingWithdrawals = async (
  streamIds: number[],
  streamDecimals: number[],
  account: string,
  provider: providers.JsonRpcProvider,
  networkConfig: AuroraNetworkConfig,
): Promise<
  { amount: BigNumber; releaseTime: number; id: number; decimals: number }[]
> => {
  const staking = new ethers.Contract(
    networkConfig.stakingContractAddress,
    stakingAbi,
    provider,
  );

  const pendingAmounts = await Promise.all(
    streamIds.map(async (id) => {
      const pending: BigNumber = await staking.getPending(id, account);

      return pending;
    }),
  );

  const pendingReleaseTimes = await Promise.all(
    streamIds.map(async (id) => {
      const releaseTime: BigNumber = staking.getReleaseTime(id, account);

      return releaseTime;
    }),
  );

  const pendingWithdrawals = pendingAmounts
    .map((amount, i) => {
      const releaseTime = pendingReleaseTimes[i];
      const id = streamIds[i];
      const decimals = streamDecimals[i];

      if (!isDefined(releaseTime)) {
        throw new Error(`No release time at position ${i}`);
      }

      if (!isDefined(id)) {
        throw new Error(`No stream ID at position ${i}`);
      }

      if (!isDefined(decimals)) {
        throw new Error(`No stream decimals at position ${i}`);
      }

      return {
        amount,
        releaseTime: releaseTime.toNumber() * 1000,
        id,
        decimals,
      };
    })
    .filter((withdrawal) => !!withdrawal)
    .filter((withdrawal) => !withdrawal.amount.isZero());

  return pendingWithdrawals;
};

export const getStreamedAmounts = async (
  streamIds: number[],
  account: string,
  provider: providers.JsonRpcProvider,
  networkConfig: AuroraNetworkConfig,
): Promise<BigNumber[]> => {
  const staking = new ethers.Contract(
    networkConfig.stakingContractAddress,
    stakingAbi,
    provider,
  );

  try {
    const latestStreamedAmounts = await Promise.all(
      streamIds.map(async (id) => {
        const claimableAmount: BigNumber =
          await staking.getStreamClaimableAmount(id, account);

        return claimableAmount;
      }),
    );

    return latestStreamedAmounts;
  } catch (error) {
    logger.error('Zero staked shares?', error);

    return streamIds.map(() => ethers.BigNumber.from(0));
  }
};

export const getStreamsSchedule = async (
  streamIds: number[],
  provider: providers.JsonRpcProvider,
  networkConfig: AuroraNetworkConfig,
): Promise<StreamSchedule[]> => {
  const staking = new ethers.Contract(
    networkConfig.stakingContractAddress,
    stakingAbi,
    provider,
  );

  const streamsSchedule = await Promise.all(
    streamIds.map(async (id) => {
      const schedule: BigNumber[][] = staking.getStreamSchedule(id);

      return schedule;
    }),
  );

  return streamsSchedule.map((schedule) => {
    const [scheduleTimes, scheduleRewards] = schedule;

    if (!isDefined(scheduleTimes) || !isDefined(scheduleRewards)) {
      throw new Error('Invalid schedule found');
    }

    return {
      scheduleTimes,
      scheduleRewards,
    };
  });
};

export const getStreamsProgress = (
  streamsSchedule: StreamSchedule[],
): number[] => {
  const streamsProgress = streamsSchedule.map((schedule) => {
    const { startTime, endTime } = getScheduleStartAndEndTimes(schedule);

    const progress = ((Date.now() - startTime) / (endTime - startTime)) * 100;

    return progress > 10 ? progress : 10;
  });

  return streamsProgress;
};

export const getVoteSupply = (voteSchedule: StreamSchedule): BigNumber => {
  const { startTime, endTime } = getScheduleStartAndEndTimes(voteSchedule);

  const totalSupply = voteSchedule.scheduleRewards[0];
  const circulatingSupply = totalSupply
    ? totalSupply.mul(Date.now() - startTime).div(endTime - startTime)
    : ethers.BigNumber.from(0);

  return circulatingSupply;
};

export const calculateStakedPctOfSupply = (
  totalStaked: BigNumber,
  auroraPrice: number,
  auroraMarketCap: number,
): number => {
  const circulatingSupply = auroraMarketCap / auroraPrice;
  // Compounding staked AURORA
  const stakedAurora = Number(ethers.utils.formatUnits(totalStaked, 18));
  const pct = (stakedAurora * 100) / circulatingSupply;

  return pct;
};

export const getIsPaused = async (
  provider: providers.JsonRpcProvider,
  networkConfig: AuroraNetworkConfig,
): Promise<boolean> => {
  const staking = new ethers.Contract(
    networkConfig.stakingContractAddress,
    stakingAbi,
    provider,
  );

  const pausedFlag = await staking.paused();

  return pausedFlag.toNumber() === 1;
};

export const approveStaking = async (
  provider: providers.JsonRpcProvider,
  networkConfig: AuroraNetworkConfig,
) => {
  const auroraToken = new ethers.Contract(
    networkConfig.tokenContractAddress,
    erc20abi,
    provider.getSigner(),
  );

  const tx = await auroraToken.approve(
    networkConfig.stakingContractAddress,
    ethers.constants.MaxUint256,
    { gasPrice: 0 },
  );

  logger.debug(tx);
  await tx.wait();
};

export const stake = async (
  amount: BigNumber,
  provider: providers.Web3Provider,
  networkConfig: AuroraNetworkConfig,
) => {
  const staking = new ethers.Contract(
    networkConfig.stakingContractAddress,
    stakingAbi,
    provider.getSigner(),
  );

  const tx = await staking.stake(amount, { gasPrice: 0 });

  logger.debug(tx);
  await tx.wait();
};

export const unstake = async (
  amount: BigNumber,
  provider: providers.Web3Provider,
  networkConfig: AuroraNetworkConfig,
) => {
  const staking = new ethers.Contract(
    networkConfig.stakingContractAddress,
    stakingAbi,
    provider.getSigner(),
  );

  const tx = await staking.unstake(amount, { gasPrice: 0 });

  logger.debug(tx);
  await tx.wait();
};

export const unstakeAll = async (
  provider: providers.Web3Provider,
  networkConfig: AuroraNetworkConfig,
) => {
  const staking = new ethers.Contract(
    networkConfig.stakingContractAddress,
    stakingAbi,
    provider.getSigner(),
  );

  const tx = await staking.unstakeAll({ gasPrice: 0 });

  logger.debug(tx);
  await tx.wait();
};

export const withdraw = async (
  streamId: number,
  provider: providers.Web3Provider,
  networkConfig: AuroraNetworkConfig,
) => {
  const staking = new ethers.Contract(
    networkConfig.stakingContractAddress,
    stakingAbi,
    provider.getSigner(),
  );

  const tx = await staking.withdraw(streamId, { gasPrice: 0 });

  logger.debug(tx);
  await tx.wait();
};

export const withdrawAll = async (
  provider: providers.Web3Provider,
  networkConfig: AuroraNetworkConfig,
) => {
  const staking = new ethers.Contract(
    networkConfig.stakingContractAddress,
    stakingAbi,
    provider.getSigner(),
  );

  const tx = await staking.withdrawAll({ gasPrice: 0 });

  logger.debug(tx);
  await tx.wait();
};

export const claim = async (
  streamId: number,
  provider: providers.Web3Provider,
  networkConfig: AuroraNetworkConfig,
) => {
  const staking = new ethers.Contract(
    networkConfig.stakingContractAddress,
    stakingAbi,
    provider.getSigner(),
  );

  const tx = await staking.moveRewardsToPending(streamId, { gasPrice: 0 });

  logger.debug(tx);
  await tx.wait();
};

export const claimAll = async (
  provider: providers.Web3Provider,
  networkConfig: AuroraNetworkConfig,
) => {
  const staking = new ethers.Contract(
    networkConfig.stakingContractAddress,
    stakingAbi,
    provider.getSigner(),
  );

  const tx = await staking.moveAllRewardsToPending({ gasPrice: 0 });

  logger.debug(tx);
  await tx.wait();
};
