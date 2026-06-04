import { useState, useEffect, useCallback } from 'react';
import type { TabId, MealRecord, UserProfile } from './types';
import { getMealsByDate, getProfile, getSettings } from './db';
import { todayStr } from './utils';
import Layout from './components/Layout';
import CalorieGauge from './components/CalorieGauge';
import MealCard from './components/MealCard';
import CameraCapture from './components/CameraCapture';
import HistoryList from './components/HistoryList';
import ProfileForm from './components/ProfileForm';
import AiAdvice from './components/AiAdvice';

export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const loadDashboard = useCallback(async () => {
    const [todayMeals, prof] = await Promise.all([
      getMealsByDate(todayStr()),
      getProfile(),
    ]);
    setMeals(todayMeals);
    setProfile(prof ?? null);
  }, []);

  useEffect(() => {
    loadDashboard();
    getSettings().then((s) => {
      document.body.classList.toggle('light', s.theme === 'light');
    });
  }, [loadDashboard]);

  async function handleCameraComplete(meal?: MealRecord) {
    setShowCamera(false);
    if (meal) {
      await loadDashboard();
    }
  }

  const totalCalories = meals.reduce((s, m) => s + m.totalCalories, 0);
  const dailyTarget = profile?.dailyTarget ?? 2000;

  return (
    <Layout activeTab={tab} onTabChange={setTab}>
      {tab === 'dashboard' && (
        <div className="flex flex-col min-h-full">
          {/* Header */}
          <div className="flex items-end justify-between px-5 pt-4 pb-2">
            <div>
              <div className="text-[26px] font-bold tracking-[-0.5px]">今日</div>
              <div className="text-[13px] opacity-35 font-medium">{todayStr()}</div>
            </div>
            {profile && (
              <span className="text-[11px] bg-primary text-white px-3 py-1.5 rounded-full font-semibold">
                🎯 {{ lose: '减脂中', maintain: '维持中', gain: '增肌中' }[profile.goal]}
              </span>
            )}
          </div>

          {/* Calorie Gauge */}
          <CalorieGauge current={totalCalories} target={dailyTarget} />

          {/* Macronutrients */}
          <div className="flex justify-center gap-1.5 px-5 mb-3">
            <span className="bg-primary/20 text-primary-light text-[11px] font-semibold px-2.5 py-1 rounded-full">
              碳水 45%
            </span>
            <span className="bg-primary-pale/15 text-primary-pale text-[11px] font-semibold px-2.5 py-1 rounded-full">
              蛋白质 30%
            </span>
            <span className="bg-accent/15 text-accent text-[11px] font-semibold px-2.5 py-1 rounded-full">
              脂肪 25%
            </span>
          </div>

          {/* Today's meals */}
          <div className="flex-1">
            <div className="text-[13px] font-semibold opacity-40 px-5 py-2">今日饮食</div>
            {meals.length === 0 ? (
              <div className="flex flex-col items-center py-8 opacity-20">
                <span className="text-4xl mb-2">🍽️</span>
                <p className="text-xs">今天还没记录饮食</p>
              </div>
            ) : (
              meals.map((meal) => <MealCard key={meal.id} meal={meal} />)
            )}

            {/* AI Advice Card */}
            <div className="mt-4">
              <AiAdvice />
            </div>
            <div className="pb-24" />
          </div>

          {/* Camera button - fixed at bottom center above tabs */}
          <div className="fixed bottom-14 left-0 right-0 flex justify-center pointer-events-none z-40">
            <button
              onClick={() => setShowCamera(true)}
              className="pointer-events-auto w-[72px] h-[42px] bg-gradient-to-b from-primary to-primary-light rounded-t-[42px] flex items-start justify-center pt-2.5 shadow-[0_-2px_16px_rgba(255,107,53,0.3),0_4px_12px_rgba(255,107,53,0.15)] active:scale-95 transition-transform"
            >
              <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-[0_0_0_3px_rgba(255,255,255,0.2)]">
                <div className="w-3 h-3 rounded-full bg-primary" />
              </div>
            </button>
          </div>

          {/* Camera overlay */}
          {showCamera && <CameraCapture onComplete={handleCameraComplete} />}
        </div>
      )}

      {tab === 'history' && <HistoryList />}
      {tab === 'profile' && <ProfileForm />}
    </Layout>
  );
}
