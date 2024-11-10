import { BigNumber, ethers, providers } from 'ethers';
import { stakingAbi } from './abis/staking';
import { erc20abi } from './abis/erc20';
import { AuroraNetworkConfig } from './types/network';

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

      if (!releaseTime) {
        throw new Error(`Release time at position ${i} not found`);
      }

      if (!id) {
        throw new Error(`Stream ID at position ${i} not found`);
      }

      if (!decimals) {
        throw new Error(`Stream decimals at position ${i} not found`);
      }

      return {
        amount,
        releaseTime: releaseTime.toNumber() * 1000,
        id,
        decimals,
      };
    })
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
    console.error('Zero staked shares?', error);

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

    if (!scheduleTimes || !scheduleRewards) {
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

  if (!startTime) {
    throw new Error('Invalid schedule: start time not found');
  }

  if (!endTime) {
    throw new Error('Invalid schedule: end time not found');
  }

  const startNumber = startTime.toNumber();
  const endNumber = endTime.toNumber();

  return {
    startNumber,
    endNumber,
    startTime: startNumber * 1000,
    endTime: endNumber * 1000,
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
  const now = Math.floor(Date.now() / 1000);
  const oneDay = 86400;
  const rewards = streamsSchedule.map((schedule) => {
    const { startNumber, endNumber } = getScheduleStartAndEndTimes(schedule);

    if (now <= startNumber) {
      return ethers.BigNumber.from(0);
    } // didn't start

    if (now >= endNumber - oneDay) {
      return ethers.BigNumber.from(0);
    } // ended

    const currentIndex =
      schedule.scheduleTimes.findIndex(
        (indexTime) => now < indexTime.toNumber(),
      ) - 1;

    const currentNumber = schedule.scheduleTimes[currentIndex];
    const nextNumber = schedule.scheduleRewards[currentIndex + 1];

    const indexDuration =
      currentNumber && nextNumber
        ? nextNumber.sub(currentNumber)
        : ethers.BigNumber.from(0);

    const indexRewards =
      currentNumber && nextNumber
        ? currentNumber.sub(nextNumber)
        : ethers.BigNumber.from(0);

    const reward = indexRewards?.mul(oneDay).div(indexDuration);

    return reward;
  });

  return rewards;
};

export const calculateAprs = (
  streamsSchedule: StreamSchedule[],
  streamDecimals: number[],
  streamPrices: number[],
  totalStaked: BigNumber,
): { total: number; streams: number[]; aurora: number } => {
  const oneDayRewards = getOneDayRewards(streamsSchedule);
  const [auroraPrice] = streamPrices;

  if (!auroraPrice) {
    throw new Error('Aurora price not found');
  }

  const stakedValue =
    Number(ethers.utils.formatUnits(totalStaked, streamDecimals[0])) *
    auroraPrice;

  const rewardValues = oneDayRewards.map((reward, i) => {
    const streamPrice = streamPrices[i];

    if (!streamPrice) {
      throw new Error(`Stream price at position ${i} not found`);
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

  if (!aurora) {
    throw new Error('Aurora stream not found');
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

  console.log(tx);
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

  console.log(tx);
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

  console.log(tx);
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

  console.log(tx);
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

  console.log(tx);
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

  console.log(tx);
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

  console.log(tx);
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

  console.log(tx);
  await tx.wait();
};
