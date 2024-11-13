import { BigNumber, ethers } from 'ethers';
import { StreamSchedule } from '../types/stream.js';
import { getScheduleStartAndEndTimes } from './schedule.js';
import { isDefined } from './is-defined.js';

const getOneDayRewards = (streamsSchedule: StreamSchedule[]): BigNumber[] => {
  const now = Date.now();
  const oneDay = 86400;
  const rewards = streamsSchedule.map((schedule) => {
    const { startTime, endTime } = getScheduleStartAndEndTimes(schedule);

    if (now <= startTime) {
      return 0n;
    } // didn't start

    if (now >= endTime - oneDay) {
      return 0n;
    } // ended

    const currentIndex =
      schedule.scheduleTimes.findIndex(
        (indexTime) => Math.floor(now / 1000) < indexTime.toNumber(),
      ) - 1;

    const currentTime = schedule.scheduleTimes[currentIndex];
    const nextTime = schedule.scheduleTimes[currentIndex + 1];

    if (!currentTime || !nextTime) {
      return 0n;
    }

    const indexDuration = nextTime.sub(currentTime);

    const currentReward = schedule.scheduleRewards[currentIndex];
    const nextReward = schedule.scheduleRewards[currentIndex + 1];

    if (!currentReward || !nextReward) {
      return 0n;
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
  const total = cumulatedReward ? (cumulatedReward * 100) / stakedValue : 0;
  const streams = rewardValues.map((reward) => {
    if (!stakedValue) {
      return 0;
    }

    return (reward * 100) / stakedValue;
  });

  const aurora = streams[0];

  if (!isDefined(aurora)) {
    throw new Error('No stream at position 0');
  }

  return { total, streams: streams.slice(1), aurora };
};
