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
} from 'lucide-react';

interface CategoryIconProps {
  name?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function CategoryIcon({ name, className = 'w-4 h-4', style }: CategoryIconProps) {
  switch (name) {
    case 'Utensils':
      return <Utensils className={className} style={style} />;
    case 'ShoppingBasket':
      return <ShoppingBasket className={className} style={style} />;
    case 'HeartPulse':
      return <HeartPulse className={className} style={style} />;
    case 'Zap':
      return <Zap className={className} style={style} />;
    case 'HeartHandshake':
      return <HeartHandshake className={className} style={style} />;
    case 'ShoppingBag':
      return <ShoppingBag className={className} style={style} />;
    case 'Car':
      return <Car className={className} style={style} />;
    case 'Landmark':
      return <Landmark className={className} style={style} />;
    case 'Film':
      return <Film className={className} style={style} />;
    case 'TrendingUp':
      return <TrendingUp className={className} style={style} />;
    case 'Smartphone':
      return <Smartphone className={className} style={style} />;
    case 'Banknote':
      return <Banknote className={className} style={style} />;
    case 'CreditCard':
      return <CreditCard className={className} style={style} />;
    case 'Plane':
      return <Plane className={className} style={style} />;
    case 'Bed':
      return <Bed className={className} style={style} />;
    case 'Receipt':
      return <Receipt className={className} style={style} />;
    case 'Tv':
      return <Tv className={className} style={style} />;
    case 'Gift':
      return <Gift className={className} style={style} />;
    case 'Coffee':
      return <Coffee className={className} style={style} />;
    case 'Fuel':
      return <Fuel className={className} style={style} />;
    case 'PieChart':
      return <PieChart className={className} style={style} />;
    case 'MoreHorizontal':
      return <MoreHorizontal className={className} style={style} />;
    case 'Tag':
      return <Tag className={className} style={style} />;
    case 'Home':
      return <Home className={className} style={style} />;
    case 'BookOpen':
      return <BookOpen className={className} style={style} />;
    case 'Dumbbell':
      return <Dumbbell className={className} style={style} />;
    default:
      return <Wallet className={className} style={style} />;
  }
}
