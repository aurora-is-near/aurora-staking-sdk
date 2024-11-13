import { BigNumber, ethers, providers } from 'ethers';
import { stakingAbi } from '../abis/staking.js';
import { erc20abi } from '../abis/erc20.js';
import { type AuroraNetworkConfig } from '../types/network.js';
import { logger } from '../logger.js';
import { isDefined } from './is-defined.js';

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

interface StreamSchedule {
  scheduleTimes: BigNumber[];
  scheduleRewards: BigNumber[];
}

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

const getScheduleStartAndEndTimes = (schedule: StreamSchedule) => {
  const startTime = schedule.scheduleTimes[0];
  const endTime = schedule.scheduleTimes[schedule.scheduleTimes.length - 1];

  if (!isDefined(startTime)) {
    throw new Error('Invalid schedule: start time not found');
  }

  if (!isDefined(endTime)) {
    throw new Error('Invalid schedule: end time not found');
  }

  return {
    startTime: startTime.toNumber() * 1000,
    endTime: endTime.toNumber() * 1000,
  };
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

export const getOneDayRewards = (
  streamsSchedule: StreamSchedule[],
): BigNumber[] => {
  const now = Date.now();
  const oneDay = 86400;
  const rewards = streamsSchedule.map((schedule) => {
    const { startTime, endTime } = getScheduleStartAndEndTimes(schedule);

    if (now <= startTime) {
      return ethers.BigNumber.from(0);
    } // didn't start

    if (now >= endTime - oneDay) {
      return ethers.BigNumber.from(0);
    } // ended

    const currentIndex =
      schedule.scheduleTimes.findIndex(
        (indexTime) => Math.floor(now / 1000) < indexTime.toNumber(),
      ) - 1;

    const currentTime = schedule.scheduleTimes[currentIndex];
    const nextTime = schedule.scheduleTimes[currentIndex + 1];

    if (!currentTime || !nextTime) {
      return ethers.BigNumber.from(0);
    }

    const indexDuration = nextTime.sub(currentTime);

    const currentReward = schedule.scheduleRewards[currentIndex];
    const nextReward = schedule.scheduleRewards[currentIndex + 1];

    if (!currentReward || !nextReward) {
      return ethers.BigNumber.from(0);
    }

    const indexRewards = currentReward.sub(nextReward);

    const reward = indexRewards.mul(oneDay).div(indexDuration);

    return reward;
  });

  return rewards;
};

export const calculateAprs = ({
  streamsSchedule,
  streamDecimals,
  streamPrices,
  totalStaked,
}: {
  streamsSchedule: StreamSchedule[];
  streamDecimals: number[];
  streamPrices: number[];
  totalStaked: BigNumber;
}): { total: number; streams: number[]; aurora: number } => {
  const oneDayRewards = getOneDayRewards(streamsSchedule);
  const [auroraPrice = 0] = streamPrices;

  const stakedValue =
    Number(ethers.utils.formatUnits(totalStaked, streamDecimals[0])) *
    auroraPrice;

  const rewardValues = oneDayRewards.map((reward, i) => {
    const streamPrice = streamPrices[i];

    if (!isDefined(streamPrice)) {
      throw new Error(`No stream price at position ${i}`);
    }

    return (
      Number(ethers.utils.formatUnits(reward, streamDecimals[i])) *
      365 *
      streamPrice
    );
  });

  const cumulatedReward = rewardValues.reduce((r1, r2) => r1 + r2);
  const total = (cumulatedReward * 100) / stakedValue;
  const streams = rewardValues.map((reward) => (reward * 100) / stakedValue);
  const aurora = streams[0];

  if (!isDefined(aurora)) {
    throw new Error('No stream at position 0');
  }

  return { total, streams: streams.slice(1), aurora };
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
