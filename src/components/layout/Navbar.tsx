import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Ambulance, LogOut, User, Bell, Settings, Menu, X, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import NotificationsPanel from '@/components/features/NotificationsPanel';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    fetchUnread();
    const sub = supabase
      .channel('notifications_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, fetchUnread)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [user]);

  const fetchUnread = async () => {
    if (!user) return;
    const { count } = await supabase
      .from('notifications').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('is_read', false);
    setUnreadCount(count || 0);
  };

  const handleSignOut = async () => { await signOut(); navigate('/'); };
  const dashLink = profile ? `/${profile.role}` : '/';

  return (
    <>
      <nav className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-sm border-b border-gray-100 dark:border-gray-800'
          : 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="relative">
                <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center shadow-md shadow-red-200 dark:shadow-red-900/30 group-hover:shadow-lg transition-shadow">
                  <Ambulance className="h-5 w-5 text-white" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse" />
              </div>
              <span className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Ambu<span className="text-red-600">Flow</span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <>
                  {profile?.role === 'user' && (
                    <Link to="/booking">
                      <Button size="sm" className="rounded-xl h-9 px-4 text-sm font-semibold shadow-sm shadow-red-200 dark:shadow-red-900/20 hover:shadow-md transition-all hover:-translate-y-px active:scale-[0.98]">
                        <Zap className="h-3.5 w-3.5 mr-1.5" /> Book Now
                      </Button>
                    </Link>
                  )}
                  <Link to={dashLink}>
                    <Button variant="ghost" size="sm" className="rounded-xl h-9 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800">
                      Dashboard
                    </Button>
                  </Link>

                  <button
                    onClick={() => setShowNotifications(true)}
                    className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <AnimatePresence>
                      {unreadCount > 0 && (
                        <motion.span
                          initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                          className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center"
                        >
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>

                  <Link to="/profile">
                    <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-800">
                      <Settings className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </Button>
                  </Link>

                  <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700 ml-1">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 flex items-center justify-center">
                      <User className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 max-w-[120px] truncate">{profile?.full_name}</span>
                  </div>

                  <Button variant="ghost" size="sm" onClick={handleSignOut} className="rounded-xl h-9 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <LogOut className="h-4 w-4 mr-1.5" /> Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" size="sm" className="rounded-xl h-9 text-sm font-medium">Login</Button>
                  </Link>
                  <Link to="/register">
                    <Button size="sm" className="rounded-xl h-9 px-5 text-sm font-semibold shadow-sm shadow-red-200 dark:shadow-red-900/20 hover:shadow-md transition-all hover:-translate-y-px active:scale-[0.98]">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile toggle */}
            <button
              className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              onClick={() => setMobileOpen(v => !v)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden"
            >
              <div className="px-4 py-4 space-y-2">
                {user ? (
                  <>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl mb-3">
                      <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <User className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{profile?.full_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{profile?.role}</p>
                      </div>
                    </div>
                    {profile?.role === 'user' && (
                      <Link to="/booking" className="flex items-center gap-3 p-3 rounded-xl bg-red-600 text-white font-semibold text-sm">
                        <Zap className="h-4 w-4" /> Book Ambulance
                      </Link>
                    )}
                    <Link to={dashLink} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors">
                      Dashboard
                    </Link>
                    <Link to="/profile" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors">
                      <Settings className="h-4 w-4" /> Settings
                    </Link>
                    <button onClick={handleSignOut} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 text-sm font-medium transition-colors">
                      <LogOut className="h-4 w-4" /> Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="block p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium">Login</Link>
                    <Link to="/register" className="block p-3 rounded-xl bg-red-600 text-white text-sm font-semibold text-center">Get Started</Link>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <NotificationsPanel isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
    </>
  );
}
