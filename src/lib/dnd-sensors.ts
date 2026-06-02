import { PointerSensor } from '@dnd-kit/core';

/**
 * Custom PointerSensor that ignores touch events.
 * This is to prevent PointerSensor from intercepting touches on mobile devices,
 * allowing vertical scroll to work natively. Drag and drop on touch devices
 * is handled instead by the TouchSensor (with delay and tolerance).
 */
export class SmartPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent }: { nativeEvent: PointerEvent }) => {
        // Only activate if the pointer type is a mouse.
        // Touch events are ignored to prevent vertical scroll locking.
        return nativeEvent.pointerType === 'mouse';
      },
    },
  ];
}
