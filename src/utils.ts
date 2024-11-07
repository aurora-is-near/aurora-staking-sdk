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

  const deposit = await staking.getUserTotalDeposit(account);

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

  const shares = await staking.getAmountOfShares(streamId, account);

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

  const shares = await staking.totalAuroraShares();

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

  const totalStaked = await staking.getTotalAmountOfStakedAurora();

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
    streamIds.map((id) => staking.getPending(id, account)),
  );

  const pendingReleaseTimes = await Promise.all(
    streamIds.map((id) => staking.getReleaseTime(id, account)),
  );

  const pendingWithdrawals = pendingAmounts
    .map((amount, i) => ({
      amount,
      releaseTime: pendingReleaseTimes[i].toNumber() * 1000,
      id: streamIds[i],
      decimals: streamDecimals[i],
    }))
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
      streamIds.map((id) => staking.getStreamClaimableAmount(id, account)),
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
    streamIds.map((id) => staking.getStreamSchedule(id)),
  );

  return streamsSchedule.map((schedule) => ({
    scheduleTimes: schedule[0],
    scheduleRewards: schedule[1],
  }));
};

export const getStreamsProgress = (
  streamsSchedule: StreamSchedule[],
): number[] => {
  const streamsProgress = streamsSchedule.map((schedule) => {
    const start = schedule.scheduleTimes[0].toNumber() * 1000;
    const end =
      schedule.scheduleTimes[schedule.scheduleTimes.length - 1].toNumber() *
      1000;

    const progress = ((Date.now() - start) / (end - start)) * 100;

    return progress > 10 ? progress : 10;
  });

  return streamsProgress;
};

export const getVoteSupply = (voteSchedule: StreamSchedule): BigNumber => {
  const start = voteSchedule.scheduleTimes[0].toNumber() * 1000;
  const end =
    voteSchedule.scheduleTimes[
      voteSchedule.scheduleTimes.length - 1
    ].toNumber() * 1000;

  const totalSupply = voteSchedule.scheduleRewards[0];
  const circulatingSupply = totalSupply
    .mul(Date.now() - start)
    .div(end - start);

  return circulatingSupply;
};

export const getOneDayRewards = (
  streamsSchedule: StreamSchedule[],
): BigNumber[] => {
  const now = Math.floor(Date.now() / 1000);
  const oneDay = 86400;
  const rewards = streamsSchedule.map((schedule) => {
    const streamStart = schedule.scheduleTimes[0].toNumber();
    const streamEnd =
      schedule.scheduleTimes[schedule.scheduleTimes.length - 1].toNumber();

    if (now <= streamStart) {
      return ethers.BigNumber.from(0);
    } // didn't start

    if (now >= streamEnd - oneDay) {
      return ethers.BigNumber.from(0);
    } // ended

    const currentIndex =
      schedule.scheduleTimes.findIndex(
        (indexTime) => now < indexTime.toNumber(),
      ) - 1;

    const indexDuration = schedule.scheduleTimes[currentIndex + 1].sub(
      schedule.scheduleTimes[currentIndex],
    );

    const indexRewards = schedule.scheduleRewards[currentIndex].sub(
      schedule.scheduleRewards[currentIndex + 1],
    );

    const reward = indexRewards.mul(oneDay).div(indexDuration);

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
  const stakedValue =
    Number(ethers.utils.formatUnits(totalStaked, streamDecimals[0])) *
    streamPrices[0];

  const rewardValues = oneDayRewards.map(
    (reward, i) =>
      Number(ethers.utils.formatUnits(reward, streamDecimals[i])) *
      365 *
      streamPrices[i],
  );

  const cumulatedReward = rewardValues.reduce((r1, r2) => r1 + r2);
  const total = (cumulatedReward * 100) / stakedValue;
  const streams = rewardValues.map((reward) => (reward * 100) / stakedValue);

  return { total, streams: streams.slice(1), aurora: streams[0] };
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
