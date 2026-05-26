import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  value?: 'easy' | 'medium' | 'hard';
  onChange: (value: 'easy' | 'medium' | 'hard') => void;
}

export function HabitDifficultySelector({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label>Difficulty (Gamification)</Label>
      <Select value={value || 'medium'} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select difficulty" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="easy">Easy</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="hard">Hard</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
