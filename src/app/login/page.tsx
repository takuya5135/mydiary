"use client";

import { loginWithGoogle } from "@/lib/firebase/auth";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Heart, ShieldCheck, Trophy, Sparkles } from "lucide-react";

export default function LoginPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      alert("ログインに失敗しました。コンソールを確認してください。");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md glass-panel p-8 space-y-8 animate-fade-in relative z-10">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-500/20 mb-4">
            <Sparkles className="text-white w-8 h-8" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">my日記</h1>
          <p className="text-slate-400 text-sm italic">
            「したたかに世渡りし、情熱的に遊び、家族を愛するための外部脳」
          </p>
        </div>

        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-4 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="text-orange-400"><Heart size={20} /></div>
            <span className="text-xs text-slate-300">家族と健康をマモる強固な記録</span>
          </div>
          <div className="flex items-center space-x-4 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="text-blue-400"><ShieldCheck size={20} /></div>
            <span className="text-xs text-slate-300">大軍師（Zen）による戦略的な伴走</span>
          </div>
          <div className="flex items-center space-x-4 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="text-emerald-400"><Trophy size={20} /></div>
            <span className="text-xs text-slate-300">やりたいことを達成させる叱咤激励</span>
          </div>
        </div>

        <button
          onClick={handleLogin}
          className="w-full py-4 px-6 rounded-xl bg-white text-slate-950 font-bold flex items-center justify-center space-x-3 hover:bg-slate-100 transition-all active:scale-[0.98] shadow-xl shadow-white/10"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          <span>Googleアカウントで始める</span>
        </button>

        <p className="text-center text-xs text-slate-500">
          一度きりの人生を、最高の布陣で。
        </p>
      </div>
    </main>
  );
}
