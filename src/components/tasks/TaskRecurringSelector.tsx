'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  value?: string;
  onChange: (value: string) => void;
}

export function TaskRecurringSelector({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label>Recurrence (Optional)</Label>
      <Select value={value || 'none'} onValueChange={(val) => onChange(val === 'none' ? '' : val)}>
        <SelectTrigger>
          <SelectValue placeholder="Does not repeat" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Does not repeat</SelectItem>
          <SelectItem value="daily">Daily</SelectItem>
          <SelectItem value="weekly">Weekly</SelectItem>
          <SelectItem value="monthly">Monthly</SelectItem>
          <SelectItem value="weekdays">Weekdays (Mon-Fri)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
