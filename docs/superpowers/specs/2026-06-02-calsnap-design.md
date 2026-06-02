# CalSnap Design Spec

## Overview

CalSnap — Android PWA 拍照识别食物热量工具。拍照自动识别食物并计算热量，追踪饮食与体重，AI 提供个性化饮食建议。用户自行配置 AI API Key，数据完全本地存储，无需应用商店。

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS (暗色底 + 暖橙渐变主题)
- IndexedDB (饮食记录 + 个人档案)
- localStorage (API Key + 设置 + 主题偏好)
- Claude API / OpenAI GPT-4V (用户自选，自行配置 Key)
- PWA: service worker + manifest.json
- 部署: Cloudflare Pages

## Visual Style

- 暗色背景 (#1a1a2e → #16213e 渐变)
- 暖橙主色 (#FF6B35)、辅助金黄 (#FFB347, #FFD93D)
- 粗体圆角数字，有亲和力
- 表盘式半圆弧热量进度条（带刻度线、渐变色填充）
- 圆角卡片 + 轻微阴影
- 支持亮/暗主题切换

## Pages (3 Tabs)

### 1. 仪表盘 (Dashboard)

页面结构从上到下：
- 日期 + 目标标签（减脂中/维持/增肌）
- 表盘式半圆弧热量进度（刻度线 + 渐变弧 + 中央大字数值）
- 三大营养素占比标签（碳水/蛋白质/脂肪）
- 今日饮食卡片列表（可滚动），每张卡片显示餐别、食物、热量
- 半圆形相机按钮（底部固定，橙色渐变，镜头造型）
- 底部 3 Tab 导航

拍照按钮始终可见，点击直接启动相机。

### 2. 记录 (History)

- 按日期分组的饮食记录时间线
- 每天显示摄入总热量
- 点击日期展开当餐详情
- 支持删除某条记录

### 3. 我的 (Profile)

- 个人档案：身高、体重、年龄、性别、目标（减脂/维持/增肌）
- AI 设置：选择服务（Claude / OpenAI）、填写 API Key
- 外观：亮色/暗色主题切换
- 数据管理：导出/清除本地数据

## Data Model

```
UserProfile {
  height: number        // cm
  weight: number        // kg
  age: number
  gender: 'male' | 'female'
  goal: 'lose' | 'maintain' | 'gain'
  dailyTarget: number   // kcal, 自动根据档案计算
  weightHistory: [{ date, weight }]
}

MealRecord {
  id: string
  date: string          // YYYY-MM-DD
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  foods: [{ name, portion, calories }]
  totalCalories: number
  photoUrl: string      // base64 存在 IndexedDB
  createdAt: timestamp
}

Settings {
  aiService: 'claude' | 'openai'
  apiKey: string
  theme: 'light' | 'dark'
}
```

## AI Recognition Flow

1. 用户点击拍照按钮 → 调用相机或从相册选图
2. 前端压缩图片 (canvas resize, max ~1024px, JPEG quality 0.7)
3. 构建 Prompt 发给 AI: 列出图中所有食物、估算每样分量(g)、估算每样热量(kcal)、返回 JSON
4. 解析 AI 返回的 JSON → 展示确认页，用户可编辑
5. 确认后存入 IndexedDB，跳回仪表盘

## Dietary Advice Flow

1. 用户点击仪表盘 AI 建议入口
2. 读取用户档案 + 近 7 天饮食记录
3. 构建 Prompt 包含用户目标、体重趋势、饮食数据
4. AI 返回：营养缺口分析、饮食模式问题、具体改进建议
5. 展示建议结果

## Out of Scope

- 注册/登录系统
- 云端数据同步
- 社交功能
- 自建食物数据库
- 多设备支持
- iOS 适配（先做 Android）
