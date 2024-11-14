import { StreamSchedule } from '../types/stream.js';
import { isDefined } from './is-defined.js';

export const getScheduleStartAndEndTimes = (schedule: StreamSchedule) => {
  const startTime = schedule.scheduleTimes[0];
  const endTime = schedule.scheduleTimes[schedule.scheduleTimes.length - 1];

  if (!isDefined(startTime) || !isDefined(endTime)) {
    throw new Error('Invalid schedule: no schedule times found');
  }

  return {
    startTime: startTime.toNumber() * 1000,
    endTime: endTime.toNumber() * 1000,
  };
};
