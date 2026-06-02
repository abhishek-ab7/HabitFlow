'use client';

import { useEffect, useState } from 'react';
import { useLeaderboardStore, LeaderboardEntry } from '@/lib/stores/leaderboard-store';
import { useAuth } from '@/providers/auth-provider';
import { Trophy, Medal, Search, AlertCircle, RefreshCw, Eye, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DisciplineRadar } from '@/components/gamification/DisciplineRadar';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const { rankings, isLoading, error, userRank, loadRankings } = useLeaderboardStore();
  const [selectedUser, setSelectedUser] = useState<LeaderboardEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadRankings();
  }, [loadRankings]);

  // Filter rankings based on search term
  const filteredRankings = rankings.filter((entry) =>
    (entry.user_name || 'Anonymous')
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  // Split into Top 3 and Rest
  const podiumEntries = rankings.slice(0, 3);
  const tableEntries = filteredRankings.slice(podiumEntries.length);

  const getRankStyle = (index: number) => {
    switch (index) {
      case 0: // Gold
        return {
          podiumClass: 'bg-gradient-to-t from-yellow-600/30 to-amber-400/20 border-yellow-500/50 order-2',
          iconColor: 'text-amber-400 fill-amber-400/20',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          height: 'h-[220px]',
          rankLabel: '1st',
        };
      case 1: // Silver
        return {
          podiumClass: 'bg-gradient-to-t from-slate-500/30 to-slate-300/20 border-slate-400/50 order-1',
          iconColor: 'text-slate-300 fill-slate-300/20',
          badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
          height: 'h-[180px]',
          rankLabel: '2nd',
        };
      case 2: // Bronze
        return {
          podiumClass: 'bg-gradient-to-t from-amber-800/30 to-amber-700/20 border-amber-800/50 order-3',
          iconColor: 'text-amber-600 fill-amber-600/20',
          badgeColor: 'bg-amber-700/20 text-amber-400 border-amber-700/30',
          height: 'h-[150px]',
          rankLabel: '3rd',
        };
      default:
        return null;
    }
  };

  const getAvatarLetter = (name?: string) => {
    return name ? name.charAt(0).toUpperCase() : 'H';
  };

  return (
    <div className="w-full px-4 py-8 md:px-6 lg:px-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary via-purple-600 to-pink-500 bg-clip-text text-transparent">
            Community Leaderboard
          </h1>
          <p className="text-muted-foreground mt-1.5">
            Compete with the community and climb ranks by mastering your habits.
          </p>
        </div>
        <Button
          onClick={() => loadRankings()}
          disabled={isLoading}
          variant="outline"
          className="gap-2 border-indigo-500/30 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading && rankings.length === 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4 h-[220px] items-end">
            <Skeleton className="h-[180px] rounded-2xl" />
            <Skeleton className="h-[220px] rounded-2xl" />
            <Skeleton className="h-[150px] rounded-2xl" />
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {podiumEntries.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end md:max-w-3xl mx-auto py-6">
              {podiumEntries.map((entry, index) => {
                const style = getRankStyle(index);
                if (!style) return null;

                const isCurrentUser = user?.id === entry.user_id;

                return (
                  <motion.div
                    key={entry.user_id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', delay: index * 0.1 }}
                    className={cn(
                      'flex flex-col items-center justify-end rounded-2xl border p-6 text-center shadow-xl backdrop-blur-md relative group hover:scale-[1.02] transition-all duration-300',
                      style.podiumClass,
                      style.height,
                      isCurrentUser && 'ring-2 ring-primary'
                    )}
                  >
                    {/* Glowing highlight */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="space-y-3 relative z-10 w-full flex flex-col items-center">
                      <div className="relative">
                        {/* Avatar */}
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg border-2 border-white/20">
                          {getAvatarLetter(entry.user_name)}
                        </div>
                        <Badge
                          className={cn(
                            'absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                            style.badgeColor
                          )}
                        >
                          {style.rankLabel}
                        </Badge>
                      </div>

                      <div className="space-y-1 w-full max-w-[150px]">
                        <h4 className="font-bold text-base truncate text-foreground">
                          {entry.user_name || 'Anonymous'}
                        </h4>
                        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-medium">
                          <span>Lv.{entry.level}</span>
                          <span>•</span>
                          <span>{entry.xp} XP</span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedUser(entry)}
                        className="h-8 text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Rankings List & Search */}
          <Card className="border-indigo-500/10 bg-white/5 dark:bg-slate-900/10 backdrop-blur-md shadow-xl overflow-hidden rounded-2xl">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-indigo-500/10">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-indigo-500" />
                  Global Rankings
                </CardTitle>
                <CardDescription>
                  Live scores of all active members in the community.
                </CardDescription>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 rounded-xl border border-indigo-500/20 bg-slate-950/20 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                  {/* Header Row */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-indigo-500/10 text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                    <div className="w-12">Rank</div>
                    <div className="flex-1">User</div>
                    <div className="w-20 text-center">Level</div>
                    <div className="w-24 text-center">XP</div>
                    <div className="w-24 text-right">Actions</div>
                  </div>
                  
                  {filteredRankings.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No rankings match your search query.
                    </div>
                  ) : (
                    <div className="divide-y divide-indigo-500/5">
                      {filteredRankings.map((entry, index) => {
                        const rank = index + 1;
                        const isCurrentUser = user?.id === entry.user_id;

                        return (
                          <div
                            key={entry.user_id}
                            className={cn(
                              'flex items-center justify-between px-6 py-4 hover:bg-indigo-50/5 dark:hover:bg-indigo-950/5 transition-colors group',
                              isCurrentUser && 'bg-primary/5 border-l-4 border-primary'
                            )}
                          >
                            {/* Rank Column */}
                            <div className="w-12 font-bold text-slate-400 group-hover:text-slate-200 transition-colors flex items-center gap-1.5">
                              {rank <= 3 ? (
                                <Medal className={cn(
                                  "w-5 h-5",
                                  rank === 1 && "text-amber-400",
                                  rank === 2 && "text-slate-300",
                                  rank === 3 && "text-amber-600"
                                )} />
                              ) : (
                                <span>#{rank}</span>
                              )}
                            </div>

                            {/* User details */}
                            <div className="flex-1 flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/20 flex items-center justify-center font-bold text-sm text-indigo-400 shrink-0">
                                {getAvatarLetter(entry.user_name)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold truncate text-foreground flex items-center gap-1.5">
                                  {entry.user_name || 'Anonymous'}
                                  {isCurrentUser && (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 border-primary/20 text-primary">
                                      You
                                    </Badge>
                                  )}
                                </p>
                              </div>
                            </div>

                            {/* Level */}
                            <div className="w-20 text-center font-semibold text-foreground">
                              Lv.{entry.level}
                            </div>

                            {/* XP */}
                            <div className="w-24 text-center text-muted-foreground font-medium">
                              {entry.xp} XP
                            </div>

                            {/* Actions */}
                            <div className="w-24 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedUser(entry)}
                                className="h-8 rounded-xl px-2 gap-1.5 text-xs text-indigo-500 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Inspect
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* User Inspection Modal */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-md border-slate-200/50 dark:border-indigo-500/20 bg-card text-foreground rounded-2xl shadow-2xl overflow-hidden p-6">
          {selectedUser && (
            <>
              <DialogHeader className="flex flex-col items-center pb-4 border-b border-border/40">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-slate-200/50 dark:border-white/10 flex items-center justify-center font-bold text-3xl text-white shadow-xl mb-3">
                  {getAvatarLetter(selectedUser.user_name)}
                </div>
                <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
                  {selectedUser.user_name || 'Anonymous'}
                  <Badge className="bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-0">
                    Lv.{selectedUser.level}
                  </Badge>
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">Total score: {selectedUser.xp} XP</p>
              </DialogHeader>

              <div className="py-6 space-y-6">
                {selectedUser.stats ? (
                  <DisciplineRadar stats={selectedUser.stats} />
                ) : (
                  <div className="h-[200px] flex flex-col items-center justify-center border border-border/40 rounded-2xl bg-muted/20 text-muted-foreground text-sm">
                    <Sparkles className="w-8 h-8 text-indigo-500/40 mb-2" />
                    <span>No stats unlocked yet</span>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
