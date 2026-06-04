import type { MealRecord } from '../types';
import { MEAL_EMOJIS, MEAL_LABELS } from '../utils';

interface MealCardProps {
  meal: MealRecord;
  onDelete?: (id: string) => void;
}

export default function MealCard({ meal, onDelete }: MealCardProps) {
  const foodNames = meal.foods.map((f) => f.name).join(' · ');

  return (
    <div className="bg-surface rounded-2xl p-3.5 flex items-center gap-3 mx-4 mb-1.5 light:bg-white light:shadow-sm">
      <div className="w-9 h-9 rounded-[10px] bg-bg flex items-center justify-center text-base light:bg-gray-100">
        {MEAL_EMOJIS[meal.mealType] || '🍽️'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold">{MEAL_LABELS[meal.mealType]}</div>
        <div className="text-[11px] opacity-35 font-medium truncate">{foodNames}</div>
      </div>
      <div className="text-[15px] font-bold text-primary-light tracking-[-0.3px] whitespace-nowrap">
        {meal.totalCalories.toLocaleString()}
        <span className="text-[10px] opacity-40 ml-0.5 font-medium">kcal</span>
      </div>
      {onDelete && (
        <button
          onClick={() => onDelete(meal.id)}
          className="text-xs opacity-20 hover:opacity-60 ml-0.5"
        >
          ✕
        </button>
      )}
    </div>
  );
}
