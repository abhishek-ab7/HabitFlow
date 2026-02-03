import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface BentoGridProps {
    className?: string;
    children: React.ReactNode;
}

export const BentoGrid = ({ className, children }: BentoGridProps) => {
    return (
        <div
            className={cn(
                'grid md:auto-rows-[10rem] grid-cols-1 md:grid-cols-3 gap-4 max-w-7xl mx-auto',
                className
            )}
        >
            {children}
        </div>
    );
};

interface BentoGridItemProps {
    className?: string;
    title?: string | React.ReactNode;
    description?: string | React.ReactNode;
    header?: React.ReactNode;
    icon?: React.ReactNode;
    children?: React.ReactNode;
    onClick?: () => void;
    span?: 1 | 2 | 3;
}

export const BentoGridItem = ({
    className,
    title,
    description,
    header,
    icon,
    children,
    onClick,
    span = 1
}: BentoGridItemProps) => {
    return (
        <motion.div
            whileHover={{ y: -5, scale: 1.01 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClick}
            className={cn(
                'rounded-3xl group/bento hover:shadow-2xl transition duration-200 shadow-input dark:shadow-none p-6 row-span-1',
                // Premium Glass Styles
                'bg-white/40 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-white/10',
                'hover:bg-white/50 dark:hover:bg-black/30',
                onClick && 'cursor-pointer',
                span === 2 && 'md:col-span-2',
                span === 3 && 'md:col-span-3',
                className
            )}
        >
            {header}
            <div className="group-hover/bento:translate-x-2 transition duration-200 h-full flex flex-col">
                {(icon || title) && (
                    <div className="flex items-center gap-3 mb-2">
                        {icon}
                        {title && <div className="font-bold text-neutral-800 dark:text-neutral-100 text-lg">{title}</div>}
                    </div>
                )}
                {description && (
                    <div className="font-sans font-normal text-neutral-600 text-sm dark:text-neutral-400 mb-2">
                        {description}
                    </div>
                )}
                <div className="flex-1">
                    {children}
                </div>
            </div>
        </motion.div>
    );
};
