import { openDB, type IDBPDatabase } from 'idb';
import type { UserProfile, WeightEntry, MealRecord, AppSettings } from './types';

const DB_NAME = 'calsnap';
const DB_VERSION = 1;

function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('meals')) {
        db.createObjectStore('meals', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('weightHistory')) {
        db.createObjectStore('weightHistory', { keyPath: 'date' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    },
  });
}

// --- Meals ---
export async function saveMeal(meal: MealRecord): Promise<void> {
  const db = await getDB();
  await db.put('meals', meal);
}

export async function getMealsByDate(date: string): Promise<MealRecord[]> {
  const db = await getDB();
  const all = await db.getAll('meals');
  return all.filter((m) => m.date === date).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getMealsByDateRange(start: string, end: string): Promise<MealRecord[]> {
  const db = await getDB();
  const all = await db.getAll('meals');
  return all.filter((m) => m.date >= start && m.date <= end).sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteMeal(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('meals', id);
}

// --- Profile ---
export async function saveProfile(profile: UserProfile): Promise<void> {
  const db = await getDB();
  await db.put('profile', { ...profile, id: 'current' });
}

export async function getProfile(): Promise<UserProfile | undefined> {
  const db = await getDB();
  return db.get('profile', 'current');
}

// --- Weight History ---
export async function saveWeight(entry: WeightEntry): Promise<void> {
  const db = await getDB();
  await db.put('weightHistory', entry);
}

export async function getWeightHistory(): Promise<WeightEntry[]> {
  const db = await getDB();
  const all = await db.getAll('weightHistory');
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

// --- Settings ---
export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', { ...settings, id: 'current' });
}

const DEFAULT_SETTINGS: AppSettings = {
  aiService: 'claude',
  apiKey: '',
  theme: 'dark',
};

export async function getSettings(): Promise<AppSettings> {
  const db = await getDB();
  const s = await db.get('settings', 'current');
  return s ? (s as AppSettings) : DEFAULT_SETTINGS;
}

// --- Bulk ---
export async function getAllMeals(): Promise<MealRecord[]> {
  const db = await getDB();
  return db.getAll('meals');
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await db.clear('meals');
  await db.clear('profile');
  await db.clear('weightHistory');
  await db.clear('settings');
}
