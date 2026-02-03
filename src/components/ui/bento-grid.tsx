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
            whileHover={{ y: -5 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClick}
            className={cn(
                'row-span-1 rounded-3xl group/bento hover:shadow-2xl transition duration-200 shadow-input dark:shadow-none p-4 dark:bg-black/40 dark:border-white/10 bg-white border border-transparent justify-between flex flex-col space-y-4 backdrop-blur-xl',
                onClick && 'cursor-pointer',
                span === 2 && 'md:col-span-2',
                span === 3 && 'md:col-span-3',
                className
            )}
        >
            {header}
            <div className="group-hover/bento:translate-x-2 transition duration-200">
                <div className="flex items-center gap-2 mb-2">
                    {icon}
                    {title && <div className="font-bold text-neutral-600 dark:text-neutral-200">{title}</div>}
                </div>
                {description && (
                    <div className="font-normal text-neutral-600 text-xs dark:text-neutral-300">
                        {description}
                    </div>
                )}
                {children}
            </div>
        </motion.div>
    );
};
