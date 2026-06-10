import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  ClipboardList,
  User,
  Camera,
  Plus,
  X,
  Zap,
  Ellipsis,
  Signal,
  Wifi,
  Battery,
  CheckCircle2,
  Sparkles,
  Image,
} from 'lucide-react';
import type { TabId, MealRecord, UserProfile, FoodItem } from './types';
import { getMealsByDate, getProfile, getSettings, saveMeal } from './db';
import { todayStr, uid, compressImage } from './utils';
import { recognizeFood, recognizeFoodFromText } from './ai';
import HistoryList from './components/HistoryList';
import ProfileForm from './components/ProfileForm';
import GymDiscover from './components/GymDiscover';

function StatusBar() {
  return (
    <div className="flex h-[44px] items-end justify-between px-7 pb-2 text-[13px] font-semibold text-black">
      <span>9:41</span>
      <div className="flex items-center gap-1.5">
        <Signal size={14} strokeWidth={2.6} />
        <Wifi size={14} strokeWidth={2.6} />
        <Battery size={17} strokeWidth={2.4} />
      </div>
    </div>
  );
}

function BigCalorieRing({ current, target }: { current: number; target: number }) {
  const ratio = Math.min(current / target, 1);
  const r = 98;
  const c = 2 * Math.PI * r;
  const offset = c - ratio * c;

  return (
    <div className="relative mx-auto h-[250px] w-[250px]">
      <svg viewBox="0 0 240 240" className="h-full w-full -rotate-90">
        <circle cx="120" cy="120" r={r} fill="none" stroke="#eef1ed" strokeWidth="17" />
        <motion.circle
          cx="120"
          cy="120"
          r={r}
          fill="none"
          stroke="url(#calGradient)"
          strokeWidth="17"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.35, ease: 'easeOut' }}
          style={{ filter: 'drop-shadow(0 8px 18px rgba(34,197,94,0.18))' }}
        />
        <defs>
          <linearGradient id="calGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#86efac" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
        </defs>
      </svg>

      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.55, ease: 'easeOut' }}
      >
        <div className="text-[56px] font-extrabold leading-none tracking-[-2.8px] text-black">
          {current.toLocaleString()}
        </div>
        <div className="mt-1 text-[13px] font-medium text-[#6b7280]">今天 · 还可以吃</div>
        <div className="mt-0.5 text-[12px] font-semibold text-black">目标 {target.toLocaleString()} kcal</div>
      </motion.div>
    </div>
  );
}

function MacroTile({ emoji, title, value, max, color, unit, delay }: {
  emoji: string;
  title: string;
  value: number;
  max: number;
  color: string;
  unit: string;
  delay: number;
}) {
  const pct = Math.min(value / max, 1);
  return (
    <motion.div
      className="min-w-0 rounded-[24px] bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.035)]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.42, ease: 'easeOut' }}
    >
      <div className="mb-1 text-[20px] leading-none">{emoji}</div>
      <div className="text-[11px] font-medium text-[#6b7280]">{title}</div>
      <div className="mt-0.5 text-[16px] font-bold leading-none text-black">
        {value}<span className="ml-0.5 text-[10px] font-medium text-[#6b7280]">/{max}{unit}</span>
      </div>
      <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-[#eef1ed]">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ delay: delay + 0.2, duration: 0.7, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}

function FoodRecord({ image, name, time, kcal, delay }: {
  image: string;
  name: string;
  time: string;
  kcal: number;
  delay: number;
}) {
  return (
    <motion.div
      className="flex items-center gap-3 rounded-[22px] bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.035)]"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.42, ease: 'easeOut' }}
    >
      <img src={image} alt={name} className="h-[46px] w-[46px] flex-shrink-0 rounded-[17px] object-cover" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-bold text-black">{name}</div>
        <div className="mt-0.5 text-[12px] font-medium text-[#6b7280]">{time}</div>
      </div>
      <div className="text-right text-[14px] font-extrabold text-black">
        {kcal}<span className="ml-0.5 text-[10px] font-semibold text-[#6b7280]">kcal</span>
      </div>
    </motion.div>
  );
}

function MealSection({ title, emoji, meals, emptyText, delay }: {
  title: string;
  emoji: string;
  meals: Array<{ id: string; name: string; time: string; kcal: number; image: string }>;
  emptyText: string;
  delay: number;
}) {
  const total = meals.reduce((sum, meal) => sum + meal.kcal, 0);
  return (
    <motion.section
      className="rounded-[28px] bg-[#f8faf7] p-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.42, ease: 'easeOut' }}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[16px] shadow-[0_4px_14px_rgba(15,23,42,0.035)]">{emoji}</span>
          <div>
            <div className="text-[14px] font-extrabold text-black">{title}</div>
            <div className="text-[11px] font-medium text-[#6b7280]">{meals.length ? `${meals.length} 项记录` : emptyText}</div>
          </div>
        </div>
        <div className="text-[13px] font-extrabold text-black">
          {total}<span className="ml-0.5 text-[10px] font-semibold text-[#6b7280]">kcal</span>
        </div>
      </div>
      {meals.length > 0 && (
        <div className="space-y-2">
          {meals.map((meal, index) => (
            <FoodRecord key={meal.id} {...meal} delay={delay + 0.08 + index * 0.06} />
          ))}
        </div>
      )}
    </motion.section>
  );
}

function AvocadoDecor() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[78px] h-[190px] overflow-hidden">
      <motion.img
        src="https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=420&h=420&fit=crop"
        alt="avocado"
        className="absolute -right-10 top-0 h-[150px] w-[150px] rotate-[18deg] rounded-full object-cover opacity-90 blur-[0.2px]"
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 0.9, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
      <motion.img
        src="https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=420&h=420&fit=crop"
        alt="avocado"
        className="absolute -left-14 top-[64px] h-[118px] w-[118px] -rotate-[24deg] rounded-full object-cover opacity-75 blur-[0.3px]"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 0.75, scale: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.7, ease: 'easeOut' }}
      />
    </div>
  );
}

function CameraModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<'camera' | 'text' | 'loading' | 'confirm'>('camera');
  const [photo, setPhoto] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [result, setResult] = useState<{ foods: FoodItem[]; totalCalories: number } | null>(null);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [flash, setFlash] = useState(false);
  const [processing, setProcessing] = useState(false);
  const viewfinderBg = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=900&h=1200&fit=crop';
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  async function analyzePhoto(dataUrl: string) {
    if (!settings?.apiKey) {
      setError('请先在「我的」页面配置 API Key');
      return;
    }
    setStep('loading');
    try {
      const r = await recognizeFood(dataUrl, settings);
      setResult(r);
      setStep('confirm');
    } catch (e: any) {
      setError(e.message || '识别失败');
      setStep('camera');
    }
  }

  async function analyzeText() {
    if (!textInput.trim() || !settings?.apiKey) return;
    setStep('loading');
    try {
      const r = await recognizeFoodFromText(textInput, settings);
      setResult(r);
      setStep('confirm');
    } catch (e: any) {
      setError(e.message || '识别失败');
      setStep('text');
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file, 800, 0.6).then((dataUrl) => {
      setPhoto(dataUrl);
      analyzePhoto(dataUrl);
    }).catch(() => {
      // Fallback: read directly if compression fails
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setPhoto(dataUrl);
        analyzePhoto(dataUrl);
      };
      reader.readAsDataURL(file);
    });
  }

  async function saveResult() {
    if (!result) return;
    await saveMeal({
      id: uid(),
      date: todayStr(),
      mealType: 'lunch',
      foods: result.foods,
      totalCalories: result.totalCalories,
      photoUrl: photo || '',
      createdAt: Date.now(),
    });
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        <img src={photo || viewfinderBg} alt="camera" className="h-full w-full object-cover" />
        {step === 'loading' && (
          <>
            <div
              className="absolute left-0 right-0 z-10 h-[4px] animate-scan"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(134,239,172,0.58), rgba(34,197,94,0.75), rgba(134,239,172,0.58), transparent)',
                boxShadow: '0 0 18px rgba(34,197,94,0.45), 0 0 46px rgba(34,197,94,0.18)',
              }}
            />
            <motion.div
              className="absolute bottom-8 left-5 right-5 rounded-[28px] bg-[#064e3b]/72 p-5 text-white backdrop-blur-2xl"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.48, ease: 'easeOut' }}
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 size={25} />
                <div>
                  <div className="text-[13px] font-medium opacity-80">AI 识别中...</div>
                  <div className="text-[17px] font-bold">正在分析食物营养</div>
                  <div className="text-[13px] font-semibold text-[#86efac]">请稍候</div>
                </div>
              </div>
            </motion.div>
          </>
        )}

        <div className="absolute left-4 right-4 top-12 flex items-center justify-between">
          <div className="flex gap-2">
            <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/28 text-white backdrop-blur-2xl">
              <X size={20} />
            </button>
            <button onClick={() => setFlash(!flash)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/28 text-white backdrop-blur-2xl">
              <Zap size={19} />
            </button>
          </div>
          <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white/28 text-white backdrop-blur-2xl">
            <Ellipsis size={20} />
          </button>
        </div>
      </div>

      <div className="relative -mt-8 rounded-t-[34px] bg-white px-5 pb-[calc(2rem+env(safe-area-inset-bottom)+80px)] pt-7 shadow-[0_-12px_34px_rgba(15,23,42,0.08)]">
        {step === 'camera' && (
          <div className="flex flex-col items-center gap-4">
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
            <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            <button onClick={() => cameraInputRef.current?.click()} className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[#22c55e] shadow-[0_10px_28px_rgba(34,197,94,0.24)]">
              <Camera size={31} className="text-white" />
            </button>
            <div className="text-[13px] font-medium text-[#6b7280]">拍照识别食物</div>
            <button onClick={() => galleryInputRef.current?.click()} className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-gray-200 text-[14px] font-semibold text-[#1f2937] active:bg-gray-50">
              <Image size={18} />
              从相册选择
            </button>
            <div className="flex items-center gap-4 w-full max-w-xs">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-[#6b7280]">或</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <button onClick={() => setStep('text')} className="h-12 w-full rounded-[18px] border border-gray-200 text-[14px] font-semibold text-[#1f2937]">
              ✏️ 文字描述吃了什么
            </button>
            {error && <div className="mt-3 w-full max-w-xs text-center text-[11px] text-red-500 break-all leading-relaxed">{error}</div>}
          </div>
        )}

        {step === 'text' && (
          <div>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="例如：一碗米饭、番茄炒蛋、鸡胸肉200g"
              className="h-[120px] w-full resize-none rounded-[22px] bg-gray-50 p-4 text-[16px] outline-none"
              autoFocus
            />
            {error && <div className="mt-3 w-full text-center text-[11px] text-red-500 break-all leading-relaxed">{error}</div>}
            <div className="mt-4 flex gap-3">
              <button onClick={() => setStep('camera')} className="h-12 flex-1 rounded-[18px] border border-gray-200 text-[14px] font-semibold text-[#1f2937]">返回</button>
              <button onClick={analyzeText} disabled={!textInput.trim()} className="h-12 flex-1 rounded-[18px] bg-[#22c55e] text-[14px] font-semibold text-white disabled:opacity-40">开始识别</button>
            </div>
          </div>
        )}

        {step === 'confirm' && result && (
          <div>
            <div className="mb-2 text-[16px] font-bold text-black">识别结果</div>
            {result.foods.map((food, index) => (
              <div key={index} className="flex justify-between border-b border-gray-100 py-2.5 text-[14px]">
                <span className="text-[#1f2937]">{food.name} <span className="text-[12px] text-[#6b7280]">{food.portion}</span></span>
                <span className="font-bold text-black">{food.calories} kcal</span>
              </div>
            ))}
            <div className="flex justify-between py-3 text-[16px] font-extrabold">
              <span>总计</span>
              <span className="text-[#22c55e]">{result.totalCalories} kcal</span>
            </div>
            <div className="mt-3 flex gap-3">
              <button onClick={() => { setResult(null); setStep('camera'); }} className="h-12 flex-1 rounded-[18px] border border-gray-200 text-[14px] font-semibold">重来</button>
              <button onClick={saveResult} className="h-12 flex-1 rounded-[18px] bg-[#22c55e] text-[14px] font-semibold text-white">保存记录</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const loadDashboard = useCallback(async () => {
    const [todayMeals, prof] = await Promise.all([getMealsByDate(todayStr()), getProfile()]);
    setMeals(todayMeals);
    setProfile(prof ?? null);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const totalCalories = meals.reduce((sum, meal) => sum + meal.totalCalories, 0);
  const dailyTarget = profile?.dailyTarget ?? 1680;
  const remaining = Math.max(dailyTarget - totalCalories, 0);

  const protein = Math.round(totalCalories * 0.3 / 4);
  const fat = Math.round(totalCalories * 0.25 / 9);
  const carbs = Math.round(totalCalories * 0.45 / 4);

  const mealRecords = meals.map((meal, index) => ({
    id: meal.id,
    mealType: meal.mealType,
    name: meal.foods.map((f) => f.name).join(' · '),
    time: new Date(meal.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    kcal: meal.totalCalories,
    image: `https://picsum.photos/seed/food-${meal.id || index}/96/96`,
  }));

  const breakfastMeals = mealRecords.filter((meal) => meal.mealType === 'breakfast');
  const lunchMeals = mealRecords.filter((meal) => meal.mealType === 'lunch');
  const dinnerMeals = mealRecords.filter((meal) => meal.mealType === 'dinner');
  const snackMeals = mealRecords.filter((meal) => meal.mealType === 'snack');

  const navItems: { id: TabId; label: string; icon: any }[] = [
    { id: 'dashboard', label: '首页', icon: Home },
    { id: 'history', label: '记录', icon: ClipboardList },
    { id: 'profile', label: '我的', icon: User },
  ];

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-white">
      {tab === 'dashboard' && (
        <main className="relative flex flex-1 flex-col bg-white pb-[96px]">
          <StatusBar />
          <AvocadoDecor />

          <section className="relative z-10 px-5 pt-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[28px] font-extrabold leading-tight tracking-[-1.1px] text-black">今日饮食</div>
                <div className="mt-1 text-[13px] font-medium text-[#6b7280]">{todayStr()}</div>
              </div>
              {profile && (
                <div className="rounded-full bg-[#dcfce7] px-3 py-1.5 text-[12px] font-bold text-[#16a34a]">
                  {{ lose: '减脂中', maintain: '维持中', gain: '增肌中' }[profile.goal]}
                </div>
              )}
            </div>
          </section>

          <section className="relative z-10 mt-1">
            <BigCalorieRing current={remaining} target={dailyTarget} />
          </section>

          <section className="relative z-10 grid grid-cols-4 gap-2 px-4">
            <MacroTile emoji="🔥" title="已摄入" value={totalCalories} max={dailyTarget} color="#22c55e" unit="kcal" delay={0.35} />
            <MacroTile emoji="🍗" title="蛋白质" value={protein} max={120} color="#22c55e" unit="g" delay={0.45} />
            <MacroTile emoji="🥑" title="脂肪" value={fat} max={65} color="#f59e0b" unit="g" delay={0.55} />
            <MacroTile emoji="🍚" title="碳水" value={carbs} max={170} color="#22c55e" unit="g" delay={0.65} />
          </section>

          <section className="relative z-10 mt-5 px-4 pb-8">
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <h2 className="text-[17px] font-extrabold text-black">今日记录</h2>
                <p className="mt-0.5 text-[11px] font-medium text-[#6b7280]">按早餐、午餐、晚餐整理</p>
              </div>
              <button onClick={() => setShowCamera(true)} className="flex h-9 items-center gap-1.5 rounded-full bg-[#dcfce7] px-3 text-[13px] font-bold text-[#16a34a]">
                <Plus size={15} strokeWidth={2.6} />
                添加食物
              </button>
            </div>

            {meals.length === 0 ? (
              <motion.div
                className="rounded-[30px] bg-[#f8faf7] px-6 py-9 text-center"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.78, duration: 0.42, ease: 'easeOut' }}
              >
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-[24px] shadow-[0_8px_24px_rgba(15,23,42,0.035)]">🍽️</div>
                <div className="text-[15px] font-extrabold text-black">今天还没有饮食记录</div>
                <div className="mt-1 text-[12px] font-medium text-[#6b7280]">点击“添加食物”或底部相机按钮开始记录</div>
              </motion.div>
            ) : (
              <div className="space-y-3">
                <MealSection title="早餐" emoji="🌤️" meals={breakfastMeals} emptyText="还未记录早餐" delay={0.78} />
                <MealSection title="午餐" emoji="☀️" meals={lunchMeals} emptyText="还未记录午餐" delay={0.9} />
                <MealSection title="晚餐" emoji="🌙" meals={dinnerMeals} emptyText="还未记录晚餐" delay={1.02} />
                {snackMeals.length > 0 && <MealSection title="加餐" emoji="🍪" meals={snackMeals} emptyText="" delay={1.14} />}
              </div>
            )}
          </section>
        </main>
      )}

      {tab === 'history' && <HistoryList />}
      {tab === 'discover' && <GymDiscover />}
      {tab === 'profile' && <ProfileForm />}

      <nav className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-w-[430px] pb-[env(safe-area-inset-bottom)]">
        <div className="relative border-t border-white/60 bg-white/82 px-3 pb-2 pt-3 shadow-[0_-8px_28px_rgba(15,23,42,0.045)] backdrop-blur-2xl">
          <button
            onClick={() => setShowCamera(true)}
            className="absolute left-1/2 top-[-30px] flex h-[64px] w-[64px] -translate-x-1/2 items-center justify-center rounded-full border-[6px] border-white bg-[#22c55e] shadow-[0_12px_32px_rgba(34,197,94,0.28)]"
            aria-label="添加饮食"
          >
            <Camera size={25} strokeWidth={2.6} className="text-white" />
          </button>
          <div className="grid grid-cols-5 items-end">
            <button onClick={() => setTab('dashboard')} className={`flex min-h-[50px] flex-col items-center justify-center gap-1 text-[10px] font-bold ${tab === 'dashboard' ? 'text-[#22c55e]' : 'text-[#6b7280]'}`}>
              <Home size={22} strokeWidth={tab === 'dashboard' ? 2.7 : 2.2} />
              首页
            </button>
            <button onClick={() => setTab('history')} className={`flex min-h-[50px] flex-col items-center justify-center gap-1 text-[10px] font-bold ${tab === 'history' ? 'text-[#22c55e]' : 'text-[#6b7280]'}`}>
              <ClipboardList size={22} strokeWidth={tab === 'history' ? 2.7 : 2.2} />
              记录
            </button>
            <div className="min-h-[50px]" aria-hidden="true" />
            <button onClick={() => setTab('discover')} className={`flex min-h-[50px] flex-col items-center justify-center gap-1 text-[10px] font-bold ${tab === 'discover' ? 'text-[#22c55e]' : 'text-[#6b7280]'}`}>
              <Sparkles size={22} strokeWidth={tab === 'discover' ? 2.7 : 2.2} />
              发现
            </button>
            <button onClick={() => setTab('profile')} className={`flex min-h-[50px] flex-col items-center justify-center gap-1 text-[10px] font-bold ${tab === 'profile' ? 'text-[#22c55e]' : 'text-[#6b7280]'}`}>
              <User size={22} strokeWidth={tab === 'profile' ? 2.7 : 2.2} />
              我的
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {showCamera && <CameraModal onClose={() => setShowCamera(false)} onSaved={loadDashboard} />}
      </AnimatePresence>
    </div>
  );
}
