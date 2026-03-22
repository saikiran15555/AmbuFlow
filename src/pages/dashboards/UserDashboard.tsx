import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Booking } from '@/types';
import { formatDate, getStatusColor } from '@/lib/utils';
import { Ambulance, Activity, CheckCircle, IndianRupee, AlertCircle, MapPin, Zap, Phone, Clock, ChevronRight, Eye, X } from 'lucide-react';
import { toast } from 'sonner';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';

const ACTIVE_STATUSES = ['pending', 'accepted', 'arrived', 'picked_up'];

export default function UserDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, totalSpent: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [emergencyPulsing, setEmergencyPulsing] = useState(false);

  useEffect(() => {
    fetchBookings();
    const sub = supabase.channel('user_bookings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `user_id=eq.${profile?.id}` }, fetchBookings)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [profile?.id]);

  const fetchBookings = async () => {
    if (!profile?.id) return;
    const { data, error } = await supabase
      .from('bookings')
      .select(`*, hospital:hospitals(hospital_name), driver:drivers(full_name, phone)`)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) { toast.error('Failed to fetch bookings'); setLoading(false); return; }
    if (data) {
      setBookings(prev => {
        data.forEach(b => {
          const pb = prev.find(p => p.id === b.id);
          if (pb && pb.status !== b.status) {
            const msgs: Record<string, string> = {
              accepted: '🚑 Ambulance assigned and on the way!',
              arrived: '📍 Ambulance has arrived at your location!',
              picked_up: '🏥 En route to hospital.',
              completed: '✅ Trip completed. Stay safe!',
              cancelled: 'Booking was cancelled.',
            };
            if (msgs[b.status]) toast.info(msgs[b.status], { duration: 6000 });
          }
        });
        return data;
      });
      const completed = data.filter(b => b.status === 'completed');
      const active = data.filter(b => ACTIVE_STATUSES.includes(b.status));
      setStats({ total: data.length, active: active.length, completed: completed.length, totalSpent: completed.reduce((s, b) => s + b.fare, 0) });
    }
    setLoading(false);
  };

  const handleEmergency = () => {
    setEmergencyPulsing(true);
    setTimeout(() => { setEmergencyPulsing(false); navigate('/book?emergency=1'); }, 600);
  };

  const handleTrack = () => {
    const active = bookings.find(b => ACTIVE_STATUSES.includes(b.status));
    if (!active) { toast.info('No active booking to track'); return; }
    navigate(`/track/${active.id}`);
  };

  const handleCancel = async (id: string) => {
    setActionLoadingId(id);
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id).eq('user_id', profile?.id);
    if (error) toast.error('Failed to cancel booking');
    else { toast.success('Booking cancelled'); fetchBookings(); }
    setActionLoadingId(null);
  };

  const activeBooking = bookings.find(b => ACTIVE_STATUSES.includes(b.status));

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full bg-red-100 dark:bg-red-900/20 animate-ping" />
            <div className="relative w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
              <Ambulance className="h-8 w-8 text-white animate-ambulance" />
            </div>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const STATS_DATA = [
    { label: 'Total Bookings', value: stats.total, icon: Ambulance, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400', border: 'border-blue-100 dark:border-blue-800' },
    { label: 'Active Trips', value: stats.active, icon: Activity, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400', border: 'border-amber-100 dark:border-amber-800' },
    { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400', border: 'border-green-100 dark:border-green-800' },
    { label: 'Total Spent', value: `₹${stats.totalSpent}`, icon: IndianRupee, color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400', border: 'border-purple-100 dark:border-purple-800' },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
              Hello, {profile?.full_name?.split(' ')[0]} 👋
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Stay safe. Help is always one tap away.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-full text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Service Active
          </div>
        </div>

        {/* Active booking banner */}
        <AnimatePresence>
          {activeBooking && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl p-5 text-white shadow-lg shadow-red-200 dark:shadow-red-900/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Ambulance className="h-6 w-6 animate-ambulance" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">Active Booking</p>
                    <p className="text-red-100 text-sm capitalize">{activeBooking.status.replace('_', ' ')} • {activeBooking.pickup_location}</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/track/${activeBooking.id}`)}
                  className="flex items-center gap-2 bg-white text-red-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors active:scale-[0.98]"
                >
                  <MapPin className="h-4 w-4" /> Track Live
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Emergency + Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Emergency Button */}
          <motion.button
            onClick={handleEmergency}
            className="relative overflow-hidden bg-gradient-to-br from-red-600 to-red-800 text-white rounded-2xl p-7 text-left shadow-xl shadow-red-200 dark:shadow-red-900/40 hover:shadow-2xl transition-all hover:-translate-y-1 active:scale-[0.97] md:col-span-1"
            animate={emergencyPulsing ? { scale: [1, 0.96, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
              <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-white/5" />
            </div>
            <div className="relative">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                <Zap className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-extrabold mb-1">⚡ Emergency</h3>
              <p className="text-red-100 text-sm">One tap — auto-detect location & dispatch nearest ambulance</p>
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold">
                Tap to activate <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          </motion.button>

          {/* Book Ambulance */}
          <Link
            to="/book"
            className="bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl p-7 hover:border-red-200 dark:hover:border-red-800 hover:shadow-lg transition-all hover:-translate-y-1 active:scale-[0.98] group"
          >
            <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-red-100 dark:group-hover:bg-red-900/30 transition-colors">
              <Ambulance className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Book Ambulance</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Schedule with fixed fare & hospital selection</p>
            <div className="mt-4 flex items-center gap-1 text-red-600 text-sm font-semibold">
              Book now <ChevronRight className="h-4 w-4" />
            </div>
          </Link>

          {/* Track */}
          <button
            onClick={handleTrack}
            className="bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl p-7 text-left hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-lg transition-all hover:-translate-y-1 active:scale-[0.98] group"
          >
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
              <MapPin className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Track Ambulance</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Real-time GPS tracking of your active booking</p>
            <div className="mt-4 flex items-center gap-1 text-blue-600 text-sm font-semibold">
              {activeBooking ? 'Track now' : 'No active trip'} <ChevronRight className="h-4 w-4" />
            </div>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS_DATA.map((s, i) => (
            <motion.div
              key={s.label}
              className={`bg-white dark:bg-gray-800 rounded-2xl p-5 border ${s.border} shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5`}
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{s.label}</p>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Emergency Helpline */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/30">
              <Phone className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-white font-bold">National Emergency Helpline</p>
              <p className="text-gray-400 text-sm">Available 24/7 across India</p>
            </div>
          </div>
          <a href="tel:108" className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-extrabold text-xl tracking-wider transition-all hover:-translate-y-px active:scale-[0.98] shadow-lg shadow-red-900/30">
            108
          </a>
        </div>

        {/* Bookings Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">My Bookings</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">{bookings.length} total</span>
          </div>

          {bookings.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Ambulance className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">No bookings yet</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">Book your first ambulance to get started</p>
              <Link to="/book" className="inline-flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors">
                <Ambulance className="h-4 w-4" /> Book Now
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50">
                    {['Pickup', 'Hospital', 'Status', 'Fare', 'Date', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {bookings.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-5 py-4 text-sm text-gray-900 dark:text-gray-200 max-w-[180px] truncate">{b.pickup_location}</td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{b.hospital?.hospital_name || '—'}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full capitalize ${getStatusColor(b.status)}`}>
                          {b.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-gray-900 dark:text-white">₹{b.fare}</td>
                      <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(b.created_at)}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Link to={`/booking/${b.id}`} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors" title="View">
                            <Eye className="h-4 w-4" />
                          </Link>
                          {ACTIVE_STATUSES.includes(b.status) && (
                            <button onClick={() => navigate(`/track/${b.id}`)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 transition-colors" title="Track">
                              <MapPin className="h-4 w-4" />
                            </button>
                          )}
                          {['pending', 'accepted'].includes(b.status) && (
                            <button
                              onClick={() => handleCancel(b.id)}
                              disabled={actionLoadingId === b.id}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors disabled:opacity-50"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
