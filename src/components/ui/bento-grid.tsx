import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface BentoGridProps {
    className?: string;
    children: React.ReactNode;
    autoRows?: boolean;
}

export const BentoGrid = ({ className, children, autoRows = true }: BentoGridProps) => {
    return (
        <div
            className={cn(
                'grid grid-cols-1 md:grid-cols-3 gap-4 max-w-7xl mx-auto',
                autoRows && 'md:auto-rows-[10rem]',
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
    disableHover?: boolean;
}

const BENTO_SPAN_CLASSES: Record<1 | 2 | 3, string> = {
    1: '',
    2: 'md:col-span-2',
    3: 'md:col-span-3',
};

function BentoItemHeader({ icon, title }: { icon?: React.ReactNode; title?: string | React.ReactNode }) {
    if (!icon && !title) return null;
    return (
        <div className="flex items-center gap-3 mb-1.5">
            {icon}
            {title && <div className="font-semibold text-foreground text-base tracking-tight">{title}</div>}
        </div>
    );
}

export const BentoGridItem = ({
    className,
    title,
    description,
    header,
    icon,
    children,
    onClick,
    span = 1,
    disableHover = false
}: BentoGridItemProps) => {
    return (
        <motion.div
            whileHover={disableHover ? undefined : { y: -2 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClick}
            className={cn(
                'surface-card group/bento transition-all duration-200 p-6 row-span-1 shadow-xs',
                !disableHover && 'hover:border-primary/30 hover:shadow-md',
                onClick && 'cursor-pointer',
                BENTO_SPAN_CLASSES[span],
                className
            )}
        >
            {header}
            <div className="h-full flex flex-col">
                <BentoItemHeader icon={icon} title={title} />
                {description && (
                    <div className="font-sans font-normal text-muted-foreground text-sm mb-2">
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
