const fs = require('fs');

const path = 'src/lib/types.ts';
let content = fs.readFileSync(path, 'utf8');

if(!content.includes('HabitFormData')) {
    content += `\nexport interface HabitFormData {\n  name: string;\n  category: Category;\n  targetDaysPerWeek: number;\n  icon?: string;\n  isQuantitative?: boolean;\n  targetValue?: number;\n  unit?: string;\n  difficulty?: 'easy' | 'medium' | 'hard';\n}\n`;
    fs.writeFileSync(path, content, 'utf8');
}
