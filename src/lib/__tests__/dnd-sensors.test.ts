import { describe, it, expect } from 'vitest';
import { SmartPointerSensor } from '../dnd-sensors';

describe('SmartPointerSensor', () => {
  it('should have activators defined', () => {
    expect(SmartPointerSensor.activators).toBeDefined();
    expect(SmartPointerSensor.activators.length).toBe(1);
    expect(SmartPointerSensor.activators[0].eventName).toBe('onPointerDown');
  });

  it('should only activate for mouse events and ignore touch events', () => {
    const handler = SmartPointerSensor.activators[0].handler;

    // Simulate pointer events
    const mouseEvent = {
      nativeEvent: {
        pointerType: 'mouse',
      },
    } as any;

    const touchEvent = {
      nativeEvent: {
        pointerType: 'touch',
      },
    } as any;

    const penEvent = {
      nativeEvent: {
        pointerType: 'pen',
      },
    } as any;

    const unknownEvent = {
      nativeEvent: {},
    } as any;

    expect(handler(mouseEvent)).toBe(true);
    expect(handler(touchEvent)).toBe(false);
    expect(handler(penEvent)).toBe(false);
    expect(handler(unknownEvent)).toBe(false);
  });
});
