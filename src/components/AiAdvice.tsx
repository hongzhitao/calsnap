import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';
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
          profile: { height: profile.height, weight: profile.weight, age: profile.age, gender: profile.gender, goal: profile.goal, dailyTarget: profile.dailyTarget },
          meals: meals.map((m) => ({ date: m.date, mealType: m.mealType, foods: m.foods.map((f) => ({ name: f.name, calories: f.calories })), totalCalories: m.totalCalories })),
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
      <div className="bg-white rounded-3xl p-5 shadow-soft">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={18} className="text-primary" />
          <h3 className="text-[15px] font-bold text-black">AI 饮食建议</h3>
        </div>
        <p className="text-[13px] text-text-muted">配置 API Key 后获取个性化饮食建议</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-5 shadow-soft">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-primary" />
          <h3 className="text-[15px] font-bold text-black">AI 饮食建议</h3>
        </div>
        {advice && (
          <button onClick={handleGenerate} disabled={loading}
            className="flex items-center gap-1 text-[12px] text-primary font-semibold active:opacity-70">
            <RefreshCw size={13} /> 重新生成
          </button>
        )}
      </div>

      {error && <p className="text-red-500 text-[12px] mb-3">{error}</p>}

      {!advice && !loading && (
        <motion.button
          onClick={handleGenerate}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 rounded-2xl bg-primary text-white text-[14px] font-semibold shadow-glow"
        >
          获取 AI 建议
        </motion.button>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8 gap-3">
          <Loader2 size={20} className="text-primary animate-spin" />
          <span className="text-[14px] text-text-muted">AI 正在分析你的饮食数据...</span>
        </div>
      )}

      {advice && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="text-[14px] leading-relaxed text-text-secondary whitespace-pre-wrap"
        >
          {advice}
        </motion.div>
      )}
    </div>
  );
}
