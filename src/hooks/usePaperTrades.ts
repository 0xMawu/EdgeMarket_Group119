/**
 * usePaperTrades — fetch the user's paper trading portfolio.
 *
 * Individual trades are copied via the Copy button on each PositionCard.
 * This hook is read-only — it fetches what has been explicitly copied.
 */
import { useState, useEffect, useCallback } from 'react';
import { API_PREFIX } from '../config/api';

export interface PaperTrade {
  id: number;
  targetAddress: string;
  marketId: string;
  marketTitle: string | null;
  outcome: string | null;
  entryPrice: number;
  shares: number;
  livePrice: number | null;
  unrealisedPnl: number | null;
  pnlPercentage: number | null;
  createdAt: string;
}

export interface PaperPortfolio {
  trades: PaperTrade[];
  portfolioSummary: {
    totalTrades: number;
    totalUnrealisedPnl: number;
    groupedByTarget: Record<string, PaperTrade[]>;
  };
}

interface UsePaperTradesOptions {
  userAddress: string | null;
}

export function usePaperTrades({ userAddress }: UsePaperTradesOptions) {
  const [portfolio, setPortfolio] = useState<PaperPortfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userAddress) {
      setPortfolio(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_PREFIX}/paper-trades/${userAddress}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: PaperPortfolio = await res.json();
      setPortfolio(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load paper portfolio');
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { portfolio, loading, error, refresh };
}
