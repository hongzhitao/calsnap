import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Search, ExternalLink, Loader2, Dumbbell, Sparkles, Image } from 'lucide-react';
import type { AppSettings } from '../types';
import { getSettings } from '../db';
import { identifyEquipment, type GymResult } from '../ai';
import { compressImage } from '../utils';

interface VideoCard {
  exercise: string;
  xhsUrl: string;
  coverUrl: string;
}

export default function GymDiscover() {
  const [step, setStep] = useState<'idle' | 'preview' | 'loading' | 'result'>('idle');
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<GymResult | null>(null);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file, 1024, 0.7).then((dataUrl) => {
      setPhoto(dataUrl);
      setStep('preview');
    });
  }

  async function handleIdentify() {
    if (!photo || !settings?.apiKey) {
      setError('请先在「我的」页面配置 API Key');
      return;
    }
    setStep('loading');
    setError('');
    try {
      const r = await identifyEquipment(photo, settings);
      setResult(r);
      setStep('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : '识别失败，请重试');
      setStep('preview');
    }
  }

  function buildVideoCards(result: GymResult): VideoCard[] {
    const baseName = result.name;
    return result.exercises.map((exercise, i) => {
      const query = encodeURIComponent(`${baseName} ${exercise}`);
      return {
        exercise,
        xhsUrl: `https://www.xiaohongshu.com/search_result?keyword=${query}&type=51`,
        coverUrl: `https://picsum.photos/seed/gym-${i}-${Date.now()}/360/480`,
      };
    });
  }

  function handleOpenXHS(url: string) {
    // Try deep link first, fallback to web URL
    const keyword = new URL(url).searchParams.get('keyword') || '';
    const deepLink = `xhsdiscover://search?keyword=${encodeURIComponent(keyword)}&type=51`;
    const start = Date.now();
    window.location.href = deepLink;
    // If deep link doesn't fire within 1s, open web fallback
    setTimeout(() => {
      if (Date.now() - start < 1500) {
        window.open(url, '_blank');
      }
    }, 800);
  }

  function reset() {
    setStep('idle');
    setPhoto(null);
    setResult(null);
    setError('');
  }

  return (
    <div className="flex flex-1 flex-col bg-white pb-24">
      {/* Header */}
      <div className="px-5 pt-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
            <Dumbbell size={18} className="text-green-600" />
          </div>
          <div>
            <h2 className="text-[20px] font-extrabold tracking-[-0.5px] text-black">器械识别</h2>
            <p className="text-[12px] font-medium text-[#6b7280]">拍照识别健身器械，查看小红书教学视频</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col px-4 pt-5">
        <AnimatePresence mode="wait">
          {step === 'idle' && (
            <motion.div
              key="idle"
              className="flex flex-1 flex-col items-center justify-center gap-6"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <div className="relative">
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-green-50">
                  <Dumbbell size={42} className="text-green-500" />
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full bg-green-500 shadow-lg">
                  <Sparkles size={18} className="text-white" />
                </div>
              </div>
              <div className="text-center">
                <div className="text-[17px] font-extrabold text-black">不认识器械？拍一下试试</div>
                <div className="mt-1 text-[13px] font-medium text-[#6b7280]">AI 自动识别器械类型</div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFile}
                className="hidden"
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-3">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-14 items-center gap-2 rounded-2xl bg-green-500 px-8 text-[15px] font-bold text-white shadow-[0_8px_24px_rgba(34,197,94,0.28)]"
                >
                  <Camera size={20} />
                  拍照识别器械
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex h-12 items-center gap-2 rounded-2xl border border-gray-200 px-6 text-[14px] font-semibold text-[#6b7280] active:bg-gray-50"
                >
                  <Image size={18} />
                  从相册选择
                </motion.button>
              </div>
              <p className="text-[11px] text-[#6b7280]">例如：史密斯架、蝴蝶机、哈克深蹲机...</p>
            </motion.div>
          )}

          {step === 'preview' && photo && (
            <motion.div
              key="preview"
              className="flex flex-1 flex-col items-center gap-4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <img src={photo} alt="器械照片" className="w-full max-w-sm rounded-3xl shadow-lg" />
              {error && <p className="text-center text-[13px] font-medium text-red-500">{error}</p>}
              <div className="flex w-full max-w-sm gap-3">
                <button onClick={reset} className="h-12 flex-1 rounded-2xl border border-gray-200 text-[14px] font-semibold text-[#6b7280]">
                  重拍
                </button>
                <button onClick={handleIdentify} className="h-12 flex-1 rounded-2xl bg-green-500 text-[14px] font-semibold text-white shadow-[0_6px_18px_rgba(34,197,94,0.22)]">
                  开始识别
                </button>
              </div>
            </motion.div>
          )}

          {step === 'loading' && (
            <motion.div
              key="loading"
              className="flex flex-1 flex-col items-center justify-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
                <Loader2 size={32} className="animate-spin text-green-500" />
              </div>
              <div className="text-center">
                <div className="text-[16px] font-bold text-black">AI 识别中...</div>
                <div className="mt-1 text-[13px] text-[#6b7280]">正在分析器械类型</div>
              </div>
            </motion.div>
          )}

          {step === 'result' && result && (
            <motion.div
              key="result"
              className="flex flex-1 flex-col"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              {/* Equipment info card */}
              <div className="mb-4 rounded-3xl bg-green-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-green-500 text-white">
                    <Dumbbell size={22} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[18px] font-extrabold text-black">{result.name}</h3>
                    <p className="mt-1 text-[13px] font-medium leading-relaxed text-[#4b5563]">{result.description}</p>
                  </div>
                </div>
              </div>

              {/* Video cards */}
              <div className="flex-1">
                <div className="mb-3 flex items-center gap-2">
                  <Search size={16} className="text-[#ff2442]" />
                  <h4 className="text-[15px] font-bold text-black">小红书教学视频</h4>
                  <span className="text-[12px] text-[#6b7280]">· 点击跳转观看</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {buildVideoCards(result).map((card, i) => (
                    <motion.button
                      key={card.exercise}
                      onClick={() => handleOpenXHS(card.xhsUrl)}
                      className="group relative overflow-hidden rounded-2xl bg-gray-100 text-left shadow-sm active:scale-[0.97] transition-transform"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.1, duration: 0.35, ease: 'easeOut' }}
                    >
                      {/* Cover image */}
                      <div className="relative aspect-[3/4] overflow-hidden">
                        <img
                          src={card.coverUrl}
                          alt={card.exercise}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        {/* Play button overlay */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-active:bg-black/20">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur">
                            <div className="ml-0.5 h-0 w-0 border-b-[8px] border-l-[14px] border-t-[8px] border-b-transparent border-l-green-500 border-t-transparent" />
                          </div>
                        </div>
                        {/* XHS badge */}
                        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-[#ff2442]/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                          <ExternalLink size={10} />
                          小红书
                        </div>
                      </div>
                      {/* Title */}
                      <div className="p-3">
                        <div className="line-clamp-2 text-[13px] font-bold leading-snug text-black">
                          {card.exercise}
                        </div>
                        <div className="mt-1 text-[11px] font-medium text-[#6b7280]">
                          点击跳转观看 →
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Retry button */}
              <button
                onClick={reset}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 text-[14px] font-semibold text-[#6b7280]"
              >
                <Camera size={16} />
                重新拍照识别
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
