import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Trash2 } from 'lucide-react';
import type { MealRecord } from '../types';
import { getAllMeals, deleteMeal } from '../db';
import { formatDateWithWeekday, MEAL_LABELS, MEAL_EMOJIS } from '../utils';

export default function HistoryList() {
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    const all = await getAllMeals();
    all.sort((a, b) => b.createdAt - a.createdAt);
    setMeals(all);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    await deleteMeal(id);
    await load();
  }

  const grouped = new Map<string, MealRecord[]>();
  for (const m of meals) {
    const list = grouped.get(m.date) || [];
    list.push(m);
    grouped.set(m.date, list);
  }
  const dates = [...grouped.keys()];

  if (dates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-text-muted">
        <span className="text-6xl mb-4 opacity-30">📋</span>
        <p className="text-[15px] font-semibold">暂无饮食记录</p>
        <p className="text-[13px] mt-1 opacity-60">拍照后自动出现在这里</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-24 pt-4">
      <h2 className="text-[24px] font-extrabold text-black tracking-[-0.5px] px-1 pt-2 pb-5">饮食记录</h2>
      {dates.map((date) => {
        const dayMeals = grouped.get(date)!;
        const dayTotal = dayMeals.reduce((s, m) => s + m.totalCalories, 0);
        const isExpanded = expandedDate === date;
        return (
          <motion.div
            key={date}
            className="mb-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <button
              onClick={() => setExpandedDate(isExpanded ? null : date)}
              className="w-full bg-white rounded-3xl p-4 flex items-center justify-between shadow-soft"
            >
              <div className="text-left">
                <div className="text-[15px] font-semibold text-black">{formatDateWithWeekday(date)}</div>
                <div className="text-[12px] text-text-muted mt-0.5">{dayMeals.length} 餐</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-primary">{dayTotal.toLocaleString()} kcal</span>
                <ChevronDown
                  size={16}
                  className={`text-text-muted transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  className="mt-2 space-y-2 ml-2"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  {dayMeals.map((meal) => (
                    <div key={meal.id} className="bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-soft">
                      <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-base">
                        {MEAL_EMOJIS[meal.mealType] || '🍽️'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-semibold text-black">{MEAL_LABELS[meal.mealType]}</div>
                        <div className="text-[12px] text-text-muted truncate">
                          {meal.foods.map((f) => f.name).join(' · ')}
                        </div>
                      </div>
                      <span className="text-[14px] font-bold text-primary">{meal.totalCalories} kcal</span>
                      <button
                        onClick={() => handleDelete(meal.id)}
                        className="text-text-muted hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
