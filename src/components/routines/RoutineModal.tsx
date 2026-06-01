"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useRoutineStore } from "@/lib/stores/routine-store"
import { useHabitStore } from "@/lib/stores/habit-store"
import { Routine } from "@/lib/types"
import { Loader2, MapPin, Clock, Play, CheckCircle2, X, Plus, Sparkles, Layers } from "lucide-react"
import { toast } from "sonner"
import { getCurrentPosition } from "@/lib/location"
import { cn } from "@/lib/utils"

interface RoutineModalProps {
    isOpen: boolean
    onClose: () => void
    routine?: Routine | null
}

export function RoutineModal({ isOpen, onClose, routine }: RoutineModalProps) {
    const { addRoutine, updateRoutine, getRoutineHabits, linkHabit, unlinkHabit } = useRoutineStore()
    const { habits, loadHabits } = useHabitStore()
    const [loading, setLoading] = useState(false)
    const [loadingHabits, setLoadingHabits] = useState(false)
    const [formData, setFormData] = useState<Partial<Routine>>({
        title: '',
        description: '',
        triggerType: 'manual',
        triggerValue: '',
    })

    const [selectedHabitIds, setSelectedHabitIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            loadHabits().catch(err => {
                console.error('Failed to load habits:', err);
                toast.error('Failed to load habits');
            });
        }
    }, [isOpen, loadHabits]);

    useEffect(() => {
        if (routine && isOpen) {
            setFormData({
                title: routine.title,
                description: routine.description || '',
                triggerType: routine.triggerType,
                triggerValue: routine.triggerValue || '',
            })
            setLoadingHabits(true)
            getRoutineHabits(routine.id).then(routineHabits => {
                setSelectedHabitIds(new Set(routineHabits.map(h => h.id)));
                setLoadingHabits(false)
            }).catch(err => {
                console.error('Failed to load routine habits:', err);
                toast.error('Failed to load routine habits');
                setLoadingHabits(false)
            });
        } else if (!routine && isOpen) {
            setFormData({
                title: '',
                description: '',
                triggerType: 'manual',
                triggerValue: '',
            })
            setSelectedHabitIds(new Set());
        }
    }, [routine, isOpen, getRoutineHabits]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.title) {
            toast.error('Please enter a routine title');
            return;
        }

        setLoading(true)
        try {
            let routineId = routine?.id;

            if (routine) {
                await updateRoutine(routine.id, formData)
                routineId = routine.id;
                toast.success("Routine updated")
            } else {
                const newRoutine = await addRoutine(formData)
                routineId = newRoutine.id;
                toast.success("Routine created")
            }

            if (routineId) {
                try {
                    const currentHabits = await getRoutineHabits(routineId);
                    const currentHabitIds = new Set(currentHabits.map(h => h.id));
                    const selectedSet = selectedHabitIds;

                    const linkPromises = [];
                    for (const habitId of Array.from(selectedSet)) {
                        if (!currentHabitIds.has(habitId)) {
                            linkPromises.push(linkHabit(habitId, routineId));
                        }
                    }
                    await Promise.all(linkPromises);

                    const unlinkPromises = [];
                    for (const habitId of Array.from(currentHabitIds)) {
                        if (!selectedSet.has(habitId)) {
                            unlinkPromises.push(unlinkHabit(habitId, routineId));
                        }
                    }
                    await Promise.all(unlinkPromises);

                } catch (linkError) {
                    console.error('Error linking habits:', linkError);
                    toast.error('Routine saved but failed to link some habits');
                }
            }

            onClose()
        } catch (error) {
            toast.error("Failed to save routine: " + (error instanceof Error ? error.message : 'Unknown error'))
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const activeHabits = habits.filter(h => !h.archived);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent showCloseButton={false} className="sm:max-w-[600px] w-full max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.35)] !rounded-[32px] gap-0">

                {/* Header with Solid Background */}
                <div className="relative p-6 shrink-0 border-b border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/10">
                    <div className="absolute top-5 right-5">
                        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-slate-200/50 dark:hover:bg-zinc-800 text-muted-foreground hover:text-foreground">
                            <X className="w-4.5 h-4.5" />
                        </Button>
                    </div>

                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            {routine ? "Edit Routine" : "Design New Routine"}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground font-medium">
                            {routine ? "Fine-tune your habit sequence." : "Chain habits together to build powerful momentum."}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Form Wrapper */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
                    {/* Scrollable Fields */}
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                        
                        {/* Section 1: Essentials */}
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="title" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 pl-0.5">Name</Label>
                                <Input
                                    id="title"
                                    placeholder="e.g. Morning Focus Protocol"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    required
                                    className="h-11 text-base bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 focus:border-indigo-500/50 focus:ring-indigo-500/20 rounded-xl transition-all text-slate-900 dark:text-slate-100"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 pl-0.5">Purpose</Label>
                                <Textarea
                                    id="description"
                                    placeholder="What is the goal of this routine?"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="resize-none h-20 text-sm bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 focus:border-indigo-500/50 focus:ring-indigo-500/20 rounded-xl transition-all text-slate-900 dark:text-slate-100"
                                />
                            </div>
                        </div>

                        {/* Section 2: Trigger */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 pl-0.5">Activation Trigger</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Select
                                    value={formData.triggerType}
                                    onValueChange={(val: any) => setFormData({ ...formData, triggerType: val })}
                                >
                                    <SelectTrigger className="h-10 bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-slate-100 text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="manual">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Play className="w-3.5 h-3.5 text-orange-500" />
                                                <span>Manual Start</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="time">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Clock className="w-3.5 h-3.5 text-blue-500" />
                                                <span>Time of Day</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="location">
                                            <div className="flex items-center gap-2 text-sm">
                                                <MapPin className="w-3.5 h-3.5 text-purple-500" />
                                                <span>Location</span>
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>

                                {formData.triggerType === 'time' && (
                                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="w-full">
                                        <Input
                                            type="time"
                                            value={formData.triggerValue}
                                            onChange={(e) => setFormData({ ...formData, triggerValue: e.target.value })}
                                            required
                                            className="h-10 bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 rounded-xl text-sm"
                                        />
                                    </motion.div>
                                )}
                            </div>

                            {formData.triggerType === 'location' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mt-1.5 p-3 bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs text-purple-600 dark:text-purple-300">Target Coordinates</Label>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={async () => {
                                                try {
                                                    const pos = await getCurrentPosition();
                                                    setFormData({
                                                        ...formData,
                                                        triggerValue: `${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}`
                                                    });
                                                    toast.success("Location captured");
                                                } catch (e) {
                                                    toast.error("Could not get location");
                                                }
                                            }}
                                            className="h-7 text-[10px] bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-300"
                                        >
                                            <MapPin className="w-3 h-3 mr-1" />
                                            Use Current Location
                                        </Button>
                                    </div>
                                    <Input
                                        placeholder="lat, lng"
                                        value={formData.triggerValue}
                                        onChange={(e) => setFormData({ ...formData, triggerValue: e.target.value })}
                                        required
                                        className="h-9 text-xs bg-slate-50 dark:bg-zinc-900 border-purple-500/20 text-slate-900 dark:text-purple-100 placeholder:text-purple-300/30"
                                    />
                                </motion.div>
                            )}
                        </div>

                        {/* Section 3: Habit Stack */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between px-0.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Habit Stack</Label>
                                <span className="text-[10px] font-bold text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
                                    {selectedHabitIds.size} selected
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-h-[80px]">
                                {loadingHabits ? (
                                    <div className="col-span-full py-6 flex flex-col items-center justify-center text-muted-foreground">
                                        <Loader2 className="w-6 h-6 animate-spin mb-2 opacity-50" />
                                        <p className="text-xs font-medium">Loading habits...</p>
                                    </div>
                                ) : activeHabits.length === 0 ? (
                                    <div className="col-span-full py-6 flex flex-col items-center justify-center text-muted-foreground bg-muted/5 rounded-xl border border-dashed border-border/50">
                                        <p className="text-xs font-medium">No active habits found</p>
                                        <p className="text-[10px] mt-0.5 opacity-70">Create some habits first to build a routine</p>
                                    </div>
                                ) : (
                                    activeHabits.map((habit) => {
                                        const isSelected = selectedHabitIds.has(habit.id);
                                        return (
                                            <motion.div
                                                key={habit.id}
                                                whileHover={{ scale: 1.01, backgroundColor: "rgba(99, 102, 241, 0.03)" }}
                                                whileTap={{ scale: 0.99 }}
                                                onClick={() => {
                                                    const newSet = new Set(Array.from(selectedHabitIds));
                                                    if (isSelected) newSet.delete(habit.id);
                                                    else newSet.add(habit.id);
                                                    setSelectedHabitIds(newSet);
                                                }}
                                                className={cn(
                                                    "cursor-pointer relative flex items-center gap-2.5 p-2 rounded-xl border transition-all duration-200 group",
                                                    isSelected
                                                        ? "bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_12px_-5px_rgba(99,102,241,0.3)]"
                                                        : "bg-slate-50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-8 h-8 rounded-lg flex items-center justify-center text-base shadow-inner transition-colors",
                                                    isSelected ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "bg-slate-100 dark:bg-black/20 group-hover:bg-slate-200/85 dark:group-hover:bg-black/30"
                                                )}>
                                                    {(!habit.icon || habit.icon === '✓') ? '📝' : habit.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={cn(
                                                        "text-xs font-semibold truncate transition-colors",
                                                        isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white"
                                                    )}>
                                                        {habit.name}
                                                    </p>
                                                </div>
                                                <div className={cn(
                                                    "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                                                    isSelected
                                                        ? "bg-indigo-500 border-indigo-500 scale-100"
                                                        : "border-slate-300 dark:border-zinc-700 scale-90 opacity-60 group-hover:opacity-100"
                                                )}>
                                                    {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                </div>
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer - Solid & Positioned Correctly */}
                    <div className="p-4 flex justify-end gap-2 border-t border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/30 shrink-0">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            className="h-10 px-4 rounded-xl hover:bg-slate-200/50 dark:hover:bg-zinc-800 text-muted-foreground hover:text-foreground text-sm transition-colors"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !formData.title}
                            className={cn(
                                "h-10 px-6 rounded-xl font-bold shadow-md transition-all duration-300",
                                "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500",
                                "text-white border-0 shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.01] active:scale-[0.99]",
                                "disabled:opacity-50 disabled:pointer-events-none text-sm"
                            )}
                        >
                            {loading ? <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" /> : <SaveIcon routine={routine} />}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function SaveIcon({ routine }: { routine?: Routine | null }) {
    return (
        <div className="flex items-center gap-2">
            <span>{routine ? "Save Changes" : "Create Routine"}</span>
        </div>
    )
}
