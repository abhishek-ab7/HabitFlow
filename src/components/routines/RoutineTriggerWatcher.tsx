'use client';

import { useEffect } from 'react';
import { useRoutineStore } from '@/lib/stores/routine-store';
import { getCurrentPosition, calculateDistance, parseCoordinates } from '@/lib/location';
import { toast } from 'sonner';
import { Play } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

export function RoutineTriggerWatcher() {
    const { routines } = useRoutineStore();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (typeof window === 'undefined' || !navigator.geolocation) return;

        const checkLocation = async () => {
            try {
                const position = await getCurrentPosition();

                routines.forEach(routine => {
                    if (routine.triggerType === 'location' && routine.triggerValue && !routine.isActive) {
                        const targetCoords = parseCoordinates(routine.triggerValue);

                        if (targetCoords) {
                            const distance = calculateDistance(position, targetCoords);
                            // If within 100 meters
                            if (distance < 100) {
                                toast(`Arrived at location`, {
                                    description: `Start "${routine.title}" routine?`,
                                    action: {
                                        label: 'Start',
                                        onClick: () => {
                                            router.push(`/routines?play=${routine.id}`);
                                        }
                                    },
                                    duration: 10000,
                                });
                            }
                        }
                    }
                });
            } catch (e) {
                // ignore errors
            }
        };

        // Check on mount (after 2s delay)
        const initialTimeout = setTimeout(checkLocation, 2000);

        // Check every 5 minutes
        const intervalId = setInterval(checkLocation, 5 * 60 * 1000);

        return () => {
            clearInterval(intervalId);
            clearTimeout(initialTimeout);
        };
    }, [routines, router]);

    return null;
}
