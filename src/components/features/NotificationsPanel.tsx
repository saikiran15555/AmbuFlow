import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Notification } from '@/types';
import { formatDate } from '@/lib/utils';
import { Bell, CheckCheck, X } from 'lucide-react';
import { toast } from 'sonner';

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationsPanel({ isOpen, onClose }: NotificationsPanelProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && user) {
      fetchNotifications();
      
      const subscription = supabase
        .channel('notifications_realtime')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, () => {
          fetchNotifications();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [isOpen, user]);

  const fetchNotifications = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setNotifications(data);
    }
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      toast.error('Failed to mark all as read');
    } else {
      toast.success('All notifications marked as read');
      fetchNotifications();
    }
  };

  const getNotificationColor = (type: string) => {
    const colors: Record<string, string> = {
      info: 'bg-blue-50 border-blue-200',
      success: 'bg-green-50 border-green-200',
      warning: 'bg-yellow-50 border-yellow-200',
      error: 'bg-red-50 border-red-200',
    };
    return colors[type] || 'bg-gray-50 border-gray-200';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-primary text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Notifications</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-red-100 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Actions */}
        {notifications.some(n => !n.is_read) && (
          <div className="px-6 py-3 border-b bg-gray-50">
            <button
              onClick={markAllAsRead}
              className="text-sm text-primary hover:text-primary/90 font-medium flex items-center"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all as read
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Bell className="h-12 w-12 mb-3 text-gray-300" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !notification.is_read ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                    {!notification.is_read && (
                      <span className="h-2 w-2 bg-primary rounded-full flex-shrink-0 mt-1.5"></span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                  <p className="text-xs text-gray-500">{formatDate(notification.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
