'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWriteContract,
} from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import {
  Address,
  decodeEventLog,
  formatUnits,
  isAddress,
  parseUnits,
  zeroAddress,
} from 'viem';
import { VERIFIED_B20_STOCKS } from '../config/stocks';
import { CONTRACT_CONFIGS } from '../config/contracts';
import {
  BONDING_CURVE_ABI,
  ERC20_ABI,
  FACTORY_ABI,
  FEE_VAULT_ABI,
  ROUTER_ABI,
  STOCK_ABI,
} from '../config/abis';

export const TESTNET_TREASURY_ADDRESS = '0xc96147c68ca8e153e70B3bC4745b8d974bDd212A';
export const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD' as const;
export const MAX_TREASURY_FEE_BPS = 10; // 0.10% (can never exceed 0.1%)

export interface PricePoint {
  time: string;
  priceB20: number;
  priceUsd: number;
}

export interface TokenPair {
  tokenAddress: Address;
  curveAddress: Address;
  pairedStockAddress: Address;
  name: string;
  symbol: string;
  pairedStockSymbol: string;
  isGraduated: boolean;
  ratePerStock: number;
  stockPriceUsd: number;
  b20Reserve: number;
  tokenReserve: number;
  creatorFeeBps: number;
  mode: 'CURVE' | 'INSTANT' | 'GRADUATED';
  sharesAccumulated: number;
  targetShares: number;
  maxWalletBps?: number;
  maxWalletTokens?: number;
  creatorAddress?: string;
  feeRecipient?: string;
  tokenManager?: string;
  isManagerRenounced?: boolean;
  isTreasuryRedirected?: boolean;
  claimableRawFees?: number;
  totalCollectedRawFees?: number;
  treasuryBurnedShares?: number;
  volumeB20: number;
  pricePoints: PricePoint[];
}

export interface SwapQuoteResult {
  amountOutWei: bigint;
  amountOut: number;
  feeWei: bigint;
  fee: number;
  priceImpactBps: number;
}

interface ProtocolContextType {
  isMainnet: boolean;
  isSepolia: boolean;
  isMainnetPaused: boolean;
  isLoadingPools: boolean;
  treasuryFeeBps: number;
  treasuryFeeRecipient: string;
  stockBalances: Record<string, number>;
  tokenBalances: Record<string, number>;
  communityTokens: TokenPair[];
  refreshProtocolState: () => Promise<void>;
  claimFaucet: (stockSymbol?: string) => Promise<string>;
  getSwapQuote: (
    tokenAddress: Address,
    amountHuman: string,
    isTokenToStock: boolean
  ) => Promise<SwapQuoteResult>;
  executeApproval: (assetAddress: Address, amountHuman: string) => Promise<string>;
  executeSwap: (params: {
    tokenAddress: Address;
    stockAddress: Address;
    fromAmount: string;
    minAmountOutWei: bigint;
    isTokenToStock: boolean;
  }) => Promise<string>;
  executeLaunch: (params: {
    name: string;
    symbol: string;
    stockSymbol: string;
    mode: 'CURVE' | 'INSTANT';
    initialDeposit: number;
    creatorFeeBps: number;
    antiDumpMode: string;
    feeDestination: 'CREATOR' | 'STOCK_TREASURY' | 'CUSTOM';
    customRecipient?: string;
  }) => Promise<{ txHash: string; token: TokenPair }>;
  executeClaimFees: (tokenIdentifier: string) => Promise<string>;
  executeBurnFeesToTreasury: (tokenIdentifier: string) => Promise<string>;
  executeRedirectFees: (tokenIdentifier: string, newRecipient: string) => Promise<string>;
  executeRenounceManagement: (tokenIdentifier: string) => Promise<string>;
  isFaucetOpen: boolean;
  setIsFaucetOpen: (open: boolean) => void;
  faucetSuccessMsg: string | null;
  faucetTxHash: string | null;
  clearFaucetMsg: () => void;
}

const ProtocolContext = createContext<ProtocolContextType | null>(null);

function toWeiSafe(amount: number | string): bigint {
  const str = typeof amount === 'number' ? amount.toFixed(18) : amount.trim();
  if (!str || Number.isNaN(Number(str)) || Number(str) <= 0) return BigInt(0);
  // Normalize scientific notation or overly long decimals to <= 18 decimal places
  const num = Number(str);
  const fixed = num.toFixed(18).replace(/\.?0+$/, '') || '0';
  return parseUnits(fixed, 18);
}

function formatWalletError(err: any): string {
  const msg = err?.shortMessage || err?.message || 'Transaction failed.';
  if (msg.includes('User rejected') || msg.includes('User denied') || err?.name === 'UserRejectedRequestError') {
    return 'Transaction cancelled in wallet.';
  }
  if (msg.includes('MaxWalletExceeded')) {
    return 'Trade exceeds the token anti-sniper max-wallet cap. Reduce trade amount.';
  }
  if (msg.includes('SlippageExceeded')) {
    return 'Slippage tolerance exceeded. Increase slippage or lower trade size.';
  }
  if (msg.includes('ZeroAmount')) {
    return 'No claimable fees available on-chain yet.';
  }
  if (msg.includes('Unauthorized')) {
    return 'Only the designated token manager wallet can perform this action.';
  }
  if (msg.includes('InsufficientBalance') || msg.includes('TransferFailed')) {
    return 'Insufficient token balance or allowance for this transaction.';
  }
  return msg;
}

const DEFAULT_STOCK_BALANCES: Record<string, number> = {
  bCOIN: 0,
  bNVDA: 0,
  bAAPL: 0,
  bTSLA: 0,
};

export function ProtocolProvider({ children }: { children: React.ReactNode }) {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: baseSepolia.id });
  const { writeContractAsync } = useWriteContract();

  const isMainnet = isConnected && chainId === base.id;
  const isSepolia = !isMainnet;
  const isMainnetPaused = true;

  const [stockBalances, setStockBalances] = useState<Record<string, number>>(DEFAULT_STOCK_BALANCES);
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({});
  const [communityTokens, setCommunityTokens] = useState<TokenPair[]>([]);
  const [treasuryFeeBps, setTreasuryFeeBps] = useState<number>(MAX_TREASURY_FEE_BPS);
  const [treasuryFeeRecipient, setTreasuryFeeRecipient] = useState<string>(TESTNET_TREASURY_ADDRESS);
  const [isLoadingPools, setIsLoadingPools] = useState<boolean>(true);
  const [isFaucetOpen, setIsFaucetOpen] = useState(false);
  const [faucetSuccessMsg, setFaucetSuccessMsg] = useState<string | null>(null);
  const [faucetTxHash, setFaucetTxHash] = useState<string | null>(null);

  const sepoliaConfig = CONTRACT_CONFIGS[baseSepolia.id];

  const ensureSepoliaWallet = () => {
    if (!isConnected || !address) {
      throw new Error('Please connect your wallet first.');
    }
    if (chainId === base.id) {
      throw new Error('Base Mainnet is currently paused. Please switch to Base Sepolia Testnet.');
    }
    if (chainId !== baseSepolia.id) {
      throw new Error('Please switch your wallet network to Base Sepolia Testnet.');
    }
    if (!publicClient) {
      throw new Error('Base Sepolia RPC client not ready. Please try again.');
    }
  };

  const refreshProtocolState = useCallback(async () => {
    if (!publicClient) return;

    if (isMainnet && isMainnetPaused) {
      setCommunityTokens([]);
      setStockBalances(DEFAULT_STOCK_BALANCES);
      setTokenBalances({});
      setTreasuryFeeBps(0);
      setTreasuryFeeRecipient(zeroAddress);
      setIsLoadingPools(false);
      return;
    }

    const activeUserOnSepolia = isConnected && address && chainId === baseSepolia.id ? address : undefined;

    try {
      // 1. Read user's real on-chain Base Sepolia stock balances (starts at 0 until claimed on-chain)
      if (activeUserOnSepolia) {
        const stockBalResults = await Promise.all(
          VERIFIED_B20_STOCKS.map((stock) =>
            publicClient
              .readContract({
                address: stock.address[baseSepolia.id],
                abi: STOCK_ABI,
                functionName: 'balanceOf',
                args: [activeUserOnSepolia],
              })
              .catch(() => BigInt(0))
          )
        );
        const nextStockBalances: Record<string, number> = {};
        VERIFIED_B20_STOCKS.forEach((stock, idx) => {
          nextStockBalances[stock.symbol] = Number(formatUnits(stockBalResults[idx], 18));
        });
        setStockBalances(nextStockBalances);
      } else {
        setStockBalances(DEFAULT_STOCK_BALANCES);
      }

      // 2. Read live protocol fee settings & all launched tokens from BulldotFactory on Base Sepolia
      const [feeBpsRaw, feeRecipRaw, tokenCountRaw] = await Promise.all([
        publicClient
          .readContract({
            address: sepoliaConfig.factory,
            abi: FACTORY_ABI,
            functionName: 'protocolFeeBps',
          })
          .catch(() => BigInt(MAX_TREASURY_FEE_BPS)),
        publicClient
          .readContract({
            address: sepoliaConfig.factory,
            abi: FACTORY_ABI,
            functionName: 'protocolFeeRecipient',
          })
          .catch(() => TESTNET_TREASURY_ADDRESS as Address),
        publicClient
          .readContract({
            address: sepoliaConfig.factory,
            abi: FACTORY_ABI,
            functionName: 'allTokensCount',
          })
          .catch(() => BigInt(0)),
      ]);

      setTreasuryFeeBps(Number(feeBpsRaw));
      setTreasuryFeeRecipient(feeRecipRaw);

      const totalTokens = Number(tokenCountRaw);
      if (totalTokens === 0) {
        setCommunityTokens([]);
        setTokenBalances({});
        setIsLoadingPools(false);
        return;
      }

      // 3. Fetch launched token addresses (newest first)
      const tokenAddresses = await Promise.all(
        Array.from({ length: totalTokens }, (_, idx) =>
          publicClient.readContract({
            address: sepoliaConfig.factory,
            abi: FACTORY_ABI,
            functionName: 'allLaunchedTokens',
            args: [BigInt(totalTokens - 1 - idx)],
          })
        )
      );

      const curveAddresses = await Promise.all(
        tokenAddresses.map((tokenAddr) =>
          publicClient.readContract({
            address: sepoliaConfig.factory,
            abi: FACTORY_ABI,
            functionName: 'tokenToCurve',
            args: [tokenAddr],
          })
        )
      );

      const latestBlock = await publicClient.getBlockNumber().catch(() => sepoliaConfig.deploymentBlock);
      const safeLogFromBlock =
        latestBlock > sepoliaConfig.deploymentBlock + BigInt(9000)
          ? latestBlock - BigInt(9000)
          : sepoliaConfig.deploymentBlock;

      // Only query InstantPoolLaunched logs if any token uses Instant Pool mode (curve === zeroAddress)
      let instantLogs: any[] = [];
      if (curveAddresses.some((c) => c === zeroAddress)) {
        try {
          instantLogs = await publicClient.getLogs({
            address: sepoliaConfig.factory,
            event: FACTORY_ABI[1],
            fromBlock: safeLogFromBlock,
            toBlock: latestBlock,
          });
        } catch {}
      }

      const nextTokenBalances: Record<string, number> = {};

      const pairs = await Promise.all(
        tokenAddresses.map(async (tokenAddr, idx): Promise<TokenPair | null> => {
          const curveAddr = curveAddresses[idx];
          try {
            const [name, symbol, userBalRaw, vaultFeeRecipient, vaultManager] = await Promise.all([
              publicClient.readContract({ address: tokenAddr, abi: ERC20_ABI, functionName: 'name' }),
              publicClient.readContract({ address: tokenAddr, abi: ERC20_ABI, functionName: 'symbol' }),
              activeUserOnSepolia
                ? publicClient
                    .readContract({
                      address: tokenAddr,
                      abi: ERC20_ABI,
                      functionName: 'balanceOf',
                      args: [activeUserOnSepolia],
                    })
                    .catch(() => BigInt(0))
                : Promise.resolve(BigInt(0)),
              publicClient
                .readContract({
                  address: sepoliaConfig.feeVault,
                  abi: FEE_VAULT_ABI,
                  functionName: 'feeRecipients',
                  args: [tokenAddr],
                })
                .catch(() => zeroAddress),
              publicClient
                .readContract({
                  address: sepoliaConfig.feeVault,
                  abi: FEE_VAULT_ABI,
                  functionName: 'tokenManagers',
                  args: [tokenAddr],
                })
                .catch(() => zeroAddress),
            ]);

            nextTokenBalances[symbol] = Number(formatUnits(userBalRaw, 18));

            let pairedStockAddr: Address = VERIFIED_B20_STOCKS[0].address[baseSepolia.id];
            let creator = zeroAddress as Address;
            let feeRecipient = vaultFeeRecipient;
            let creatorFeeBps = 100;
            let b20Reserve = 0;
            let tokenReserve = 1_000_000_000;
            let sharesAccumulated = 0;
            let targetShares = 50;
            let isGraduated = false;
            let ratePerStock = 35_766_667;
            let maxWalletTokens = 0;
            let maxWalletBps = 0;
            let mode: 'CURVE' | 'INSTANT' | 'GRADUATED' = 'CURVE';
            let volumeB20 = 0;
            let pricePoints: PricePoint[] = [];

            if (curveAddr !== zeroAddress) {
              const [
                stockAddr,
                curveCreator,
                curveFeeRecipient,
                curveFeeBpsRaw,
                curveMaxWalletRaw,
                liquidityData,
              ] = await Promise.all([
                publicClient.readContract({
                  address: curveAddr,
                  abi: BONDING_CURVE_ABI,
                  functionName: 'b20Stock',
                }),
                publicClient.readContract({
                  address: curveAddr,
                  abi: BONDING_CURVE_ABI,
                  functionName: 'creator',
                }),
                publicClient.readContract({
                  address: curveAddr,
                  abi: BONDING_CURVE_ABI,
                  functionName: 'feeRecipient',
                }),
                publicClient.readContract({
                  address: curveAddr,
                  abi: BONDING_CURVE_ABI,
                  functionName: 'creatorFeeBps',
                }),
                publicClient.readContract({
                  address: curveAddr,
                  abi: BONDING_CURVE_ABI,
                  functionName: 'maxWalletTokens',
                }),
                publicClient.readContract({
                  address: curveAddr,
                  abi: BONDING_CURVE_ABI,
                  functionName: 'getPoolLiquidity',
                }),
              ]);

              pairedStockAddr = stockAddr;
              creator = curveCreator;
              if (feeRecipient === zeroAddress) feeRecipient = curveFeeRecipient;
              creatorFeeBps = Number(curveFeeBpsRaw);
              maxWalletTokens = Number(formatUnits(curveMaxWalletRaw, 18));
              maxWalletBps = Math.round((maxWalletTokens / 800_000_000) * 10_000);

              const [rawB20Bal, tokenBal, virtualB20, virtualTokens, sharesAcc, targetSh, grad] =
                liquidityData;
              b20Reserve = Number(formatUnits(rawB20Bal, 18));
              tokenReserve = Number(formatUnits(tokenBal, 18));
              sharesAccumulated = Number(formatUnits(sharesAcc, 18));
              targetShares = Number(formatUnits(targetSh, 18));
              isGraduated = grad;
              mode = grad ? 'GRADUATED' : 'CURVE';

              const vB20Num = Number(formatUnits(virtualB20, 18));
              const vTokNum = Number(formatUnits(virtualTokens, 18));
              if (vB20Num > 0 && vTokNum > 0) {
                ratePerStock = vTokNum / vB20Num;
              }
            } else {
              mode = 'INSTANT';
              isGraduated = true;
              const match = instantLogs.find(
                (l) => l.args?.token?.toLowerCase() === tokenAddr.toLowerCase()
              );
              if (match?.args) {
                pairedStockAddr = match.args.b20Stock;
                creator = match.args.creator;
                if (feeRecipient === zeroAddress) feeRecipient = match.args.feeRecipient;
                creatorFeeBps = Number(match.args.creatorFeeBps || 0);
                b20Reserve = Number(formatUnits(match.args.initialB20Amount || BigInt(0), 18));
                tokenReserve = Number(formatUnits(match.args.initialTokenAmount || BigInt(0), 18));
                if (b20Reserve > 0) ratePerStock = tokenReserve / b20Reserve;
                sharesAccumulated = b20Reserve;
              }
            }

            const matchedStock =
              VERIFIED_B20_STOCKS.find(
                (s) => s.address[baseSepolia.id].toLowerCase() === pairedStockAddr.toLowerCase()
              ) || VERIFIED_B20_STOCKS[0];

            const feeMetrics = await publicClient
              .readContract({
                address: sepoliaConfig.feeVault,
                abi: FEE_VAULT_ABI,
                functionName: 'getFeeMetrics',
                args: [tokenAddr, pairedStockAddr],
              })
              .catch(() => [BigInt(0), BigInt(0), BigInt(0), BigInt(0), BigInt(1e18)] as const);

            const totalReceived = Number(formatUnits(feeMetrics[0], 18));
            const rawClaimed = Number(formatUnits(feeMetrics[2], 18));
            const pendingRaw = Number(formatUnits(feeMetrics[3], 18));
            const isDead = feeRecipient.toLowerCase() === DEAD_ADDRESS.toLowerCase();

            // Fetch real on-chain trade logs for curve price & volume history (bounded range)
            const spotPriceB20 = ratePerStock > 0 ? 1 / ratePerStock : 0;
            const spotPriceUsd = spotPriceB20 * matchedStock.referencePriceUsd;

            if (curveAddr !== zeroAddress) {
              try {
                const [buyLogs, sellLogs] = await Promise.all([
                  publicClient.getLogs({
                    address: curveAddr,
                    event: BONDING_CURVE_ABI[0],
                    fromBlock: safeLogFromBlock,
                    toBlock: latestBlock,
                  }),
                  publicClient.getLogs({
                    address: curveAddr,
                    event: BONDING_CURVE_ABI[1],
                    fromBlock: safeLogFromBlock,
                    toBlock: latestBlock,
                  }),
                ]);

                const combined = [
                  ...buyLogs.map((l) => ({
                    blockNumber: l.blockNumber || BigInt(0),
                    b20Vol: Number(formatUnits((l.args as any)?.b20AmountIn || BigInt(0), 18)),
                    tokVol: Number(formatUnits((l.args as any)?.tokensOut || BigInt(0), 18)),
                  })),
                  ...sellLogs.map((l) => ({
                    blockNumber: l.blockNumber || BigInt(0),
                    b20Vol: Number(formatUnits((l.args as any)?.b20Out || BigInt(0), 18)),
                    tokVol: Number(formatUnits((l.args as any)?.tokenAmountIn || BigInt(0), 18)),
                  })),
                ].sort((a, b) => Number(a.blockNumber - b.blockNumber));

                volumeB20 = combined.reduce((acc, ev) => acc + ev.b20Vol, 0);

                if (combined.length > 0) {
                  pricePoints = combined.map((ev, i) => {
                    const tradePriceB20 = ev.tokVol > 0 ? ev.b20Vol / ev.tokVol : spotPriceB20;
                    return {
                      time: i === combined.length - 1 ? 'Now' : `Block #${ev.blockNumber.toString().slice(-4)}`,
                      priceB20: tradePriceB20,
                      priceUsd: tradePriceB20 * matchedStock.referencePriceUsd,
                    };
                  });
                }
              } catch {}
            }

            if (pricePoints.length === 0) {
              pricePoints = [
                { time: 'Launch', priceB20: spotPriceB20, priceUsd: spotPriceUsd },
                { time: 'Now', priceB20: spotPriceB20, priceUsd: spotPriceUsd },
              ];
            } else if (pricePoints.length === 1) {
              pricePoints.push({ time: 'Now', priceB20: spotPriceB20, priceUsd: spotPriceUsd });
            }

            return {
              tokenAddress: tokenAddr,
              curveAddress: curveAddr,
              pairedStockAddress: pairedStockAddr,
              name,
              symbol,
              pairedStockSymbol: matchedStock.symbol,
              isGraduated,
              ratePerStock,
              stockPriceUsd: matchedStock.referencePriceUsd,
              b20Reserve,
              tokenReserve,
              creatorFeeBps,
              mode,
              sharesAccumulated,
              targetShares,
              maxWalletBps,
              maxWalletTokens,
              creatorAddress: creator,
              feeRecipient,
              tokenManager: vaultManager,
              isManagerRenounced: vaultManager === zeroAddress,
              isTreasuryRedirected: isDead,
              claimableRawFees: pendingRaw,
              totalCollectedRawFees: totalReceived,
              treasuryBurnedShares: isDead ? rawClaimed : 0,
              volumeB20,
              pricePoints,
            };
          } catch (err) {
            console.error(`Failed loading token ${tokenAddr}:`, err);
            return null;
          }
        })
      );

      setTokenBalances(nextTokenBalances);
      setCommunityTokens(pairs.filter((p): p is TokenPair => p !== null));
    } catch (err) {
      console.error('Failed refreshing Base Sepolia state:', err);
    } finally {
      setIsLoadingPools(false);
    }
  }, [publicClient, isConnected, address, chainId, isMainnet, isMainnetPaused, sepoliaConfig]);

  useEffect(() => {
    refreshProtocolState();
    const interval = setInterval(() => {
      refreshProtocolState();
    }, 15_000);
    return () => clearInterval(interval);
  }, [refreshProtocolState]);

  // 1. On-Chain Faucet: calls MockB20Stock.faucet() directly on Base Sepolia
  const claimFaucet = async (stockSymbol: string = 'bCOIN'): Promise<string> => {
    ensureSepoliaWallet();
    const stock = VERIFIED_B20_STOCKS.find((s) => s.symbol === stockSymbol);
    if (!stock) throw new Error(`Unknown stock symbol: ${stockSymbol}`);

    try {
      const hash = await writeContractAsync({
        address: stock.address[baseSepolia.id],
        abi: STOCK_ABI,
        functionName: 'faucet',
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      await refreshProtocolState();

      setFaucetTxHash(hash);
      setFaucetSuccessMsg(
        `Verified on Base Sepolia! Minted +100 ${stockSymbol} on-chain. Tx: ${hash.slice(0, 10)}...${hash.slice(-6)}`
      );
      setTimeout(() => {
        setFaucetSuccessMsg(null);
        setFaucetTxHash(null);
      }, 10_000);
      return hash;
    } catch (err) {
      throw new Error(formatWalletError(err));
    }
  };

  const clearFaucetMsg = () => {
    setFaucetSuccessMsg(null);
    setFaucetTxHash(null);
  };

  // 2. Live On-Chain Swap Quote via BulldotRouter.getQuote
  const getSwapQuote = async (
    tokenAddress: Address,
    amountHuman: string,
    isTokenToStock: boolean
  ): Promise<SwapQuoteResult> => {
    if (!publicClient || !tokenAddress) {
      return { amountOutWei: BigInt(0), amountOut: 0, feeWei: BigInt(0), fee: 0, priceImpactBps: 0 };
    }
    const amountWei = toWeiSafe(amountHuman);
    if (amountWei === BigInt(0)) {
      return { amountOutWei: BigInt(0), amountOut: 0, feeWei: BigInt(0), fee: 0, priceImpactBps: 0 };
    }
    try {
      const [amountOutWei, feeWei, priceImpactBpsRaw] = await publicClient.readContract({
        address: sepoliaConfig.router,
        abi: ROUTER_ABI,
        functionName: 'getQuote',
        args: [tokenAddress, amountWei, isTokenToStock],
      });
      return {
        amountOutWei,
        amountOut: Number(formatUnits(amountOutWei, 18)),
        feeWei,
        fee: Number(formatUnits(feeWei, 18)),
        priceImpactBps: Number(priceImpactBpsRaw),
      };
    } catch {
      return { amountOutWei: BigInt(0), amountOut: 0, feeWei: BigInt(0), fee: 0, priceImpactBps: 0 };
    }
  };

  // 3. Exact ERC-20 Approval to BulldotRouter (skipped automatically if allowance >= needed)
  const executeApproval = async (assetAddress: Address, amountHuman: string): Promise<string> => {
    ensureSepoliaWallet();
    const amountWei = toWeiSafe(amountHuman);
    if (amountWei === BigInt(0)) throw new Error('Invalid approval amount.');

    try {
      const currentAllowance = await publicClient!.readContract({
        address: assetAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address!, sepoliaConfig.router],
      });

      if (currentAllowance >= amountWei) {
        return 'ALREADY_APPROVED';
      }

      const hash = await writeContractAsync({
        address: assetAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [sepoliaConfig.router, amountWei],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      return hash;
    } catch (err) {
      throw new Error(formatWalletError(err));
    }
  };

  // 4. Genuine On-Chain Swap via BulldotRouter
  const executeSwap = async ({
    tokenAddress,
    stockAddress,
    fromAmount,
    minAmountOutWei,
    isTokenToStock,
  }: {
    tokenAddress: Address;
    stockAddress: Address;
    fromAmount: string;
    minAmountOutWei: bigint;
    isTokenToStock: boolean;
  }): Promise<string> => {
    ensureSepoliaWallet();
    const amountInWei = toWeiSafe(fromAmount);
    if (amountInWei === BigInt(0)) throw new Error('Invalid trade amount.');

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

    try {
      const hash = await writeContractAsync({
        address: sepoliaConfig.router,
        abi: ROUTER_ABI,
        functionName: isTokenToStock ? 'swapTokensForB20' : 'swapB20ForTokens',
        args: [tokenAddress, stockAddress, amountInWei, minAmountOutWei, address!, deadline],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      await refreshProtocolState();
      return hash;
    } catch (err) {
      throw new Error(formatWalletError(err));
    }
  };

  // 5. Genuine On-Chain Launch via BulldotFactory
  const executeLaunch = async ({
    name,
    symbol,
    stockSymbol,
    mode,
    initialDeposit,
    creatorFeeBps,
    antiDumpMode,
    feeDestination,
    customRecipient,
  }: {
    name: string;
    symbol: string;
    stockSymbol: string;
    mode: 'CURVE' | 'INSTANT';
    initialDeposit: number;
    creatorFeeBps: number;
    antiDumpMode: string;
    feeDestination: 'CREATOR' | 'STOCK_TREASURY' | 'CUSTOM';
    customRecipient?: string;
  }): Promise<{ txHash: string; token: TokenPair }> => {
    ensureSepoliaWallet();

    const selectedStock = VERIFIED_B20_STOCKS.find((s) => s.symbol === stockSymbol);
    if (!selectedStock) throw new Error(`Invalid stock selected: ${stockSymbol}`);
    const stockAddress = selectedStock.address[baseSepolia.id];

    let recipient: Address = address!;
    if (feeDestination === 'STOCK_TREASURY') {
      recipient = DEAD_ADDRESS;
    } else if (feeDestination === 'CUSTOM') {
      if (!customRecipient || !isAddress(customRecipient)) {
        throw new Error('Please enter a valid 0x Ethereum address for the custom fee recipient.');
      }
      recipient = customRecipient as Address;
    }

    try {
      let hash: `0x${string}`;

      if (mode === 'CURVE') {
        const maxWalletBps = antiDumpMode === '2%' ? 200 : antiDumpMode === '1%' ? 100 : 0;
        hash = await writeContractAsync({
          address: sepoliaConfig.factory,
          abi: FACTORY_ABI,
          functionName: 'createBondingCurve',
          args: [
            {
              name: name.trim(),
              symbol: symbol.trim().toUpperCase(),
              b20Stock: stockAddress,
              feeRecipient: recipient,
              creatorFeeBps,
              maxWalletBps,
            },
          ],
        });
      } else {
        const depositWei = toWeiSafe(initialDeposit);
        if (depositWei === BigInt(0)) {
          throw new Error('Instant pool launch requires a non-zero equity deposit.');
        }

        const factoryAllowance = await publicClient!.readContract({
          address: stockAddress,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address!, sepoliaConfig.factory],
        });

        if (factoryAllowance < depositWei) {
          const approveHash = await writeContractAsync({
            address: stockAddress,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [sepoliaConfig.factory, depositWei],
          });
          await publicClient!.waitForTransactionReceipt({ hash: approveHash });
        }

        hash = await writeContractAsync({
          address: sepoliaConfig.factory,
          abi: FACTORY_ABI,
          functionName: 'createInstantPool',
          args: [
            {
              name: name.trim(),
              symbol: symbol.trim().toUpperCase(),
              b20Stock: stockAddress,
              b20Amount: depositWei,
              feeRecipient: recipient,
              creatorFeeBps,
            },
          ],
        });
      }

      const receipt = await publicClient!.waitForTransactionReceipt({ hash });

      // Extract deployed token & curve directly from receipt logs
      let launchedTokenAddr: Address = zeroAddress;
      let launchedCurveAddr: Address = zeroAddress;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== sepoliaConfig.factory.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({
            abi: FACTORY_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'BondingCurveLaunched') {
            launchedTokenAddr = (decoded.args as any).token;
            launchedCurveAddr = (decoded.args as any).curve;
            break;
          } else if (decoded.eventName === 'InstantPoolLaunched') {
            launchedTokenAddr = (decoded.args as any).token;
            break;
          }
        } catch {}
      }

      await refreshProtocolState();

      const fallbackToken: TokenPair = {
        tokenAddress: launchedTokenAddr,
        curveAddress: launchedCurveAddr,
        pairedStockAddress: stockAddress,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        pairedStockSymbol: stockSymbol,
        isGraduated: mode === 'INSTANT',
        ratePerStock: mode === 'INSTANT' ? 1_000_000_000 / Math.max(1e-9, initialDeposit) : 35_766_667,
        stockPriceUsd: selectedStock.referencePriceUsd,
        b20Reserve: mode === 'INSTANT' ? initialDeposit : 0,
        tokenReserve: 1_000_000_000,
        creatorFeeBps,
        mode: mode === 'INSTANT' ? 'INSTANT' : 'CURVE',
        sharesAccumulated: mode === 'INSTANT' ? initialDeposit : 0,
        targetShares: 50,
        maxWalletBps: antiDumpMode === '2%' ? 200 : antiDumpMode === '1%' ? 100 : 0,
        creatorAddress: address,
        feeRecipient: recipient,
        tokenManager: address,
        isManagerRenounced: false,
        isTreasuryRedirected: recipient.toLowerCase() === DEAD_ADDRESS.toLowerCase(),
        claimableRawFees: 0,
        totalCollectedRawFees: 0,
        treasuryBurnedShares: 0,
        volumeB20: 0,
        pricePoints: [],
      };

      return { txHash: hash, token: fallbackToken };
    } catch (err) {
      throw new Error(formatWalletError(err));
    }
  };

  const resolveToken = (tokenIdentifier: string): TokenPair => {
    const found = communityTokens.find(
      (t) =>
        t.tokenAddress.toLowerCase() === tokenIdentifier.toLowerCase() ||
        t.symbol.toUpperCase() === tokenIdentifier.toUpperCase()
    );
    if (!found) throw new Error('Token pool not found on-chain.');
    return found;
  };

  // 6. Claim Fees via BulldotFeeVault
  const executeClaimFees = async (tokenIdentifier: string): Promise<string> => {
    ensureSepoliaWallet();
    const token = resolveToken(tokenIdentifier);
    try {
      const hash = await writeContractAsync({
        address: sepoliaConfig.feeVault,
        abi: FEE_VAULT_ABI,
        functionName: 'claimFees',
        args: [token.tokenAddress, token.pairedStockAddress],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      await refreshProtocolState();
      return hash;
    } catch (err) {
      throw new Error(formatWalletError(err));
    }
  };

  const executeBurnFeesToTreasury = executeClaimFees;

  // 7. Redirect Fee Recipient via BulldotFeeVault
  const executeRedirectFees = async (tokenIdentifier: string, newRecipient: string): Promise<string> => {
    ensureSepoliaWallet();
    if (!isAddress(newRecipient)) {
      throw new Error('Please enter a valid 0x Ethereum address.');
    }
    const token = resolveToken(tokenIdentifier);
    try {
      const hash = await writeContractAsync({
        address: sepoliaConfig.feeVault,
        abi: FEE_VAULT_ABI,
        functionName: 'redirectFeeRecipient',
        args: [token.tokenAddress, newRecipient as Address],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      await refreshProtocolState();
      return hash;
    } catch (err) {
      throw new Error(formatWalletError(err));
    }
  };

  // 8. Renounce Manager Rights Permanently via BulldotFeeVault
  const executeRenounceManagement = async (tokenIdentifier: string): Promise<string> => {
    ensureSepoliaWallet();
    const token = resolveToken(tokenIdentifier);
    try {
      const hash = await writeContractAsync({
        address: sepoliaConfig.feeVault,
        abi: FEE_VAULT_ABI,
        functionName: 'renounceTokenManager',
        args: [token.tokenAddress],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      await refreshProtocolState();
      return hash;
    } catch (err) {
      throw new Error(formatWalletError(err));
    }
  };

  return (
    <ProtocolContext.Provider
      value={{
        isMainnet,
        isSepolia,
        isMainnetPaused,
        isLoadingPools,
        treasuryFeeBps,
        treasuryFeeRecipient,
        stockBalances,
        tokenBalances,
        communityTokens,
        refreshProtocolState,
        claimFaucet,
        getSwapQuote,
        executeApproval,
        executeSwap,
        executeLaunch,
        executeClaimFees,
        executeBurnFeesToTreasury,
        executeRedirectFees,
        executeRenounceManagement,
        isFaucetOpen,
        setIsFaucetOpen,
        faucetSuccessMsg,
        faucetTxHash,
        clearFaucetMsg,
      }}
    >
      {children}
    </ProtocolContext.Provider>
  );
}

export function useProtocol() {
  const context = useContext(ProtocolContext);
  if (!context) {
    throw new Error('useProtocol must be used within a ProtocolProvider');
  }
  return context;
}
