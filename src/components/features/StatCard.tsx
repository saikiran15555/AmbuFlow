import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  subtitle?: string;
  onClick?: () => void;
}

export default function StatCard({ title, value, icon: Icon, iconColor = 'text-blue-600', subtitle, onClick }: StatCardProps) {
  const bgColor = iconColor.replace('text-', 'bg-').replace('-600', '-100');
  
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-white rounded-lg shadow-sm p-6 text-left hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`${bgColor} rounded-full p-3 flex-shrink-0`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
      </div>
    </button>
  );
}
