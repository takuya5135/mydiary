import { DiaryEntry } from "./firebase/entries";
import { DictionaryItem } from "./firebase/dictionary";

export interface SearchResult {
  date: string;
  snippets: {
    home: string;
    work: string;
    hobby: string;
  };
}

/**
 * 手動検索エンジンのロジック
 */
export class DiarySearchEngine {
  constructor(
    private entries: DiaryEntry[],
    private dictionary: DictionaryItem[]
  ) {}

  /**
   * クエリを解析し、検索結果を返す
   */
  search(query: string): SearchResult[] {
    if (!query.trim()) return [];

    // 1. クエリの正規化と単語分割
    const orTokens = query.split("|").map(t => t.trim()).filter(t => t);
    
    // ORグループごとに処理
    const results = this.entries.filter(entry => {
      return orTokens.some(orToken => {
        // AND条件 (スペース区切り)
        const andTokens = orToken.split(/\s+/).map(t => t.trim()).filter(t => t);
        return andTokens.every(token => this.matchToken(entry, token));
      });
    });

    // 日付順（新しい順）に並べて返す
    return results
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(entry => ({
        date: entry.date,
        snippets: {
          home: this.truncate(entry.segments?.home || ""),
          work: this.truncate(entry.segments?.work || ""),
          hobby: this.truncate(entry.segments?.hobby || ""),
        }
      }));
  }

  /**
   * 単一のトークン（キーワード）がエントリーにヒットするか判定（辞書の別名も考慮）
   */
  private matchToken(entry: DiaryEntry, token: string): boolean {
    const searchTerms = this.expandTokenWithAliases(token);
    const content = `
      ${entry.date}
      ${entry.segments?.home || ""}
      ${entry.segments?.work || ""}
      ${entry.segments?.hobby || ""}
      ${entry.rawText || ""}
      ${entry.keywords?.join(" ") || ""}
    `.toLowerCase();

    return searchTerms.some(term => content.includes(term.toLowerCase()));
  }

  /**
   * 辞書を参照し、別名や正式名称を含む検索語リストを展開
   */
  private expandTokenWithAliases(token: string): string[] {
    const terms = new Set<string>([token]);
    
    for (const item of this.dictionary) {
      const allNames = [item.name, ...(item.aliases || [])];
      // 入力されたトークンが名前または別名のいずれかに完全一致する場合、その項目の全バリエーションを追加
      if (allNames.some(n => n.toLowerCase() === token.toLowerCase())) {
        allNames.forEach(n => terms.add(n));
      }
    }

    return Array.from(terms);
  }

  private truncate(text: string, len: number = 80): string {
    if (text.length <= len) return text;
    return text.substring(0, len) + "...";
  }
}
