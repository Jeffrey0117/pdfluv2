"use client";

import { useCallback, useEffect, useState } from "react";

export interface LmuUser {
  id: string;
  email: string;
  displayName?: string;
  avatar?: string;
}

interface LmuSdk {
  ready: boolean;
  user: LmuUser | null;
  login: () => void;
  logout: () => Promise<void>;
  getToken: () => string | null;
  onAuthChange: (cb: (user: LmuUser | null) => void) => () => void;
  openProfile: () => void;
}

declare global {
  interface Window {
    letmeuse?: LmuSdk;
  }
}

export function useLetMeUse() {
  const [user, setUser] = useState<LmuUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let attempts = 0;
    let cancelled = false;

    const tryInit = () => {
      if (cancelled) return;
      const sdk = window.letmeuse;
      // ready / user 是屬性不是方法
      if (!sdk || !sdk.ready) {
        if (++attempts < 80) setTimeout(tryInit, 100);
        else setIsLoading(false); // 8 秒後降級為訪客
        return;
      }
      setUser(sdk.user);
      setIsLoading(false);
      unsubscribe = sdk.onAuthChange((next) => setUser(next));
    };
    tryInit();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const login = useCallback(() => window.letmeuse?.login(), []);
  const logout = useCallback(() => window.letmeuse?.logout(), []);
  const openProfile = useCallback(() => window.letmeuse?.openProfile(), []);
  const getToken = useCallback(() => window.letmeuse?.getToken() ?? null, []);

  return { user, isLoading, login, logout, openProfile, getToken };
}

// 帶 Bearer token 打自家 API（SDK 未就緒時最多等 8 秒）
export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  for (let i = 0; i < 80 && !window.letmeuse?.ready; i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  const token = window.letmeuse?.getToken();
  return fetch(input, {
    ...init,
    headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}
