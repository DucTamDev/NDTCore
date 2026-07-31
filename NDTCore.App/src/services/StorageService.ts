import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'ndtcore-pos-storage' });

class StorageServiceImpl {
  getItem<T>(key: string): T | null {
    const raw = storage.getString(key);
    if (raw === undefined) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  setItem<T>(key: string, value: T): void {
    storage.set(key, JSON.stringify(value));
  }

  removeItem(key: string): void {
    storage.remove(key);
  }
}

export const StorageService = new StorageServiceImpl();
