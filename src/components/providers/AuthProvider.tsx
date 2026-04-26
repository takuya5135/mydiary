"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, setPersistence, browserLocalPersistence } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { onAuthChange } from "@/lib/firebase/auth";
import { getUserTokens } from "@/lib/firebase/tokens";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  googleRefreshToken: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  googleRefreshToken: null,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // SWRパターン: まず localStorage からトークンを読み込む
  const [googleRefreshToken, setGoogleRefreshToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("googleRefreshToken");
    }
    return null;
  });

  useEffect(() => {
    // Firebase セッションの永続化を明示
    setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.error("[Auth] Persistence error:", error);
    });

    const unsubscribe = onAuthChange(async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // ユーザーがログインしている場合、最新のトークンをFirestoreから取得してキャッシュを更新
        try {
          const tokens = await getUserTokens(currentUser.uid);
          if (tokens?.refreshToken) {
            setGoogleRefreshToken(tokens.refreshToken);
            localStorage.setItem("googleRefreshToken", tokens.refreshToken);
            console.log("[Auth] Google Refresh Token synced from Firestore");
          }
        } catch (error) {
          console.error("[Auth] Failed to sync tokens:", error);
        }
      }
      
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, googleRefreshToken }}>
      {/* ローディング中は子要素をnullにせず、スピナーを表示してEdgeのエラー誤判定を防ぐ */}
      {loading ? (
        <div className="h-screen w-full flex items-center justify-center bg-slate-950">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500" />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
