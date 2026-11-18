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
    default:
      return <Wallet className={className} style={style} />;
  }
}
