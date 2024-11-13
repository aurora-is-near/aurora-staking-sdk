import { BigNumber } from 'ethers';
import { calculateAprs } from '../src/utils/staking';

jest.useFakeTimers();

const currentDate = new Date('2024-11-13T12:00:00Z');

// A snapshot of data logged from Aurora Plus
const streamsSchedule = [
  {
    scheduleTimes: [
      BigNumber.from('0x6283b870'),
      BigNumber.from('0x62fc1cc0'),
      BigNumber.from('0x63748110'),
      BigNumber.from('0x63ece560'),
      BigNumber.from('0x646549b0'),
      BigNumber.from('0x64dd9690'),
      BigNumber.from('0x6555e370'),
      BigNumber.from('0x65ce3050'),
      BigNumber.from('0x66467d30'),
      BigNumber.from('0x66beca10'),
      BigNumber.from('0x673716f0'),
      BigNumber.from('0x67af63d0'),
      BigNumber.from('0x6827b0b0'),
      BigNumber.from('0x689ffd90'),
      BigNumber.from('0x69184a70'),
      BigNumber.from('0x69909750'),
      BigNumber.from('0x6a08e430'),
      BigNumber.from('0x6a813110'),
      BigNumber.from('0x6af97df0'),
      BigNumber.from('0x6b71cad0'),
      BigNumber.from('0x6bea17b0'),
    ],
    scheduleRewards: [
      BigNumber.from('0x19a4815e0ad0c67f000000'),
      BigNumber.from('0x18e5ec4503e523d4800000'),
      BigNumber.from('0x17e7d023a555a046800000'),
      BigNumber.from('0x166aa5f1977e5af1800000'),
      BigNumber.from('0x14adf4b7320334b9000000'),
      BigNumber.from('0x12ed102d7f303f41585d21'),
      BigNumber.from('0x113f33b957214b50cc20ec'),
      BigNumber.from('0x0fa390cb47e07021795104'),
      BigNumber.from('0x0e196195c65604b36893b8'),
      BigNumber.from('0x0c9fe8ae250998e1f5db5d'),
      BigNumber.from('0x0b3670b18eff1d64fbf7c2'),
      BigNumber.from('0x09dc4bedde78540b3cd05f'),
      BigNumber.from('0x0890d40e25b863c204d3f3'),
      BigNumber.from('0x075369cac1ae016887bbb3'),
      BigNumber.from('0x0623749cd01bedfe15b631'),
      BigNumber.from('0x05006274e478659ee3c9b1'),
      BigNumber.from('0x03e9a774d84b494b3b9d85'),
      BigNumber.from('0x02debdac95510f71eb7a79'),
      BigNumber.from('0x01df24d9b9169458441865'),
      BigNumber.from('0xea6229f3206ba5b70714'),
      BigNumber.from('0x00'),
    ],
  },
  {
    scheduleTimes: [
      BigNumber.from('0x6283b870'),
      BigNumber.from('0x62fc1cc0'),
      BigNumber.from('0x63748110'),
      BigNumber.from('0x63ece560'),
      BigNumber.from('0x646549b0'),
    ],
    scheduleRewards: [
      BigNumber.from('0x013842bc01733068e9800000'),
      BigNumber.from('0x01096bec9ad51c592ce00000'),
      BigNumber.from('0xcaf82d6757ac4431600000'),
      BigNumber.from('0x6d4a8e9a1b8424b8200000'),
      BigNumber.from('0x00'),
    ],
  },
  {
    scheduleTimes: [
      BigNumber.from('0x6283b870'),
      BigNumber.from('0x62fc1cc0'),
      BigNumber.from('0x63748110'),
      BigNumber.from('0x63ece560'),
      BigNumber.from('0x646549b0'),
    ],
    scheduleRewards: [
      BigNumber.from('0xd3c21bcecceda1000000'),
      BigNumber.from('0xb3fe97a2fafd2f400000'),
      BigNumber.from('0x89a49213386742400000'),
      BigNumber.from('0x4a1d89bb94865ec00000'),
      BigNumber.from('0x00'),
    ],
  },
  {
    scheduleTimes: [
      BigNumber.from('0x6283b870'),
      BigNumber.from('0x62fc1cc0'),
      BigNumber.from('0x63748110'),
      BigNumber.from('0x63ece560'),
      BigNumber.from('0x646549b0'),
    ],
    scheduleRewards: [
      BigNumber.from('0x7c13bc4b2c133c56000000'),
      BigNumber.from('0x69772cd97f1059af800000'),
      BigNumber.from('0x50a66d97430c80d1800000'),
      BigNumber.from('0x2b6d4eb3e906bb84800000'),
      BigNumber.from('0x00'),
    ],
  },
  {
    scheduleTimes: [BigNumber.from('0x6283b870'), BigNumber.from('0x62fc1cc0')],
    scheduleRewards: [
      BigNumber.from('0x017d2a320dd74555000000'),
      BigNumber.from('0x00'),
    ],
  },
  {
    scheduleTimes: [BigNumber.from('0x62da8e5e'), BigNumber.from('0x65920080')],
    scheduleRewards: [
      BigNumber.from('0x033b2e3c9fd0803ce8000000'),
      BigNumber.from('0x00'),
    ],
  },
];

const totalStaked = BigNumber.from('0x29e8fc8cde8b0a5b7fecce');

const streamDecimals = [18, 18, 18, 18, 18, 18];
const streamPrices = [
  0.135344, 0.00007611, 0.00141883, 0.00000127, 0.245603, 0,
];

describe('Staking', () => {
  beforeEach(() => {
    jest.setSystemTime(new Date(currentDate));
  });

  describe('calculateAprs', () => {
    it('returns the expected APR', async () => {
      const result = calculateAprs({
        streamsSchedule,
        streamPrices,
        streamDecimals,
        totalStaked,
      });

      expect(result).toEqual({
        aurora: 13.476340829871345,
        streams: [0, 0, 0, 0, 0],
        total: 13.476340829871345,
      });
    });

    it('returns the expected result for a date far in the past', async () => {
      jest.setSystemTime(new Date('2020-01-01T12:00:00Z'));

      const result = calculateAprs({
        streamsSchedule,
        streamPrices,
        streamDecimals,
        totalStaked,
      });

      expect(result).toEqual({
        aurora: 0,
        streams: [0, 0, 0, 0, 0],
        total: 0,
      });
    });
  });
});