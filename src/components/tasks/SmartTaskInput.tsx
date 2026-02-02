import { useState, useRef, useEffect } from 'react';
import * as chrono from 'chrono-node';
import { Calendar, Plus, X, Loader2, Mic } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

interface SmartTaskInputProps {
    onAddTask: (task: { title: string; dueDate?: Date; tags?: string[] }) => Promise<void>;
    placeholder?: string;
    className?: string;
}

export function SmartTaskInput({ onAddTask, placeholder = "Add a task... (e.g., 'Buy milk tomorrow at 5pm')", className }: SmartTaskInputProps) {
    const [inputValue, setInputValue] = useState('');
    const [parsedDate, setParsedDate] = useState<Date | null>(null);
    const [dateText, setDateText] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // NLP Parsing
    useEffect(() => {
        if (!inputValue) {
            setParsedDate(null);
            setDateText(null);
            return;
        }

        const results = chrono.parse(inputValue);
        if (results.length > 0) {
            const result = results[0];
            setParsedDate(result.start.date());
            setDateText(result.text);
        } else {
            setParsedDate(null);
            setDateText(null);
        }
    }, [inputValue]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            // Remove the date text from the title if it exists
            let title = inputValue;
            if (dateText && parsedDate) {
                title = inputValue.replace(dateText, '').replace(/\s+/, ' ').trim();
            }

            await onAddTask({
                title,
                dueDate: parsedDate || undefined,
            });

            setInputValue('');
            setParsedDate(null);
            setDateText(null);
        } catch (error) {
            console.error('Failed to add task:', error);
        } finally {
            setIsSubmitting(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    // Voice Input (Web Speech API)
    const toggleVoiceInput = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Voice recognition is not supported in this browser.');
            return;
        }

        if (isListening) {
            // Stop listening logic would go here if we had a persistent recognizer reference
            // But for simplicity/one-shot:
            setIsListening(false);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInputValue(prev => (prev ? `${prev} ${transcript}` : transcript));
            // Auto-focus input after voice
            inputRef.current?.focus();
        };

        recognition.start();
    };

    return (
        <div className={cn("relative group", className)}>
            <div className="relative flex items-center">
                <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isListening ? "Listening..." : placeholder}
                    className={cn(
                        "pr-24 pl-4 py-6 text-base shadow-sm border-indigo-200 focus-visible:ring-indigo-500",
                        isListening && "ring-2 ring-red-500 border-red-500 placeholder:text-red-500 animate-pulse"
                    )}
                    disabled={isSubmitting}
                />

                <div className="absolute right-2 flex items-center gap-1">
                    {/* Voice Button */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={toggleVoiceInput}
                        className={cn(
                            "h-8 w-8 text-muted-foreground transition-colors",
                            isListening ? "text-red-500 bg-red-100 dark:bg-red-950" : "hover:text-indigo-600"
                        )}
                    >
                        <Mic className={cn("w-4 h-4", isListening && "animate-bounce")} />
                    </Button>

                    {/* Submit Button */}
                    <Button
                        size="icon"
                        className="h-8 w-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full"
                        onClick={() => handleSubmit()}
                        disabled={!inputValue.trim() || isSubmitting}
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-5 h-5" />}
                    </Button>
                </div>
            </div>

            {/* NLP Preview Date Badge */}
            <AnimatePresence>
                {parsedDate && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute -bottom-8 left-2 z-10"
                    >
                        <Badge variant="outline" className="bg-background/95 backdrop-blur shadow-sm border-indigo-200 text-indigo-700 flex items-center gap-1.5 px-3 py-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span className="font-medium">Due: {format(parsedDate, 'PPP p')}</span>
                            <button
                                onClick={() => {
                                    setParsedDate(null);
                                    setDateText(null);
                                }}
                                className="ml-1 hover:text-red-500"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </Badge>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
