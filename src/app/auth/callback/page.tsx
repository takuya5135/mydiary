"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const error = searchParams.get("error");

      if (error) {
        setStatus("error");
        setErrorMessage(`Google連携がキャンセルされたか失敗しました: ${error}`);
        return;
      }

      if (!code) {
        router.push("/");
        return;
      }

      if (!user) {
        // Firebaseユーザーがロードされるのを待つ
        return;
      }

      try {
        const redirectUri = window.location.origin + "/auth/callback";
        
        // APIにコードを送信
        const res = await fetch("/api/auth/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirectUri })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "トークンの取得に失敗しました");
        }

        const data = await res.json();

        // Firestoreにトークンを保存
        const { saveUserToken } = await import("@/lib/firebase/tokens");
        await saveUserToken(
          user.uid,
          data.access_token,
          data.refresh_token,
          user.email
        );

        setStatus("success");

        setTimeout(() => {
          router.push("/");
        }, 1500);

      } catch (err: any) {
        console.error("Token exchange error:", err);
        setStatus("error");
        setErrorMessage(err.message || "予期せぬエラーが発生しました");
      }
    };

    handleCallback();
  }, [searchParams, router, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center">
        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">Googleと連携中...</h2>
            <p className="text-sm text-zinc-400">認証情報を安全に取得しています。画面を閉じないでください。</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">連携完了</h2>
            <p className="text-sm text-zinc-400">Googleカレンダー・タスクとの連携が正常に完了しました！ホームへ戻ります。</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">連携エラー</h2>
            <p className="text-sm text-red-400">{errorMessage}</p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 w-full py-3 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 transition-colors"
            >
              ホームへ戻る
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
