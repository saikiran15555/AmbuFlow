import { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  border?: string;
  subtitle?: string;
  trend?: string;
  onClick?: () => void;
  delay?: number;
}

export default function StatCard({
  title, value, icon: Icon,
  iconBg = 'bg-blue-50 dark:bg-blue-900/20',
  iconColor = 'text-blue-600 dark:text-blue-400',
  border = 'border-blue-100 dark:border-blue-800',
  subtitle, trend, onClick, delay = 0,
}: StatCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      whileHover={{ y: -2 }}
      className={`w-full bg-white dark:bg-gray-800 rounded-2xl border ${border} shadow-sm p-5 text-left transition-shadow hover:shadow-md cursor-pointer group`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${iconBg} group-hover:scale-110 transition-transform`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        {onClick && (
          <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors mt-1" />
        )}
      </div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
      <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{value}</p>
      {(subtitle || trend) && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">{trend || subtitle}</p>
      )}
    </motion.button>
  );
}
