import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Ambulance, LogOut, User, Bell, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import NotificationsPanel from '@/components/features/NotificationsPanel';

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUnreadNotifications();
      
      const subscription = supabase
        .channel('notifications_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, () => {
          fetchUnreadNotifications();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchUnreadNotifications = async () => {
    if (!user) return;
    
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    
    setUnreadCount(count || 0);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getDashboardLink = () => {
    if (!profile) return '/';
    return `/${profile.role}`;
  };

  return (
    <>
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <Ambulance className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-gray-900">AmbuFlow</span>
            </Link>

            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <Link to={getDashboardLink()}>
                    <Button variant="ghost" size="sm">
                      Dashboard
                    </Button>
                  </Link>
                  
                  <button
                    onClick={() => setShowNotifications(true)}
                    className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Bell className="h-5 w-5 text-gray-600" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  <Link to="/profile">
                    <Button variant="ghost" size="icon">
                      <Settings className="h-5 w-5" />
                    </Button>
                  </Link>

                  <div className="flex items-center space-x-2">
                    <User className="h-5 w-5 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{profile?.full_name}</span>
                  </div>

                  <Button variant="ghost" size="sm" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" size="sm">Login</Button>
                  </Link>
                  <Link to="/register">
                    <Button size="sm">Register</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <NotificationsPanel 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)} 
      />
    </>
  );
}
