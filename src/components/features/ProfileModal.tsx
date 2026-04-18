"use client";

import React, { useState, useEffect } from "react";
import { UserCircle, X, Save, ShieldAlert, GraduationCap, Building2, MapPin, Loader2 } from "lucide-react";
import { getUserProfile, saveUserProfile, UserProfile } from "@/lib/firebase/profile";
import { motion, AnimatePresence } from "framer-motion";

interface ProfileModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ userId, isOpen, onClose }: ProfileModalProps) {
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProfile();
    }
  }, [isOpen, userId]);

  const loadProfile = async () => {
    setLoading(true);
    const data = await getUserProfile(userId);
    if (data) {
      setProfile(data);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveUserProfile(userId, profile);
      onClose();
    } catch (error) {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl glass-panel p-6 overflow-hidden shadow-2xl bg-slate-900/40 backdrop-blur-md max-h-[90vh] overflow-y-auto"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-slate-400"
            >
              <X size={20} />
            </button>

            <div className="flex items-center space-x-3 text-white mb-6">
              <UserCircle size={24} className="text-blue-500" />
              <h2 className="text-xl font-bold">ユーザープロフィール設定</h2>
            </div>
            
            <p className="text-xs text-slate-400 mb-6 bg-blue-900/20 p-3 rounded-lg border border-blue-500/20">
              ここで設定した内容は、AI会議（ハドル）の際に「あなたという人間」の前提知識としてAIに連携されます。
            </p>

            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-500" /></div>
            ) : (
              <div className="space-y-6">
                
                <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <h3 className="text-sm font-bold text-slate-300 flex items-center"><UserCircle size={14} className="mr-2 text-slate-400" />基本情報</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">生年月日</label>
                      <input 
                        type="text"
                        value={profile.birthDate || ""}
                        onChange={e => setProfile({ ...profile, birthDate: e.target.value })}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-blue-500 text-sm placeholder:text-slate-600"
                        placeholder="例: 1990-01-01"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">出身地・居住地</label>
                      <input 
                        type="text"
                        value={profile.origin || ""}
                        onChange={e => setProfile({ ...profile, origin: e.target.value })}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-blue-500 text-sm placeholder:text-slate-600"
                        placeholder="例: 東京都"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10 mt-4">
                  <h3 className="text-sm font-bold text-slate-300 flex items-center"><Building2 size={14} className="mr-2 text-slate-400" />経歴・仕事</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">出身校</label>
                      <input 
                        type="text"
                        value={profile.school || ""}
                        onChange={e => setProfile({ ...profile, school: e.target.value })}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-blue-500 text-sm placeholder:text-slate-600"
                        placeholder="例: 〇〇大学 経済学部"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">勤務先・所属</label>
                      <input 
                        type="text"
                        value={profile.company || ""}
                        onChange={e => setProfile({ ...profile, company: e.target.value })}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-blue-500 text-sm placeholder:text-slate-600"
                        placeholder="例: 株式会社〇〇"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">職種・仕事内容</label>
                      <input 
                        type="text"
                        value={profile.jobTitle || ""}
                        onChange={e => setProfile({ ...profile, jobTitle: e.target.value })}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-blue-500 text-sm placeholder:text-slate-600"
                        placeholder="例: ITエンジニア、営業マネージャー"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-4 rounded-xl bg-red-950/20 border border-red-500/20 mt-4">
                  <h3 className="text-sm font-bold text-red-400 flex items-center"><ShieldAlert size={14} className="mr-2" />健康・持病情報</h3>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">持病・アレルギー・体質</label>
                    <textarea 
                      value={profile.medicalHistory || ""}
                      onChange={e => setProfile({ ...profile, medicalHistory: e.target.value })}
                      className="w-full h-24 bg-black/20 border border-red-500/20 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-red-500 text-sm placeholder:text-slate-600 resize-none"
                      placeholder="例: 花粉症、高血圧、乗り物酔いしやすい、腰痛持ち。※AIがアドバイスする際の配慮事項として活用されます。"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center space-x-2 px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>保存する</span>
                  </button>
                </div>

              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
