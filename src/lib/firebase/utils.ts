/**
 * Firestoreに保存できない `undefined` 値を持つプロパティをオブジェクトから削除します。
 * ネストされたオブジェクトや配列も再帰的に処理します。
 */
export function sanitizeData(data: any): any {
  if (data === null || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: any = {};
  Object.keys(data).forEach((key) => {
    const value = data[key];
    if (value !== undefined) {
      sanitized[key] = sanitizeData(value);
    }
  });

  return sanitized;
}
