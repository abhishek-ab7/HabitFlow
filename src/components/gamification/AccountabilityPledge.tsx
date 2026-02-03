'use client';

import { useState, useEffect } from 'react';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { PenLine, Save, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function AccountabilityPledge() {
    const { motivationText, updateMotivation } = useGamificationStore();
    const [text, setText] = useState(motivationText);
    const [isEditing, setIsEditing] = useState(false);

    // Sync local state with store when store loads
    useEffect(() => {
        setText(motivationText);
    }, [motivationText]);

    const handleSave = async () => {
        if (!text.trim()) return;

        await updateMotivation(text);
        setIsEditing(false);
        toast.success("Identity Protocol Updated", {
            description: "Your motivation core has been synchronized."
        });
    };

    return (
        <motion.div
            layoutId="pledge-card"
            className={cn(
                "group relative overflow-hidden rounded-3xl p-[1px] cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/20",
                isEditing ? "ring-2 ring-indigo-500/50" : ""
            )}
            onClick={() => !isEditing && setIsEditing(true)}
        >
            {/* Animated Border Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-30 dark:opacity-50" />

            <div className="relative h-full bg-white/90 dark:bg-black/90 backdrop-blur-xl rounded-[23px] p-6 overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_14px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                                <ShieldCheck className="w-5 h-5 text-indigo-500" />
                            </div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/80">
                                Motivation Core
                            </h3>
                        </div>
                        {!isEditing && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-[10px] font-mono text-indigo-500 bg-indigo-500/10 px-2 py-1 rounded-full border border-indigo-500/20"
                            >
                                {text ? 'ACTIVE' : 'SETUP REQ'}
                            </motion.div>
                        )}
                        {!isEditing && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground group-hover:text-indigo-500 transition-colors -mr-2">
                                <PenLine className="w-4 h-4" />
                            </Button>
                        )}
                    </div>

                    <AnimatePresence mode="wait">
                        {isEditing ? (
                            <motion.div
                                key="editing"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-4"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Textarea
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder="I commit to excellence because..."
                                    className="min-h-[120px] bg-white/50 dark:bg-black/50 border-indigo-500/30 focus-visible:ring-indigo-500/50 resize-none text-lg font-medium leading-relaxed"
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setIsEditing(false); }}>Cancel</Button>
                                    <Button onClick={handleSave} className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25">
                                        <Save className="w-4 h-4" />
                                        Save Protocol
                                    </Button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="viewing"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-6"
                            >
                                <p className={cn(
                                    "text-lg font-medium leading-relaxed",
                                    text ? "text-foreground" : "text-muted-foreground italic"
                                )}>
                                    "{text || "Define your Why. Click to initialize your motivation protocol."}"
                                </p>

                                {text && (
                                    <div className="flex items-center gap-2 pt-4 border-t border-dashed border-indigo-500/20 text-indigo-500/70">
                                        <Sparkles className="w-3 h-3" />
                                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold">
                                            Signature Verified
                                        </span>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
}
