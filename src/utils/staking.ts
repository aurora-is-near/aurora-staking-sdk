import { ethers, JsonRpcProvider } from 'ethers';
import { stakingAbi } from '../abis/staking.js';
import { type AuroraNetwork } from '../types/network.js';
import { logger } from '../logger.js';
import { isDefined } from './is-defined.js';
import { StreamSchedule } from '../types/stream.js';
import { getScheduleStartAndEndTimes } from './schedule.js';
import { getStakingContract } from '../contracts.js';
import { erc20Abi } from '../abis/erc20.js';

export const getDeposit = async (
  account: string,
  provider: JsonRpcProvider,
  network: AuroraNetwork,
): Promise<bigint> => {
  const contract = getStakingContract(network, provider);

  return contract.getUserTotalDeposit(account);
};

export const getUserShares = async (
  account: string,
  streamId: number,
  provider: JsonRpcProvider,
  network: AuroraNetwork,
): Promise<bigint> => {
  const contract = getStakingContract(network, provider);

  return contract.getAmountOfShares(streamId, account);
};

export const getTotalShares = async (
  provider: JsonRpcProvider,
  network: AuroraNetwork,
): Promise<bigint> => {
  const contract = getStakingContract(network, provider);

  return contract.totalAuroraShares();
};

export const getTotalStaked = async (
  provider: JsonRpcProvider,
  network: AuroraNetwork,
): Promise<bigint> => {
  const contract = getStakingContract(network, provider);

  return contract.getTotalAmountOfStakedAurora();
};

export const getPendingWithdrawals = async (
  streamIds: number[],
  streamDecimals: number[],
  account: string,
  provider: JsonRpcProvider,
  network: AuroraNetwork,
): Promise<
  { amount: bigint; releaseTime: number; id: number; decimals: number }[]
> => {
  const contract = getStakingContract(network, provider);

  const pendingAmounts = await Promise.all(
    streamIds.map(async (id) => contract.getPending(id, account)),
  );

  const pendingReleaseTimes = await Promise.all(
    streamIds.map(async (id) => contract.getReleaseTime(id, account)),
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
        releaseTime: Number(releaseTime) * 1000,
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
  provider: JsonRpcProvider,
  network: AuroraNetwork,
): Promise<BigNumber[]> => {
  const contract = getStakingContract(network, provider);

  try {
    const latestStreamedAmounts = await Promise.all(
      streamIds.map(async (id) =>
        contract.getStreamClaimableAmount(id, account),
      ),
    );

    return latestStreamedAmounts;
  } catch (error) {
    logger.error('Zero staked shares?', error);

    return streamIds.map(() => 0n);
  }
};

export const getStreamsSchedule = async (
  streamIds: number[],
  provider: JsonRpcProvider,
  network: AuroraNetwork,
): Promise<StreamSchedule[]> => {
  const contract = getStakingContract(network, provider);

  const streamsSchedule = await Promise.all(
    streamIds.map(async (id) => contract.getStreamSchedule(id)),
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

export const getVoteSupply = (voteSchedule: StreamSchedule): bigint => {
  const { startTime, endTime } = getScheduleStartAndEndTimes(voteSchedule);

  const totalSupply = voteSchedule.scheduleRewards[0];
  const circulatingSupply = totalSupply
    ? totalSupply.mul(Date.now() - startTime).div(endTime - startTime)
    : 0n;

  return circulatingSupply;
};

export const calculateStakedPctOfSupply = (
  totalStaked: bigint,
  auroraPrice: number,
  auroraMarketCap: number,
): number => {
  const circulatingSupply = auroraMarketCap / auroraPrice;
  // Compounding staked AURORA
  const stakedAurora = Number(ethers.formatUnits(totalStaked, 18));
  const pct = (stakedAurora * 100) / circulatingSupply;

  return pct;
};

export const getIsPaused = async (
  provider: JsonRpcProvider,
  network: AuroraNetwork,
): Promise<boolean> => {
  const contract = getStakingContract(network, provider);

  const pausedFlag = await contract.paused();

  return Number(pausedFlag) === 1;
};

export const approveStaking = async (
  provider: JsonRpcProvider,
  network: AuroraNetwork,
) => {
  const auroraToken = new ethers.Contract(
    networkConfig.tokenContractAddress,
    erc20Abi,
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
  network: AuroraNetwork,
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
  network: AuroraNetwork,
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
  network: AuroraNetwork,
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
  network: AuroraNetwork,
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
  network: AuroraNetwork,
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
  network: AuroraNetwork,
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
  network: AuroraNetwork,
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
