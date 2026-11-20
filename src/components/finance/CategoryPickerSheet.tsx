'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFinanceStore } from '@/lib/stores/finance-store';
import type { FinanceCategory } from '@/lib/types';
import { Plus, ChevronLeft, Check } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { toast } from 'sonner';

interface CategoryPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
}

const CUSTOM_ICONS = [
  'Utensils',
  'ShoppingBasket',
  'Plane',
  'Bed',
  'Receipt',
  'Tv',
  'ShoppingBag',
  'Gift',
  'Coffee',
  'Fuel',
  'PieChart',
  'HeartPulse',
  'Film',
  'Home',
  'BookOpen',
  'Dumbbell',
  'MoreHorizontal',
] as const;

const CUSTOM_COLORS = [
  '#f59e0b',
  '#f43f5e',
  '#3b82f6',
  '#a855f7',
  '#10b981',
  '#06b6d4',
  '#ec4899',
  '#64748b',
] as const;

export function CategoryPickerSheet({
  open,
  onOpenChange,
  selectedCategoryId,
  onSelectCategory,
}: CategoryPickerSheetProps) {
  const categories = useFinanceStore((s) => s.categories);
  const addCategory = useFinanceStore((s) => s.addCategory);

  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customIcon, setCustomIcon] = useState<string>('Tag');
  const [customColor, setCustomColor] = useState<string>('#6366f1');
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setIsCreatingCustom(false);
      setCustomName('');
    }
    onOpenChange(nextOpen);
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customName.trim();
    if (!trimmed) {
      toast.error('Enter a category name');
      return;
    }

    setIsSaving(true);
    try {
      const slug =
        trimmed
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || `custom-${Date.now()}`;

      const created: FinanceCategory = await addCategory({
        name: trimmed,
        slug: `${slug}-${Date.now().toString(36)}`,
        type: 'expense',
        icon: customIcon,
        color: customColor,
        monthlyBudgetLimit: 0,
        subcategories: [],
        order: categories.length,
        isSystem: false,
        archived: false,
      });

      onSelectCategory(created.id);
      toast.success(`Added "${created.name}"`);
      setIsCreatingCustom(false);
      setCustomName('');
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="z-[60] p-0 gap-0 overflow-hidden max-w-full sm:max-w-[430px] w-full fixed bottom-0 top-auto left-1/2 -translate-x-1/2 translate-y-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 rounded-t-3xl sm:rounded-2xl max-h-[82vh] flex flex-col border-border bg-background"
      >
        {/* Drag Handle */}
        <div className="pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {!isCreatingCustom ? (
          <div className="px-5 pt-2 pb-6 overflow-y-auto space-y-5">
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
              Select Category
            </DialogTitle>

            {/* 4-Column Circular Ring Icon Grid (matches screenshot) */}
            <div className="grid grid-cols-4 gap-x-3 gap-y-5">
              {categories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      onSelectCategory(cat.id);
                      onOpenChange(false);
                    }}
                    className="flex flex-col items-center gap-2 group focus:outline-none"
                  >
                    <span
                      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all group-active:scale-95 ${
                        isSelected
                          ? 'ring-2 ring-offset-2 ring-offset-background ring-primary shadow-sm'
                          : 'hover:scale-105'
                      }`}
                      style={{
                        borderWidth: '1.75px',
                        borderStyle: 'solid',
                        borderColor: `${cat.color}85`,
                        backgroundColor: isSelected
                          ? `${cat.color}20`
                          : `${cat.color}10`,
                        color: cat.color,
                      }}
                    >
                      <CategoryIcon name={cat.icon} className="w-6 h-6" />
                    </span>
                    <span
                      className={`text-xs font-medium text-center leading-tight line-clamp-2 ${
                        isSelected ? 'text-primary font-semibold' : 'text-foreground'
                      }`}
                    >
                      {cat.name}
                    </span>
                  </button>
                );
              })}

              {/* Add Custom Category Button */}
              <button
                type="button"
                onClick={() => setIsCreatingCustom(true)}
                className="flex flex-col items-center gap-2 group focus:outline-none"
              >
                <span className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center shadow-sm transition-transform group-active:scale-95">
                  <Plus className="w-6 h-6" />
                </span>
                <span className="text-xs font-medium text-center text-foreground leading-tight">
                  Add Custom
                </span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateCustom} className="px-5 pt-2 pb-6 overflow-y-auto space-y-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingCustom(false)}
                aria-label="Back to categories"
                className="min-h-[40px] min-w-[40px] -ml-2 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <DialogTitle className="text-base font-bold text-foreground">
                Add Custom Category
              </DialogTitle>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="custom-category-name"
                className="text-xs font-medium text-muted-foreground block"
              >
                Category Name
              </label>
              <Input
                id="custom-category-name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Coffee, Stays, Gifts..."
                className="h-11 rounded-xl text-sm"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground block">
                Color
              </span>
              <div className="flex flex-wrap gap-2.5">
                {CUSTOM_COLORS.map((color) => {
                  const active = customColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCustomColor(color)}
                      aria-label={`Select color ${color}`}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform ${
                        active ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {active && <Check className="w-4 h-4 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground block">
                Icon
              </span>
              <div className="grid grid-cols-6 gap-2">
                {CUSTOM_ICONS.map((iconName) => {
                  const active = customIcon === iconName;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setCustomIcon(iconName)}
                      aria-label={`Select icon ${iconName}`}
                      className={`h-11 rounded-xl border flex items-center justify-center transition-colors ${
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <CategoryIcon
                        name={iconName}
                        className="w-5 h-5"
                        style={active ? { color: customColor } : undefined}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSaving}
              className="w-full h-12 rounded-xl text-sm font-semibold"
            >
              {isSaving ? 'Adding...' : 'Create & Select'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
