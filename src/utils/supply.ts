import { BigNumber, ethers } from 'ethers';

export const calculateStakedPctOfSupply = ({
  totalStaked,
  auroraPrice,
  auroraMarketCap,
}: {
  totalStaked: BigNumber;
  auroraPrice: number;
  auroraMarketCap: number;
}): number => {
  const circulatingSupply = auroraMarketCap / auroraPrice;
  const compoundingStakedAurora = Number(
    ethers.utils.formatUnits(totalStaked, 18),
  );

  const pct = (compoundingStakedAurora * 100) / circulatingSupply;

  return pct;
};
