import { Address } from 'viem';

export type LaunchMode = 'INSTANT' | 'BONDING_CURVE';

export interface TokenLaunchParams {
  name: string;
  symbol: string;
  description?: string;
  launchMode: LaunchMode;
  b20StockAddress: Address;
  creatorFeeBps: number;
  feeRecipient?: Address;
  initialDepositAmount?: string; // For instant pool mode
}

export interface BondingCurveProgress {
  totalSharesAccumulated: bigint;
  targetShares: bigint;
  percentComplete: number;
  isGraduated: boolean;
  virtualPriceB20: bigint;
  effectiveMultiplier: bigint;
}
