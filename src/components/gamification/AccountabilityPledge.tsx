'use client';

import { useState, useEffect } from 'react';
import { useGamificationStore } from '@/lib/stores/gamification-store';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { PenLine, Save, ScrollText } from 'lucide-react';
import { toast } from 'sonner';

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
        toast.success("Pledge signed!", {
            description: "Your commitment is locked in."
        });
    };

    if (isEditing) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
            >
                <div className="flex items-center gap-2 mb-2">
                    <ScrollText className="w-5 h-5 text-indigo-500" />
                    <h3 className="font-semibold text-lg">My Pledge</h3>
                </div>
                <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="I am starting this journey because..."
                    className="min-h-[120px] bg-background/50 resize-none text-lg font-handwriting" // Add a handwritten font class if available or just stick to serif?
                />
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                    <Button onClick={handleSave} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                        <Save className="w-4 h-4" />
                        Sign Pledge
                    </Button>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            layoutId="pledge-card"
            className="group relative p-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer"
            onClick={() => setIsEditing(true)}
        >
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600">
                    <PenLine className="w-4 h-4" />
                </Button>
            </div>

            <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                    <ScrollText className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>

                <div className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-amber-800 dark:text-amber-500">
                        My Motivation
                    </h3>
                    <p className="text-xl font-serif italic text-amber-900 dark:text-amber-100 leading-relaxed max-w-md mx-auto">
                        "{text || "Click here to write your pledge..."}"
                    </p>
                </div>

                {text && (
                    <div className="pt-4 border-t border-amber-200 dark:border-amber-900/50 w-full max-w-[200px]">
                        <p className="text-[10px] text-amber-600/60 dark:text-amber-400/60 uppercase tracking-widest">
                            Signed
                        </p>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
