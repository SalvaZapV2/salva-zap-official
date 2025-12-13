import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Shop, WabaAccount } from "@/lib/types";

const ACTIVE_SHOP_KEY = "active_shop_id";

export function useActiveWaba() {
  const [activeShopId, setActiveShopId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACTIVE_SHOP_KEY);
  });

  const {
    data: shops = [],
    isLoading,
    isError,
    error,
    refetch: refetchShops,
  } = useQuery<Shop[]>({
    queryKey: ["shops"],
    queryFn: () => api.getShops(),
  });

  useEffect(() => {
    if (!shops.length) return;
    const exists = shops.find((shop) => shop.id === activeShopId);
    if (!exists) {
      const fallback = shops[0];
      setActiveShopId(fallback.id);
      if (typeof window !== "undefined") {
        localStorage.setItem(ACTIVE_SHOP_KEY, fallback.id);
      }
    }
  }, [shops, activeShopId]);

  const activeShop = useMemo<Shop | null>(() => {
    return shops.find((shop) => shop.id === activeShopId) || shops[0] || null;
  }, [shops, activeShopId]);

  const activeWaba = useMemo<WabaAccount | null>(() => {
    return activeShop?.waba?.[0] ?? null;
  }, [activeShop]);

  const selectShop = (shopId: string) => {
    setActiveShopId(shopId);
    if (typeof window !== "undefined") {
      localStorage.setItem(ACTIVE_SHOP_KEY, shopId);
    }
  };

  return {
    shops,
    activeShop,
    activeWaba,
    isLoading,
    isError,
    error,
    selectShop,
    refetchShops,
  };
}

