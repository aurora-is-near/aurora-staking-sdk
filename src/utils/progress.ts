import { StreamSchedule } from '../types/stream.js';
import { getScheduleStartAndEndTimes } from './schedule.js';

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
