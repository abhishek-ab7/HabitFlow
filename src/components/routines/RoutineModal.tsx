"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Loader2, MapPin } from "lucide-react"
import { toast } from "sonner"
import { getCurrentPosition } from "@/lib/location"

interface RoutineModalProps {
    isOpen: boolean
    onClose: () => void
    routine?: Routine | null
}

export function RoutineModal({ isOpen, onClose, routine }: RoutineModalProps) {
    const { addRoutine, updateRoutine, getRoutineHabits, linkHabit, unlinkHabit } = useRoutineStore()
    const { habits, loadHabits } = useHabitStore()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState<Partial<Routine>>({
        title: '',
        description: '',
        triggerType: 'manual',
        triggerValue: '',
    })

    const [selectedHabitIds, setSelectedHabitIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadHabits();
    }, []); // Only load on mount

    useEffect(() => {
        if (routine && isOpen) {
            setFormData({
                title: routine.title,
                description: routine.description || '',
                triggerType: routine.triggerType,
                triggerValue: routine.triggerValue || '',
            })
            // Pre-select habits that belong to this routine using junction table
            getRoutineHabits(routine.id).then(routineHabits => {
                setSelectedHabitIds(new Set(routineHabits.map(h => h.id)));
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
    }, [routine?.id, isOpen]); // Stabilize dependencies

    const handleHabitToggle = (habitId: string) => {
        const newSet = new Set(Array.from(selectedHabitIds));
        if (newSet.has(habitId)) {
            newSet.delete(habitId);
        } else {
            newSet.add(habitId);
        }
        setSelectedHabitIds(newSet);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.title) return

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

            // Update habit-routine links using junction table
            if (routineId) {
                // Get current links
                const currentHabits = await getRoutineHabits(routineId);
                const currentHabitIds = new Set(currentHabits.map(h => h.id));
                const selectedSet = selectedHabitIds;

                // Link newly selected habits
                for (const habitId of Array.from(selectedSet)) {
                    if (!currentHabitIds.has(habitId)) {
                        await linkHabit(habitId, routineId);
                    }
                }

                // Unlink deselected habits
                for (const habitId of Array.from(currentHabitIds)) {
                    if (!selectedSet.has(habitId)) {
                        await unlinkHabit(habitId, routineId);
                    }
                }
            }

            onClose()
        } catch (error) {
            toast.error("Failed to save routine")
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    // Filter out archived habits for selection
    const activeHabits = habits.filter(h => !h.archived);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent showCloseButton={true} className="sm:max-w-[500px] flex flex-col h-[85vh] p-0 overflow-hidden bg-background/80 backdrop-blur-xl border-border/40 shadow-2xl ring-1 ring-white/10">
                <DialogHeader className="p-6 pb-2 shrink-0 border-b border-border/10 bg-muted/5">
                    <DialogTitle className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                        {routine ? "Edit Routine" : "Create New Routine"}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        {routine ? "Modify your routine settings and habits." : "Set up a new sequence of habits to follow."}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-6 pt-2">
                    <form id="routine-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-3">
                            <Label htmlFor="title" className="text-base">Title</Label>
                            <Input
                                id="title"
                                placeholder="e.g. Morning Focus"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                required
                                className="h-12 text-lg"
                            />
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Textarea
                                id="description"
                                placeholder="What is this routine for?"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="resize-none h-24"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="triggerType">Trigger Type</Label>
                                <Select
                                    value={formData.triggerType}
                                    onValueChange={(val: any) => setFormData({ ...formData, triggerType: val })}
                                >
                                    <SelectTrigger className="h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="manual">Manual Start</SelectItem>
                                        <SelectItem value="time">Time of Day</SelectItem>
                                        <SelectItem value="location">Location</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {formData.triggerType === 'time' && (
                                <div className="space-y-2">
                                    <Label htmlFor="triggerValue">At Time</Label>
                                    <Input
                                        id="triggerValue"
                                        type="time"
                                        value={formData.triggerValue}
                                        onChange={(e) => setFormData({ ...formData, triggerValue: e.target.value })}
                                        required
                                        className="h-10"
                                    />
                                </div>
                            )}
                        </div>

                        {formData.triggerType === 'location' && (
                            <div className="space-y-2 bg-muted/30 p-3 rounded-lg border border-border/50">
                                <Label htmlFor="triggerValue">Location Coordinates</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="triggerValue"
                                        placeholder="lat, lng"
                                        value={formData.triggerValue}
                                        onChange={(e) => setFormData({ ...formData, triggerValue: e.target.value })}
                                        required
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
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
                                        title="Use Current Location"
                                    >
                                        <MapPin className="h-4 w-4" />
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Click map pin to use current location.
                                </p>
                            </div>
                        )}

                        <div className="space-y-3 pt-2">
                            <Label className="text-base">Included Habits</Label>
                            <div className="border rounded-xl p-1 bg-muted/20 space-y-1 max-h-60 overflow-y-auto">
                                {activeHabits.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground">
                                        <p>No active habits found.</p>
                                        <p className="text-xs mt-1">Create a habit first to add it here.</p>
                                    </div>
                                ) : (
                                    activeHabits.map((habit) => (
                                        <div
                                            key={habit.id}
                                            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                                            onClick={() => handleHabitToggle(habit.id)}
                                        >
                                            <Checkbox
                                                id={`habit-${habit.id}`}
                                                checked={selectedHabitIds.has(habit.id)}
                                                onCheckedChange={() => handleHabitToggle(habit.id)}
                                            />
                                            <label
                                                htmlFor={`habit-${habit.id}`}
                                                className="text-sm font-medium leading-none cursor-pointer flex-1 flex items-center gap-2"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <span className="text-xl bg-background rounded-md w-8 h-8 flex items-center justify-center border shadow-sm">
                                                    {habit.icon || '📝'}
                                                </span>
                                                {habit.name}
                                            </label>
                                        </div>
                                    ))
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground px-1">
                                These habits will be played in sequence.
                            </p>
                        </div>
                    </form>
                </div>
                <div className="p-6 border-t border-border/10 bg-muted/30 flex justify-end gap-3 shrink-0 backdrop-blur-sm">
                    <Button type="button" variant="ghost" onClick={onClose} className="h-11 px-6 hover:bg-background/80 transition-all">
                        Cancel
                    </Button>
                    <Button type="submit" form="routine-form" disabled={loading || !formData.title} className="h-11 px-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 border-none transform transition-all active:scale-95">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {routine ? "Update Routine" : "Launch Routine"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog >
    )
}
