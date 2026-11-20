'use client';

import { useEffect, useState } from 'react';
import { useAchievementStore, Achievement } from '@/lib/stores/achievement-store';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Zap, Flame, Trophy, CheckSquare, BookOpen, PlusCircle, Smile, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// Confetti Particle Component
function ConfettiEffect() {
  const [particles, setParticles] = useState<Array<{ id: number; left: number; delay: number; color: string; duration: number }>>([]);

  useEffect(() => {
    const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#ef4444'];
    const list = Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setParticles(list);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute top-0 w-2 h-2 rounded-sm opacity-85"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animation: `fall ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
      <style jsx global>{`
        @keyframes fall {
          0% {
            transform: translateY(-20px) rotate(0deg);
          }
          100% {
            transform: translateY(105vh) rotate(720deg);
          }
        }
      `}</style>
    </div>
  );
}

export function AchievementsGallery() {
  const { achievements, newlyUnlockedId, calculateAchievements, claimReward, resetNewlyUnlocked } =
    useAchievementStore();

  const [activeCelebration, setActiveCelebration] = useState<Achievement | null>(null);

  // Sync / calculate store values on mount
  useEffect(() => {
    calculateAchievements();
  }, [calculateAchievements]);

  // Catch any newly unlocked achievements to open popover
  useEffect(() => {
    if (newlyUnlockedId) {
      const found = achievements.find(a => a.id === newlyUnlockedId);
      if (found) {
        setActiveCelebration(found);
      }
    }
  }, [newlyUnlockedId, achievements]);

  const handleCloseCelebration = () => {
    setActiveCelebration(null);
    resetNewlyUnlocked();
  };

  const getIcon = (iconName: string, active: boolean) => {
    const classes = active ? "w-7 h-7 stroke-[2.5]" : "w-7 h-7 text-muted-foreground/60 stroke-[2]";
    switch (iconName) {
      case 'Zap': return <Zap className={classes} />;
      case 'Flame': return <Flame className={classes} />;
      case 'Trophy': return <Trophy className={classes} />;
      case 'CheckSquare': return <CheckSquare className={classes} />;
      case 'BookOpen': return <BookOpen className={classes} />;
      case 'PlusCircle': return <PlusCircle className={classes} />;
      case 'Smile': return <Smile className={classes} />;
      default: return <Trophy className={classes} />;
    }
  };

  const categoryColors = {
    streaks: 'from-orange-500 to-amber-400 text-orange-500 bg-orange-500/10 border-orange-500/20',
    tasks: 'from-blue-500 to-sky-400 text-blue-500 bg-blue-500/10 border-blue-500/20',
    journal: 'from-emerald-500 to-teal-400 text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    mood: 'from-rose-500 to-amber-400 text-rose-500 bg-rose-500/10 border-rose-500/20',
    general: 'from-primary to-teal-500 text-primary bg-primary/10 border-primary/20',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Achievements & Badges
          </h2>
          <p className="text-sm text-muted-foreground">
            Complete milestones, unlock legendary badges, and earn rewards.
          </p>
        </div>
        <div className="text-xs font-semibold font-mono tabular-nums px-3 py-1.5 rounded-full bg-invest/15 border border-invest/25 text-invest w-fit">
          Unlocked: <span className="font-bold">{achievements.filter(a => a.isUnlocked).length}</span> / {achievements.length}
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {achievements.map((ach) => {
          const colorClass = categoryColors[ach.category] || categoryColors.general;
          const progressPercent = ach.target > 0 ? (ach.progress / ach.target) * 100 : 0;

          return (
            <motion.div
              key={ach.id}
              whileHover={ach.isUnlocked ? { y: -3, transition: { duration: 0.2 } } : {}}
              className={`p-4 rounded-2xl border transition-all ${
                ach.isUnlocked
                  ? "bg-card hover:shadow-md border-border/80"
                  : "bg-muted/30 border-dashed border-border/40 opacity-70"
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Badge Icon Slot */}
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0 relative ${
                    ach.isUnlocked
                      ? `bg-gradient-to-br ${colorClass.split(' ')[0]} ${colorClass.split(' ')[1]} text-white border-transparent shadow-md`
                      : "bg-muted border-border"
                  }`}
                >
                  {getIcon(ach.icon, ach.isUnlocked)}
                  {ach.isUnlocked && !ach.isClaimed && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-1">
                    <h3 className={`text-sm font-bold truncate leading-tight ${
                      ach.isUnlocked ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      {ach.title}
                    </h3>
                    <span className="text-[10px] font-bold text-muted-foreground shrink-0 uppercase tracking-widest">
                      {ach.category}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground/90 line-clamp-2 leading-snug">
                    {ach.description}
                  </p>
                </div>
              </div>

              {/* Progress & Actions */}
              <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-4">
                {!ach.isUnlocked ? (
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                      <span>Progress</span>
                      <span>{ach.progress} / {ach.target}</span>
                    </div>
                    <Progress value={progressPercent} className="h-1.5 bg-muted" />
                  </div>
                ) : ach.isClaimed ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Claimed (+{ach.gemReward} Gems)</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <div className="text-[10px] text-muted-foreground font-medium flex flex-col">
                      <span>Reward:</span>
                      <span className="font-bold text-amber-500">+{ach.gemReward} Gems</span>
                    </div>
                    <Button
                      size="sm"
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold cursor-pointer text-xs h-7 px-3"
                      onClick={() => {
                        claimReward(ach.id);
                        toast.success(`Claimed reward for ${ach.title}!`, {
                          description: `Received +${ach.gemReward} Gems and +${ach.xpReward} XP.`,
                        });
                      }}
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Claim
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Celebration Modal Popover */}
      <AnimatePresence>
        {activeCelebration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <ConfettiEffect />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="surface-hero p-8 max-w-sm w-full text-center relative overflow-hidden flex flex-col items-center gap-6"
            >
              {/* Outer Badge Ring */}
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500 via-primary to-invest p-1 shadow-lg">
                <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-amber-500" />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase font-bold tracking-widest text-invest">Achievement Unlocked!</p>
                <h3 className="text-2xl font-bold text-foreground">{activeCelebration.title}</h3>
                <p className="text-sm text-muted-foreground">{activeCelebration.description}</p>
              </div>

              <div className="surface-subtle p-4 w-full flex items-center justify-around">
                <div className="text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">XP Reward</p>
                  <p className="text-lg font-bold text-invest font-mono tabular-nums">+{activeCelebration.xpReward}</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Gem Reward</p>
                  <p className="text-lg font-bold text-amber-500 font-mono tabular-nums">+{activeCelebration.gemReward}</p>
                </div>
              </div>

              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-11 rounded-xl shadow-sm cursor-pointer"
                onClick={handleCloseCelebration}
              >
                Hooray!
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
