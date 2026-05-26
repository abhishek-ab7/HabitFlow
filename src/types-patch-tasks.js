const fs = require('fs');

const path = 'src/lib/types.ts';
let content = fs.readFileSync(path, 'utf8');

if(!content.includes('recurrenceRule?: string;')) {
    // Add missing fields to Task and TaskFormData
    content = content.replace('export interface Task {', 'export interface Task {\n  recurrenceRule?: string;\n  estimatedTime?: number;\n  actualTime?: number;\n  isUrgent?: boolean;\n  isImportant?: boolean;');
    content = content.replace('export interface TaskFormData {', 'export interface TaskFormData {\n  recurrenceRule?: string;\n  estimatedTime?: number;\n  actualTime?: number;\n  isUrgent?: boolean;\n  isImportant?: boolean;');
    fs.writeFileSync(path, content, 'utf8');
}
