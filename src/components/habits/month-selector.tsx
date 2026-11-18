'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MonthSelectorProps {
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
}

export function MonthSelector({ selectedMonth, onMonthChange }: MonthSelectorProps) {
  const [showPicker, setShowPicker] = useState(false);

  const currentYear = selectedMonth.getFullYear();
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const handlePrevMonth = () => {
    onMonthChange(subMonths(selectedMonth, 1));
  };

  const handleNextMonth = () => {
    const next = addMonths(selectedMonth, 1);
    if (next <= new Date()) {
      onMonthChange(next);
    }
  };

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(currentYear, monthIndex, 1);
    if (newDate <= new Date()) {
      onMonthChange(newDate);
      setShowPicker(false);
    }
  };

  const handleYearChange = (delta: number) => {
    const newDate = new Date(currentYear + delta, selectedMonth.getMonth(), 1);
    if (newDate <= new Date()) {
      onMonthChange(newDate);
    }
  };

  const isNextDisabled = addMonths(selectedMonth, 1) > new Date();
  const isCurrentMonth = format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevMonth}
          className="h-9 w-9"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <button
          onClick={() => setShowPicker(!showPicker)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg",
            "bg-muted hover:bg-muted/80 transition-colors",
            "font-medium text-sm"
          )}
        >
          <Calendar className="h-4 w-4" />
          {format(selectedMonth, 'MMMM yyyy')}
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextMonth}
          disabled={isNextDisabled}
          className="h-9 w-9"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {!isCurrentMonth && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMonthChange(new Date())}
            className="ml-2"
          >
            Today
          </Button>
        )}
      </div>

      {/* Month Picker Overlay */}
      <AnimatePresence>
        {showPicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setShowPicker(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-full left-0 mt-2 z-50 p-4 rounded-xl bg-card border shadow-xl"
            >
              {/* Year selector */}
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleYearChange(-1)}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold">{currentYear}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleYearChange(1)}
                  disabled={currentYear >= new Date().getFullYear()}
                  className="h-8 w-8"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Month grid */}
              <div className="grid grid-cols-3 gap-2">
                {months.map((month, index) => {
                  const monthDate = new Date(currentYear, index, 1);
                  const isDisabled = monthDate > new Date();
                  const isSelected = selectedMonth.getMonth() === index && 
                                    selectedMonth.getFullYear() === currentYear;

                  return (
                    <button
                      key={month}
                      onClick={() => handleMonthSelect(index)}
                      disabled={isDisabled}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        isSelected 
                          ? "bg-primary text-primary-foreground" 
                          : "hover:bg-muted",
                        isDisabled && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {month}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
