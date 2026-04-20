"use client";

import React, { useState, useEffect } from "react";
import { UserCircle, X, Save, ShieldAlert, Building2, Loader2, Plus, Trash2, Briefcase, Users, Heart } from "lucide-react";
import { getUserProfile, saveUserProfile, UserProfile, JobHistory } from "@/lib/firebase/profile";
import { motion, AnimatePresence } from "framer-motion";

interface ProfileModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ userId, isOpen, onClose }: ProfileModalProps) {
  const [profile, setProfile] = useState<Partial<UserProfile>>({ history: [] });
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
      setProfile({ ...data, history: data.history || [] });
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

  const addHistory = () => {
    const newHistory: JobHistory = { id: Date.now().toString(), from: "", to: "", description: "" };
    setProfile(prev => ({ ...prev, history: [...(prev.history || []), newHistory] }));
  };

  const updateHistory = (id: string, field: keyof JobHistory, value: string) => {
    setProfile(prev => ({
      ...prev,
      history: prev.history?.map(h => h.id === id ? { ...h, [field]: value } : h)
    }));
  };

  const removeHistory = (id: string) => {
    setProfile(prev => ({
      ...prev,
      history: prev.history?.filter(h => h.id !== id)
    }));
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
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 overflow-hidden shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center space-x-3 text-slate-800 dark:text-white mb-6">
              <UserCircle size={28} className="text-blue-500" />
              <h2 className="text-xl font-bold">ユーザープロフィール設定</h2>
            </div>
            
            <p className="text-xs text-sky-800 dark:text-sky-300 mb-6 bg-sky-50 dark:bg-sky-950/40 p-3 rounded-lg border border-sky-200 dark:border-sky-800">
              ここで設定した内容は、AI会議（ハドル）の際に「あなたという人間」の前提知識としてAIに連携されます。
            </p>

            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-500" /></div>
            ) : (
              <div className="space-y-6">
                
                {/* 基本情報 */}
                <div className="space-y-4 p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center">
                    <UserCircle size={16} className="mr-2 text-slate-400" />基本情報
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">生年月日</label>
                      <input 
                        type="text"
                        value={profile.birthDate || ""}
                        onChange={e => setProfile({ ...profile, birthDate: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm placeholder:text-slate-400"
                        placeholder="例: 1990-01-01"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">出身地・居住地</label>
                      <input 
                        type="text"
                        value={profile.origin || ""}
                        onChange={e => setProfile({ ...profile, origin: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm placeholder:text-slate-400"
                        placeholder="例: 東京都"
                      />
                    </div>
                  </div>
                </div>

                {/* 経歴・仕事 */}
                <div className="space-y-4 p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center">
                      <Building2 size={16} className="mr-2 text-slate-400" />経歴・仕事・学歴
                    </h3>
                    <button 
                      onClick={addHistory}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center"
                    >
                      <Plus size={14} className="mr-1" />追加
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {profile.history?.length === 0 && (
                      <p className="text-center text-xs text-slate-400 italic">経歴データはまだありません</p>
                    )}
                    {profile.history?.map((h, index) => (
                      <div key={h.id} className="flex flex-col md:flex-row gap-2 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-300 dark:border-slate-600 relative group">
                        <div className="flex space-x-2 md:w-1/3">
                          <input 
                            type="text"
                            value={h.from}
                            onChange={e => updateHistory(h.id, "from", e.target.value)}
                            placeholder="開始"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-800 dark:text-white focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="text-slate-400 self-center">-</span>
                          <input 
                            type="text"
                            value={h.to}
                            onChange={e => updateHistory(h.id, "to", e.target.value)}
                            placeholder="終了/現在"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-800 dark:text-white focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex-1 right-0 flex items-center">
                          <input 
                            type="text"
                            value={h.description}
                            onChange={e => updateHistory(h.id, "description", e.target.value)}
                            placeholder="内容 (〇〇大学卒業、株式会社〇〇入社など)"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-slate-800 dark:text-white focus:ring-1 focus:ring-blue-500"
                          />
                          <button 
                            onClick={() => removeHistory(h.id)}
                            className="ml-2 p-1 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>

                {/* 現在の仕事内容 */}
                <div className="space-y-4 p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center">
                    <Briefcase size={16} className="mr-2 text-slate-400" />現在の仕事内容
                  </h3>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">業務の詳細・役割・責任範囲</label>
                    <textarea 
                      value={profile.jobDescription || ""}
                      onChange={e => setProfile({ ...profile, jobDescription: e.target.value })}
                      className="w-full h-24 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm placeholder:text-slate-400 resize-none"
                      placeholder="例: IT企業のプロジェクトマネージャーとして、チームの進捗管理や顧客調整を担当している。多忙な時期は残業が増えやすい。"
                    />
                  </div>
                </div>

                {/* 家族構成 */}
                <div className="space-y-4 p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center">
                    <Users size={16} className="mr-2 text-slate-400" />家族構成
                  </h3>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">家族・同居人・特記事項</label>
                    <textarea 
                      value={profile.familyStructure || ""}
                      onChange={e => setProfile({ ...profile, familyStructure: e.target.value })}
                      className="w-full h-24 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm placeholder:text-slate-400 resize-none"
                      placeholder="例: 妻(35歳)と娘(5歳)の3人暮らし。妻はフルタイム勤務、娘は保育園。※家族との時間を確保するためのアドバイスに活用されます。"
                    />
                  </div>
                </div>

                {/* 趣味・ライフワーク */}
                <div className="space-y-4 p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center">
                    <Heart size={16} className="mr-2 text-slate-400" />趣味・コミュニティ
                  </h3>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">趣味・交流・休日の過ごし方</label>
                    <textarea 
                      value={profile.hobbies || ""}
                      onChange={e => setProfile({ ...profile, hobbies: e.target.value })}
                      className="w-full h-24 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm placeholder:text-slate-400 resize-none"
                      placeholder="例: 週末はキャンプに行くことが多い。地元のランニングサークルに所属している。※モチベーション向上のヒントとして活用されます。"
                    />
                  </div>
                </div>

                {/* 健康・持病 */}
                <div className="space-y-4 p-5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50">
                  <h3 className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center">
                    <ShieldAlert size={16} className="mr-2" />健康・持病情報
                  </h3>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-red-500/70 font-bold">持病・アレルギー・体質</label>
                    <textarea 
                      value={profile.medicalHistory || ""}
                      onChange={e => setProfile({ ...profile, medicalHistory: e.target.value })}
                      className="w-full h-24 bg-white dark:bg-slate-900 border border-red-300 dark:border-red-900/50 rounded-lg px-3 py-2 text-slate-800 dark:text-white focus:ring-2 focus:ring-red-500 text-sm placeholder:text-red-300/50 dark:placeholder:text-red-700/50 resize-none"
                      placeholder="例: 花粉症、高血圧、乗り物酔いしやすい、腰痛持ち。※AIがアドバイスする際の配慮事項として活用されます。"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center space-x-2 px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50"
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
