"use client";

import React, { useState, useEffect } from "react";
import { Book, X, Plus, Trash2, User, MapPin, Building, Tag, Save, Search } from "lucide-react";
import { DictionaryItem, getDictionary, upsertDictionaryItem, deleteDictionaryItem } from "@/lib/firebase/dictionary";
import { motion, AnimatePresence } from "framer-motion";

interface DictionaryModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DictionaryModal({ userId, isOpen, onClose }: DictionaryModalProps) {
  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [editingItem, setEditingItem] = useState<Partial<DictionaryItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    if (isOpen) {
      fetchDictionary();
    }
  }, [isOpen, userId]);

  const fetchDictionary = async () => {
    setLoading(true);
    try {
      const data = await getDictionary(userId);
      setItems(data);
    } catch (error) {
      console.error("Failed to fetch dictionary:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingItem?.name) return;
    try {
      await upsertDictionaryItem(userId, editingItem);
      setEditingItem(null);
      fetchDictionary();
    } catch (error) {
      console.error("Save failed:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("本当に削除しますか？")) return;
    try {
      await deleteDictionaryItem(id);
      fetchDictionary();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const categories = [
    { id: "person", label: "人物", icon: <User size={16} /> },
    { id: "place", label: "場所", icon: <MapPin size={16} /> },
    { id: "organization", label: "組織", icon: <Building size={16} /> },
    { id: "custom", label: "その他", icon: <Tag size={16} /> },
  ];

  // フィルタリング
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.aliases.some(a => a.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.attributes?.memo?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

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
            className="relative w-full max-w-4xl glass-panel overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh] md:h-[80vh]"
          >
            {/* Sidebar / List */}
            <div className="w-full md:w-80 border-r border-white/10 flex flex-col bg-slate-900/20 flex-1 md:flex-none">
              <header className="p-4 border-b border-white/10 flex justify-between items-center">
                <div className="flex items-center space-x-2 text-white">
                  <Book size={20} className="text-orange-500" />
                  <span className="font-bold">ナレッジ・ベース</span>
                </div>
                <button 
                  onClick={() => setEditingItem({ name: "", aliases: [], category: "person", attributes: {} })}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white"
                >
                  <Plus size={20} />
                </button>
              </header>

              {/* Search & Filter */}
              <div className="p-3 space-y-3 border-b border-white/5 bg-black/20">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="検索..."
                    className="w-full bg-slate-950/40 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setSelectedCategory("all")}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                      selectedCategory === "all" ? "bg-white/20 text-white" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    すべて
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                        selectedCategory === cat.id ? "bg-white/20 text-white" : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setEditingItem(item)}
                    className={`w-full text-left p-3 rounded-xl transition-all ${
                      editingItem?.id === item.id ? "bg-white/10 ring-1 ring-white/20" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="text-sm font-bold text-white mb-0.5">{item.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {item.aliases.join(", ") || "あだ名なし"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex flex-col bg-slate-900/40 backdrop-blur-md relative">
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-slate-400"
              >
                <X size={20} />
              </button>

              {editingItem ? (
                <div className="flex-1 p-8 space-y-6 overflow-y-auto">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-slate-300 font-black">正式名称 / 表示名</label>
                        <input 
                          value={editingItem.name}
                          onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                          className="w-full bg-slate-950/60 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                          placeholder="例: 山田 太郎"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-slate-300 font-black">カテゴリ</label>
                        <div className="grid grid-cols-2 gap-2">
                          {categories.map(cat => (
                            <button
                              key={cat.id}
                              onClick={() => setEditingItem({ ...editingItem, category: cat.id as any })}
                              className={`flex items-center space-x-2 p-2 rounded-lg text-xs font-bold transition-all ${
                                editingItem.category === cat.id ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20" : "bg-slate-950/40 text-slate-400 hover:bg-slate-950/60"
                              }`}
                            >
                              {cat.icon}
                              <span>{cat.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-slate-300 font-black">あだ名 / 呼び名 (カンマ区切り)</label>
                      <input 
                        value={editingItem.aliases?.join(", ")}
                        onChange={e => setEditingItem({ ...editingItem, aliases: e.target.value.split(",").map(a => a.trim()).filter(a => a) })}
                        className="w-full bg-slate-950/60 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                        placeholder="例: たろう, パパ, 山田さん"
                      />
                    </div>

                    {editingItem.category === "person" && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-4 rounded-2xl bg-slate-950/40 border border-white/10">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-wider text-slate-300 font-black">生年 (西暦)</label>
                          <input 
                            type="number"
                            value={editingItem.attributes?.birthYear || ""}
                            onChange={e => setEditingItem({ ...editingItem, attributes: { ...editingItem.attributes, birthYear: parseInt(e.target.value) } })}
                            className="w-full bg-transparent border-b border-white/20 py-1 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
                            placeholder="1990"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-wider text-slate-300 font-black">生年月日 (任意)</label>
                          <input 
                            type="text"
                            value={editingItem.attributes?.birthDate || ""}
                            onChange={e => setEditingItem({ ...editingItem, attributes: { ...editingItem.attributes, birthDate: e.target.value } })}
                            className="w-full bg-transparent border-b border-white/20 py-1 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
                            placeholder="1990-01-01"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-wider text-slate-300 font-black">関係性</label>
                          <input 
                            value={editingItem.attributes?.relationship || ""}
                            onChange={e => setEditingItem({ ...editingItem, attributes: { ...editingItem.attributes, relationship: e.target.value } })}
                            className="w-full bg-transparent border-b border-white/20 py-1 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
                            placeholder="中学の同級生、仕事の取引先など"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-wider text-slate-300 font-black">出身地 / 属性</label>
                          <input 
                            value={editingItem.attributes?.origin || ""}
                            onChange={e => setEditingItem({ ...editingItem, attributes: { ...editingItem.attributes, origin: e.target.value } })}
                            className="w-full bg-transparent border-b border-white/20 py-1 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
                            placeholder="東京"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-slate-300 font-black">メモ / コンテキスト</label>
                      <textarea 
                        value={editingItem.attributes?.memo || ""}
                        onChange={e => setEditingItem({ ...editingItem, attributes: { ...editingItem.attributes, memo: e.target.value } })}
                        className="w-full h-24 bg-slate-950/60 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none text-sm transition-all"
                        placeholder="この人物との重要な共通の話題や、覚えておくべきこと..."
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4">
                    {editingItem.id && (
                      <button 
                        onClick={() => handleDelete(editingItem.id!)}
                        className="flex items-center space-x-2 text-red-500 hover:text-red-400 text-sm transition-colors"
                      >
                        <Trash2 size={16} />
                        <span>削除する</span>
                      </button>
                    )}
                    <button 
                      onClick={handleSave}
                      className="ml-auto flex items-center space-x-2 px-8 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold transition-all shadow-lg shadow-orange-500/20"
                    >
                      <Save size={18} />
                      <span>保存する</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                  <Book size={48} className="mb-4 opacity-20" />
                  <p className="text-sm">
                    左側のリストから単語を選択するか、<br />
                    「＋」ボタンから新しい単語を登録してください。
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
