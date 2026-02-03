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
            <DialogContent showCloseButton={false} className="sm:max-w-[600px] flex flex-col h-[85vh] md:h-auto md:max-h-[85vh] p-0 overflow-hidden bg-background/60 backdrop-blur-2xl border-white/10 dark:border-white/5 shadow-2xl ring-1 ring-white/20 dark:ring-white/10 !rounded-3xl gap-0">

                {/* Header with Gradient */}
                <div className="relative p-8 pb-6 shrink-0 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
                    <div className="absolute top-4 right-4">
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10 hover:text-foreground">
                            <X className="w-5 h-5 text-muted-foreground" />
                        </Button>
                    </div>

                    <DialogHeader className="space-y-2">
                        <DialogTitle className="text-3xl font-bold tracking-tight text-foreground">
                            {routine ? "Edit Routine" : "Design New Routine"}
                        </DialogTitle>
                        <DialogDescription className="text-base text-muted-foreground font-medium">
                            {routine ? "Fine-tune your habit sequence." : "Chain habits together to build powerful momentum."}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Main Content Area with Custom Scrollbar */}
                <ScrollArea className="h-[60vh] w-full">
                    <form id="routine-form" onSubmit={handleSubmit} className="px-8 py-6 pb-44 space-y-8">

                        {/* Section 1: Essentials */}
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="title" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground pl-1">Name</Label>
                                <Input
                                    id="title"
                                    placeholder="e.g. Morning Focus Protocol"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    required
                                    className="h-14 text-lg bg-white/5 border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/20 rounded-xl transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground pl-1">Purpose</Label>
                                <Textarea
                                    id="description"
                                    placeholder="What is the goal of this routine?"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="resize-none h-24 bg-white/5 border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/20 rounded-xl transition-all"
                                />
                            </div>
                        </div>

                        {/* Section 2: Trigger */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground pl-1">Activation Trigger</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Select
                                    value={formData.triggerType}
                                    onValueChange={(val: any) => setFormData({ ...formData, triggerType: val })}
                                >
                                    <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="manual">
                                            <div className="flex items-center gap-2">
                                                <Play className="w-4 h-4 text-orange-500" />
                                                <span>Manual Start</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="time">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-blue-500" />
                                                <span>Time of Day</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="location">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-purple-500" />
                                                <span>Location</span>
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>

                                {formData.triggerType === 'time' && (
                                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                                        <Input
                                            type="time"
                                            value={formData.triggerValue}
                                            onChange={(e) => setFormData({ ...formData, triggerValue: e.target.value })}
                                            required
                                            className="h-12 bg-white/5 border-white/10 rounded-xl"
                                        />
                                    </motion.div>
                                )}
                            </div>

                            {formData.triggerType === 'location' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mt-2 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <Label className="text-purple-300">Target Coordinates</Label>
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
                                            className="h-8 text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-300"
                                        >
                                            <MapPin className="w-3 h-3 mr-1.5" />
                                            Use Current Location
                                        </Button>
                                    </div>
                                    <Input
                                        placeholder="lat, lng"
                                        value={formData.triggerValue}
                                        onChange={(e) => setFormData({ ...formData, triggerValue: e.target.value })}
                                        required
                                        className="h-10 bg-black/20 border-purple-500/30 text-purple-100 placeholder:text-purple-300/30"
                                    />
                                </motion.div>
                            )}
                        </div>

                        {/* Section 3: Habit Stack */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Habit Stack</Label>
                                <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
                                    {selectedHabitIds.size} selected
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-[100px]">
                                {loadingHabits ? (
                                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground">
                                        <Loader2 className="w-8 h-8 animate-spin mb-3 opacity-50" />
                                        <p className="text-sm font-medium">Loading habits...</p>
                                    </div>
                                ) : activeHabits.length === 0 ? (
                                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-muted/5 rounded-xl border border-dashed border-border/50">
                                        <p className="text-sm font-medium">No active habits found</p>
                                        <p className="text-xs mt-1 opacity-70">Create some habits first to build a routine</p>
                                    </div>
                                ) : (
                                    activeHabits.map((habit) => {
                                        const isSelected = selectedHabitIds.has(habit.id);
                                        return (
                                            <motion.div
                                                key={habit.id}
                                                whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.08)" }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => {
                                                    const newSet = new Set(Array.from(selectedHabitIds));
                                                    if (isSelected) newSet.delete(habit.id);
                                                    else newSet.add(habit.id);
                                                    setSelectedHabitIds(newSet);
                                                }}
                                                className={cn(
                                                    "cursor-pointer relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 group",
                                                    isSelected
                                                        ? "bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_15px_-5px_hsl(var(--primary)/0.3)]"
                                                        : "bg-white/5 border-white/5 hover:border-white/20"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-inner transition-colors",
                                                    isSelected ? "bg-indigo-500/20" : "bg-black/20 group-hover:bg-black/30"
                                                )}>
                                                    {habit.icon || '📝'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={cn(
                                                        "font-medium truncate transition-colors",
                                                        isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white"
                                                    )}>
                                                        {habit.name}
                                                    </p>
                                                </div>
                                                <div className={cn(
                                                    "w-5 h-5 rounded-full border flex items-center justify-center transition-all",
                                                    isSelected
                                                        ? "bg-indigo-500 border-indigo-500 scale-100"
                                                        : "border-white/20 scale-90 opacity-50 group-hover:opacity-100"
                                                )}>
                                                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                                </div>
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                    </form>
                </ScrollArea>

                {/* Footer */}
                <div className="absolute bottom-0 left-0 right-0 p-8 pt-20 bg-gradient-to-t from-background via-background/95 to-transparent flex justify-end gap-3 z-20 pointer-events-none">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        className="pointer-events-auto h-12 px-6 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="routine-form"
                        disabled={loading || !formData.title}
                        className={cn(
                            "pointer-events-auto h-12 px-8 rounded-xl font-semibold shadow-lg transition-all duration-300",
                            "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500",
                            "text-white border-0 shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]",
                            "disabled:opacity-50 disabled:pointer-events-none"
                        )}
                    >
                        {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <SaveIcon routine={routine} />}
                    </Button>
                </div>
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
