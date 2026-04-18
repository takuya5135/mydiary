"use client";

import React, { useState, useEffect } from "react";
import { Trophy, X, Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import { BucketItem, getBucketList, addBucketItem, toggleBucketItem, deleteBucketItem } from "@/lib/firebase/bucketList";
import { motion, AnimatePresence } from "framer-motion";

interface BucketListModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function BucketListModal({ userId, isOpen, onClose }: BucketListModalProps) {
  const [items, setItems] = useState<BucketItem[]>([]);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen, userId]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await getBucketList(userId);
      setItems(data);
    } catch (error) {
      console.error("Failed to fetch bucket list:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;
    try {
      await addBucketItem(userId, newItemTitle);
      setNewItemTitle("");
      fetchItems();
    } catch (error) {
      console.error("Failed to add item:", error);
    }
  };

  const handleToggle = async (itemId: string, completed: boolean) => {
    try {
      await toggleBucketItem(itemId, !completed);
      setItems(items.map(item => 
        item.id === itemId ? { ...item, completed: !completed } : item
      ));
    } catch (error) {
      console.error("Failed to toggle item:", error);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm("本当に削除しますか？")) return;
    try {
      await deleteBucketItem(itemId);
      setItems(items.filter(item => item.id !== itemId));
    } catch (error) {
      console.error("Failed to delete item:", error);
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
            className="relative w-full max-w-lg glass-panel overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
          >
            <header className="p-6 border-b border-white/10 flex justify-between items-center bg-emerald-500/10">
              <div className="flex items-center space-x-3">
                <div className="bg-emerald-500 text-white p-2 rounded-xl">
                  <Trophy size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">死ぬまでにやりたいことリスト</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">最高の自分へ。アプリの背骨を鍛える。</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </header>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <form onSubmit={handleAdd} className="flex space-x-2">
                <input 
                  type="text"
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  placeholder="新しくやりたいことを追加..."
                  className="flex-1 bg-white/50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
                <button 
                  type="submit"
                  disabled={!newItemTitle.trim()}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white p-2 rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
                >
                  <Plus size={24} />
                </button>
              </form>

              <div className="space-y-2 mt-4">
                {loading ? (
                  <div className="py-10 text-center text-slate-500 text-sm italic">読み込み中...</div>
                ) : items.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 text-sm italic">まだやりたいことが登録されていません。</div>
                ) : (
                  items.map((item) => (
                    <div 
                      key={item.id}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                        item.completed 
                          ? "bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-800/50" 
                          : "bg-white/40 dark:bg-zinc-800/40 border-slate-200/50 dark:border-zinc-700/50"
                      }`}
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        <button 
                          onClick={() => handleToggle(item.id!, item.completed)}
                          className={item.completed ? "text-emerald-500" : "text-slate-400"}
                        >
                          {item.completed ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                        </button>
                        <span className={`text-sm font-medium ${item.completed ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200"}`}>
                          {item.title}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleDelete(item.id!)}
                        className="p-1.5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <footer className="p-4 bg-slate-50 dark:bg-zinc-900/50 text-center text-[10px] text-slate-400 uppercase tracking-widest">
              AI (Waku & Zen) will refer to this list for your guidance.
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
