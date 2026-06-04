import { useState, useEffect } from 'react';
import type { AppSettings } from '../types';
import { getDietaryAdvice } from '../ai';
import { getProfile, getMealsByDateRange, getWeightHistory, getSettings } from '../db';
import { pastNDays } from '../utils';

export default function AiAdvice() {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    getSettings().then((s) => setSettings(s));
  }, []);

  async function handleGenerate() {
    if (!settings?.apiKey) {
      setError('请先在「我的」页面配置 API Key');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const profile = await getProfile();
      if (!profile) {
        setError('请先填写个人档案');
        setLoading(false);
        return;
      }
      const days = pastNDays(7);
      const meals = await getMealsByDateRange(days[0], days[days.length - 1]);
      const weights = await getWeightHistory();

      const result = await getDietaryAdvice(
        {
          profile: {
            height: profile.height, weight: profile.weight, age: profile.age,
            gender: profile.gender, goal: profile.goal, dailyTarget: profile.dailyTarget,
          },
          meals: meals.map((m) => ({
            date: m.date, mealType: m.mealType,
            foods: m.foods.map((f) => ({ name: f.name, calories: f.calories })),
            totalCalories: m.totalCalories,
          })),
          weightHistory: weights,
        },
        settings
      );
      setAdvice(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取建议失败');
    }
    setLoading(false);
  }

  if (!settings?.apiKey) {
    return (
      <div className="bg-surface rounded-2xl p-5 mx-4 light:bg-white light:shadow-sm">
        <h3 className="text-sm font-semibold mb-2">🤖 AI 饮食建议</h3>
        <p className="text-xs opacity-35">配置 API Key 后获取个性化饮食建议</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-2xl p-5 mx-4 light:bg-white light:shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">🤖 AI 饮食建议</h3>
        {advice && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="text-xs text-primary font-semibold opacity-60 hover:opacity-100"
          >
            重新生成
          </button>
        )}
      </div>

      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

      {!advice && !loading && (
        <button
          onClick={handleGenerate}
          className="w-full py-2.5 rounded-full bg-primary text-white text-sm font-semibold"
        >
          获取 AI 建议
        </button>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm opacity-40 ml-3">分析中...</span>
        </div>
      )}

      {advice && !loading && (
        <div className="text-sm leading-relaxed opacity-80 whitespace-pre-wrap">{advice}</div>
      )}
    </div>
  );
}
