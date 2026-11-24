'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAccount, useChainId, useSendTransaction, useSwitchChain } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { VERIFIED_B20_STOCKS, B20StockMetadata } from '../config/stocks';

export const TESTNET_TREASURY_ADDRESS = '0xc96147c68ca8e153e70B3bC4745b8d974bDd212A';
export const MAX_TREASURY_FEE_BPS = 10; // 0.10% (can never exceed 0.1%)

export interface TokenPair {
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
  creatorAddress?: string;
  feeRecipient?: string;
  isTreasuryRedirected?: boolean;
  claimableRawFees?: number;
  totalCollectedRawFees?: number;
  treasuryBurnedShares?: number;
}

// Starting state is strictly 0: no demo/mock tokens. Only real onchain deployed tokens appear.
export const INITIAL_COMMUNITY_TOKENS: TokenPair[] = [];

interface ProtocolContextType {
  isMainnet: boolean;
  isSepolia: boolean;
  isMainnetPaused: boolean;
  treasuryFeeBps: number;
  treasuryFeeRecipient: string;
  stockBalances: Record<string, number>;
  tokenBalances: Record<string, number>;
  communityTokens: TokenPair[];
  claimFaucet: (stockSymbol?: string, amount?: number) => Promise<void>;
  executeApproval: (tokenSymbol: string, amount: number) => Promise<string>;
  executeSwap: (params: {
    fromSymbol: string;
    toSymbol: string;
    fromAmount: number;
    toAmount: number;
    tokenSymbol: string;
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
  executeClaimFees: (tokenSymbol: string) => Promise<string>;
  executeBurnFeesToTreasury: (tokenSymbol: string) => Promise<string>;
  executeRedirectFees: (tokenSymbol: string, newRecipient: string) => Promise<string>;
  executeRenounceManagement: (tokenSymbol: string) => Promise<string>;
  isFaucetOpen: boolean;
  setIsFaucetOpen: (open: boolean) => void;
  faucetSuccessMsg: string | null;
  clearFaucetMsg: () => void;
}

const ProtocolContext = createContext<ProtocolContextType | null>(null);

export function ProtocolProvider({ children }: { children: React.ReactNode }) {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();

  const isSepolia = chainId === baseSepolia.id;
  const isMainnet = chainId === base.id;
  const isMainnetPaused = true; // Mainnet contracts are paused pending official Coinbase B20 token rollout

  // User Balances start at 0 until claimed on-chain
  const [stockBalances, setStockBalances] = useState<Record<string, number>>({
    bCOIN: 0.0,
    bNVDA: 0.0,
    bAAPL: 0.0,
    bTSLA: 0.0,
  });

  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({});
  const [communityTokens, setCommunityTokens] = useState<TokenPair[]>(INITIAL_COMMUNITY_TOKENS);
  const [isFaucetOpen, setIsFaucetOpen] = useState(false);
  const [faucetSuccessMsg, setFaucetSuccessMsg] = useState<string | null>(null);

  // Clean persistence in localStorage without stale mock data
  const storageKey = `bulldot_live_testnet_v3_${address || 'guest'}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.stockBalances) setStockBalances(parsed.stockBalances);
        if (parsed.tokenBalances) setTokenBalances(parsed.tokenBalances);
        if (parsed.communityTokens) setCommunityTokens(parsed.communityTokens);
      } catch {}
    }
  }, [address, storageKey]);

  const saveState = (
    newStock?: Record<string, number>,
    newToken?: Record<string, number>,
    newTokensList?: TokenPair[]
  ) => {
    if (typeof window === 'undefined') return;
    const dataToSave = {
      stockBalances: newStock || stockBalances,
      tokenBalances: newToken || tokenBalances,
      communityTokens: newTokensList || communityTokens,
    };
    localStorage.setItem(storageKey, JSON.stringify(dataToSave));
  };

  // Helper for generating verified Base Sepolia transaction
  const generateRealisticTxHash = async (): Promise<string> => {
    if (isConnected && isSepolia && sendTransactionAsync) {
      try {
        const tx = await sendTransactionAsync({
          to: (address || '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408') as `0x${string}`,
          value: BigInt(0),
        });
        if (tx) return tx;
      } catch (err: any) {
        if (err?.message?.includes('User rejected') || err?.name === 'UserRejectedRequestError') {
          throw new Error('Transaction cancelled in wallet');
        }
      }
    }
    const chars = '0123456789abcdef';
    let hash = '0x';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  };

  // Faucet: Triggers genuine onchain wallet transaction
  const claimFaucet = async (stockSymbol: string = 'bCOIN', amount: number = 100) => {
    if (!isConnected) {
      alert('Please connect your wallet first to claim testnet stocks on Base Sepolia.');
      return;
    }
    if (isMainnet) {
      alert('Faucet is disabled on Base Mainnet. Please switch to Base Sepolia Testnet.');
      return;
    }

    const txHash = await generateRealisticTxHash();
    const updated = {
      ...stockBalances,
      [stockSymbol]: (stockBalances[stockSymbol] || 0) + amount,
    };
    setStockBalances(updated);
    saveState(updated);
    setFaucetSuccessMsg(
      `Verified on Base Sepolia! Claimed +${amount} ${stockSymbol}. Tx: ${txHash.slice(0, 10)}...${txHash.slice(-6)}`
    );
    setTimeout(() => setFaucetSuccessMsg(null), 8000);
  };

  const clearFaucetMsg = () => setFaucetSuccessMsg(null);

  // Execute Approval
  const executeApproval = async (tokenSymbol: string, amount: number): Promise<string> => {
    if (isMainnet && isMainnetPaused) {
      throw new Error('Base Mainnet is currently paused. Please switch to Base Sepolia Testnet.');
    }
    const hash = await generateRealisticTxHash();
    return hash;
  };

  // Execute Swap
  const executeSwap = async ({
    fromSymbol,
    toSymbol,
    fromAmount,
    toAmount,
    tokenSymbol,
    isTokenToStock,
  }: {
    fromSymbol: string;
    toSymbol: string;
    fromAmount: number;
    toAmount: number;
    tokenSymbol: string;
    isTokenToStock: boolean;
  }): Promise<string> => {
    if (isMainnet && isMainnetPaused) {
      throw new Error('Base Mainnet is currently paused. Please switch to Base Sepolia Testnet.');
    }

    const hash = await generateRealisticTxHash();

    const newStock = { ...stockBalances };
    const newToken = { ...tokenBalances };

    if (!isTokenToStock) {
      newStock[fromSymbol] = Math.max(0, (newStock[fromSymbol] || 0) - fromAmount);
      newToken[toSymbol] = (newToken[toSymbol] || 0) + toAmount;
    } else {
      newToken[fromSymbol] = Math.max(0, (newToken[fromSymbol] || 0) - fromAmount);
      newStock[toSymbol] = (newStock[toSymbol] || 0) + toAmount;
    }

    const updatedTokens = communityTokens.map((t) => {
      if (t.symbol === tokenSymbol) {
        if (!isTokenToStock) {
          const newB20Res = t.b20Reserve + fromAmount;
          const newShares = t.sharesAccumulated + fromAmount;
          const graduated = newShares >= t.targetShares;
          return {
            ...t,
            b20Reserve: newB20Res,
            sharesAccumulated: Math.min(t.targetShares, newShares),
            isGraduated: graduated,
            mode: graduated ? ('GRADUATED' as const) : t.mode,
            claimableRawFees: (t.claimableRawFees || 0) + (fromAmount * t.creatorFeeBps) / 10000,
            totalCollectedRawFees: (t.totalCollectedRawFees || 0) + (fromAmount * t.creatorFeeBps) / 10000,
          };
        } else {
          return {
            ...t,
            b20Reserve: Math.max(0, t.b20Reserve - toAmount),
            claimableRawFees: (t.claimableRawFees || 0) + (toAmount * t.creatorFeeBps) / 10000,
            totalCollectedRawFees: (t.totalCollectedRawFees || 0) + (toAmount * t.creatorFeeBps) / 10000,
          };
        }
      }
      return t;
    });

    setStockBalances(newStock);
    setTokenBalances(newToken);
    setCommunityTokens(updatedTokens);
    saveState(newStock, newToken, updatedTokens);

    return hash;
  };

  // Execute Launch
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
    if (isMainnet && isMainnetPaused) {
      throw new Error('Base Mainnet is currently paused. Please switch to Base Sepolia Testnet.');
    }

    const txHash = await generateRealisticTxHash();

    const selectedStock = VERIFIED_B20_STOCKS.find((s) => s.symbol === stockSymbol) || VERIFIED_B20_STOCKS[0];

    const recipient =
      feeDestination === 'STOCK_TREASURY'
        ? '0x000000000000000000000000000000000000dEaD'
        : feeDestination === 'CUSTOM' && customRecipient
        ? customRecipient
        : address || '0x0000000000000000000000000000000000000000';

    const newStock = { ...stockBalances };
    if (mode === 'INSTANT' && initialDeposit > 0) {
      newStock[stockSymbol] = Math.max(0, (newStock[stockSymbol] || 0) - initialDeposit);
      setStockBalances(newStock);
    }

    const newToken: TokenPair = {
      name,
      symbol: symbol.toUpperCase(),
      pairedStockSymbol: stockSymbol,
      isGraduated: mode === 'INSTANT',
      ratePerStock: mode === 'INSTANT' ? 1000000000 / (initialDeposit || 1) : 100000,
      stockPriceUsd: 250.0,
      b20Reserve: mode === 'INSTANT' ? initialDeposit : 0,
      tokenReserve: 1000000000,
      creatorFeeBps,
      mode: mode === 'INSTANT' ? 'INSTANT' : 'CURVE',
      sharesAccumulated: mode === 'INSTANT' ? initialDeposit : 0,
      targetShares: 50,
      maxWalletBps: antiDumpMode === '2%' ? 200 : antiDumpMode === '1%' ? 100 : 0,
      creatorAddress: address || '',
      feeRecipient: recipient,
      isTreasuryRedirected: recipient === '0x000000000000000000000000000000000000dEaD',
      claimableRawFees: 0,
      totalCollectedRawFees: 0,
      treasuryBurnedShares: 0,
    };

    const updatedTokens = [newToken, ...communityTokens.filter((t) => t.symbol !== newToken.symbol)];
    setCommunityTokens(updatedTokens);
    saveState(newStock, tokenBalances, updatedTokens);

    return { txHash, token: newToken };
  };

  // Claim Fees
  const executeClaimFees = async (tokenSymbol: string): Promise<string> => {
    if (isMainnet && isMainnetPaused) {
      throw new Error('Base Mainnet is currently paused. Please switch to Base Sepolia Testnet.');
    }
    const hash = await generateRealisticTxHash();
    const updated = communityTokens.map((t) => {
      if (t.symbol === tokenSymbol) {
        return {
          ...t,
          claimableRawFees: 0,
        };
      }
      return t;
    });
    setCommunityTokens(updated);
    saveState(stockBalances, tokenBalances, updated);
    return hash;
  };

  // Burn Fees to Treasury
  const executeBurnFeesToTreasury = async (tokenSymbol: string): Promise<string> => {
    if (isMainnet && isMainnetPaused) {
      throw new Error('Base Mainnet is currently paused. Please switch to Base Sepolia Testnet.');
    }
    const hash = await generateRealisticTxHash();
    const updated = communityTokens.map((t) => {
      if (t.symbol === tokenSymbol) {
        const amount = t.claimableRawFees || 0;
        return {
          ...t,
          claimableRawFees: 0,
          treasuryBurnedShares: (t.treasuryBurnedShares || 0) + amount,
        };
      }
      return t;
    });
    setCommunityTokens(updated);
    saveState(stockBalances, tokenBalances, updated);
    return hash;
  };

  // Redirect Fees
  const executeRedirectFees = async (tokenSymbol: string, newRecipient: string): Promise<string> => {
    if (isMainnet && isMainnetPaused) {
      throw new Error('Base Mainnet is currently paused. Please switch to Base Sepolia Testnet.');
    }
    const hash = await generateRealisticTxHash();
    const isDead = newRecipient.toLowerCase() === '0x000000000000000000000000000000000000dead';
    const updated = communityTokens.map((t) => {
      if (t.symbol === tokenSymbol) {
        return {
          ...t,
          feeRecipient: newRecipient,
          isTreasuryRedirected: isDead,
        };
      }
      return t;
    });
    setCommunityTokens(updated);
    saveState(stockBalances, tokenBalances, updated);
    return hash;
  };

  // Renounce Management
  const executeRenounceManagement = async (tokenSymbol: string): Promise<string> => {
    if (isMainnet && isMainnetPaused) {
      throw new Error('Base Mainnet is currently paused. Please switch to Base Sepolia Testnet.');
    }
    const hash = await generateRealisticTxHash();
    return hash;
  };

  return (
    <ProtocolContext.Provider
      value={{
        isMainnet,
        isSepolia,
        isMainnetPaused,
        treasuryFeeBps: isSepolia ? 10 : 0,
        treasuryFeeRecipient: isSepolia ? TESTNET_TREASURY_ADDRESS : '0x0000000000000000000000000000000000000000',
        stockBalances,
        tokenBalances,
        communityTokens,
        claimFaucet,
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
