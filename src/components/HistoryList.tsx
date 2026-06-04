import { useState, useEffect, useCallback } from 'react';
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
      <div className="flex flex-col items-center justify-center py-20 opacity-30">
        <span className="text-5xl mb-4">📋</span>
        <p className="text-sm font-medium">暂无饮食记录</p>
        <p className="text-xs mt-1">拍照后自动出现在这里</p>
      </div>
    );
  }

  return (
    <div className="px-4">
      <h2 className="text-xl font-bold px-1 pt-2 pb-4">饮食记录</h2>
      {dates.map((date) => {
        const dayMeals = grouped.get(date)!;
        const dayTotal = dayMeals.reduce((s, m) => s + m.totalCalories, 0);
        const isExpanded = expandedDate === date;
        return (
          <div key={date} className="mb-3">
            <button
              onClick={() => setExpandedDate(isExpanded ? null : date)}
              className="w-full bg-surface rounded-2xl p-4 flex items-center justify-between light:bg-white light:shadow-sm"
            >
              <div className="text-left">
                <div className="text-sm font-semibold">{formatDateWithWeekday(date)}</div>
                <div className="text-xs opacity-35 mt-0.5">{dayMeals.length} 餐</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-primary">{dayTotal.toLocaleString()} kcal</span>
                <span className={`text-xs opacity-20 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
              </div>
            </button>
            {isExpanded && (
              <div className="mt-1 space-y-1">
                {dayMeals.map((meal) => (
                  <div key={meal.id} className="bg-surface rounded-2xl p-3.5 flex items-center gap-3 ml-2 light:bg-white">
                    <div className="w-8 h-8 rounded-[10px] bg-bg flex items-center justify-center text-sm light:bg-gray-100">
                      {MEAL_EMOJIS[meal.mealType] || '🍽️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold">{MEAL_LABELS[meal.mealType]}</div>
                      <div className="text-[11px] opacity-35 truncate">
                        {meal.foods.map((f) => f.name).join(' · ')}
                      </div>
                    </div>
                    <span className="text-[13px] font-bold text-primary-light">{meal.totalCalories} kcal</span>
                    <button
                      onClick={() => handleDelete(meal.id)}
                      className="text-xs opacity-20 hover:opacity-60 ml-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
