export interface UserProfile {
  height: number;
  weight: number;
  age: number;
  gender: 'male' | 'female';
  goal: 'lose' | 'maintain' | 'gain';
  dailyTarget: number;
}

export interface WeightEntry {
  date: string;
  weight: number;
}

export interface FoodItem {
  name: string;
  portion: string;
  calories: number;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealRecord {
  id: string;
  date: string;
  mealType: MealType;
  foods: FoodItem[];
  totalCalories: number;
  photoUrl: string;
  createdAt: number;
}

export interface AppSettings {
  aiService: 'claude' | 'openai' | 'qwen' | 'deepseek' | 'doubao';
  apiKey: string;
  model?: string;
  theme: 'light' | 'dark';
}

export type TabId = 'dashboard' | 'history' | 'profile';

export interface AIResult {
  foods: FoodItem[];
  totalCalories: number;
}
