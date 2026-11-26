'use client';

import React from 'react';
import {
  Utensils,
  ShoppingBasket,
  HeartPulse,
  Zap,
  HeartHandshake,
  ShoppingBag,
  Car,
  Landmark,
  Film,
  TrendingUp,
  Wallet,
  Smartphone,
  Banknote,
  CreditCard,
  Plane,
  Bed,
  Receipt,
  Tv,
  Gift,
  Coffee,
  Fuel,
  PieChart,
  MoreHorizontal,
  Tag,
  Home,
  BookOpen,
  Dumbbell,
  Flame,
} from 'lucide-react';

interface CategoryIconProps {
  name?: string;
  className?: string;
  style?: React.CSSProperties;
}

const CATEGORY_ICON_MAP = {
  Utensils,
  ShoppingBasket,
  HeartPulse,
  Zap,
  HeartHandshake,
  ShoppingBag,
  Car,
  Landmark,
  Film,
  TrendingUp,
  Smartphone,
  Banknote,
  CreditCard,
  Plane,
  Bed,
  Receipt,
  Tv,
  Gift,
  Coffee,
  Fuel,
  PieChart,
  MoreHorizontal,
  Tag,
  Home,
  BookOpen,
  Dumbbell,
  Flame,
} as const;

export function CategoryIcon({ name, className = 'w-4 h-4', style }: CategoryIconProps) {
  const Icon = name && name in CATEGORY_ICON_MAP
    ? CATEGORY_ICON_MAP[name as keyof typeof CATEGORY_ICON_MAP]
    : Wallet;
  return <Icon className={className} style={style} />;
}
