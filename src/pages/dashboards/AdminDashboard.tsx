import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Hospital, Booking } from '@/types';
import { formatDate, getStatusColor } from '@/lib/utils';
import { Users, Building2, UserCheck, Activity, MapPin, IndianRupee, RefreshCw, Clock, Zap, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import StatCard from '@/components/features/StatCard';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminDashboard() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({ totalUsers: 0, totalHospitals: 0, totalDrivers: 0, totalBookings: 0, activeTrips: 0, totalRevenue: 0 });
  const [pendingHospitals, setPendingHospitals] = useState<Hospital[]>([]);
  const [approvedHospitals, setApprovedHospitals] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchData = async () => {
    setFetchError(null);
    setLoading(true);
    const [
      { count: userCount }, { count: hospitalCount }, { count: driverCount },
      { count: bookingCount }, { count: activeCount },
      { data: completedBookings },
      { data: hospitals, error: pendingErr },
      { data: approvedHospitalRows },
      { data: bookings },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'user'),
      supabase.from('hospitals').select('*', { count: 'exact', head: true }),
      supabase.from('drivers').select('*', { count: 'exact', head: true }),
      supabase.from('bookings').select('*', { count: 'exact', head: true }),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).in('status', ['pending', 'accepted', 'arrived', 'picked_up']),
      supabase.from('bookings').select('fare').eq('status', 'completed'),
      supabase.from('hospitals').select('id, profile_id, hospital_name, city, hospital_type, approval_status, created_at, profile:profiles(email, phone)').eq('approval_status', 'pending'),
      supabase.from('hospitals').select('id, profile_id, hospital_name, city, hospital_type, approval_status, created_at, profile:profiles(email, phone)').eq('approval_status', 'approved'),
      supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(10),
    ]);

    setStats({
      totalUsers: userCount || 0, totalHospitals: hospitalCount || 0, totalDrivers: driverCount || 0,
      totalBookings: bookingCount || 0, activeTrips: activeCount || 0,
      totalRevenue: completedBookings?.reduce((s, b) => s + b.fare, 0) || 0,
    });

    if (pendingErr) setFetchError(`Hospitals fetch error: ${pendingErr.message}`);
    const merge = (rows: any[]) => (rows || []).map((h: any) => ({ ...h, email: h.profile?.email || '-', phone: h.profile?.phone || '-' }));
    setPendingHospitals(merge(hospitals || []));
    setApprovedHospitals(merge(approvedHospitalRows || []));
    if (bookings) setRecentBookings(bookings);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const ch = supabase.channel('admin_dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hospitals' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const handleApproveHospital = async (hospitalId: string | null, profileId: string) => {
    if (!profileId) { toast.error('No profile ID'); return; }
    setApprovingId(hospitalId || profileId);
    const { error: pe } = await supabase.from('profiles').update({ approval_status: 'approved' }).eq('id', profileId);
    const target = hospitalId
      ? supabase.from('hospitals').update({ approval_status: 'approved' }).eq('id', hospitalId)
      : supabase.from('hospitals').update({ approval_status: 'approved' }).eq('profile_id', profileId);
    const { error: he } = await target;
    if (pe || he) { toast.error('Failed to approve hospital'); setApprovingId(null); return; }
    toast.success('Hospital approved ✓');
    await fetchData();
    try { await refreshProfile(); } catch {}
    setApprovingId(null);
  };

  const handleRejectHospital = async (hospitalId: string | null, profileId: string) => {
    if (!profileId) { toast.error('No profile ID'); return; }
    setApprovingId(hospitalId || profileId);
    await supabase.from('profiles').update({ approval_status: 'rejected' }).eq('id', profileId);
    const target = hospitalId
      ? supabase.from('hospitals').update({ approval_status: 'rejected' }).eq('id', hospitalId)
      : supabase.from('hospitals').update({ approval_status: 'rejected' }).eq('profile_id', profileId);
    const { error } = await target;
    if (error) { toast.error('Failed to reject hospital'); setApprovingId(null); return; }
    toast.success('Hospital rejected');
    await fetchData();
    try { await refreshProfile(); } catch {}
    setApprovingId(null);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full bg-red-100 dark:bg-red-900/20 animate-ping" />
            <div className="relative w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
              <Activity className="h-8 w-8 text-white animate-pulse" />
            </div>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  const STAT_CARDS = [
    { title: 'Total Users', value: stats.totalUsers, icon: Users, iconBg: 'bg-blue-50 dark:bg-blue-900/20', iconColor: 'text-blue-600 dark:text-blue-400', border: 'border-blue-100 dark:border-blue-800', subtitle: 'Registered users', onClick: () => navigate('/admin/users') },
    { title: 'Hospitals', value: stats.totalHospitals, icon: Building2, iconBg: 'bg-red-50 dark:bg-red-900/20', iconColor: 'text-red-600 dark:text-red-400', border: 'border-red-100 dark:border-red-800', subtitle: 'All hospital accounts', onClick: () => navigate('/admin/hospitals') },
    { title: 'Drivers', value: stats.totalDrivers, icon: UserCheck, iconBg: 'bg-green-50 dark:bg-green-900/20', iconColor: 'text-green-600 dark:text-green-400', border: 'border-green-100 dark:border-green-800', subtitle: 'Registered drivers', onClick: () => navigate('/admin/drivers') },
    { title: 'Total Bookings', value: stats.totalBookings, icon: MapPin, iconBg: 'bg-purple-50 dark:bg-purple-900/20', iconColor: 'text-purple-600 dark:text-purple-400', border: 'border-purple-100 dark:border-purple-800', subtitle: 'All time bookings', onClick: () => navigate('/admin/bookings') },
    { title: 'Active Trips', value: stats.activeTrips, icon: Activity, iconBg: 'bg-amber-50 dark:bg-amber-900/20', iconColor: 'text-amber-600 dark:text-amber-400', border: 'border-amber-100 dark:border-amber-800', subtitle: 'In-progress right now', onClick: () => navigate('/admin/trips') },
    { title: 'Total Revenue', value: `₹${stats.totalRevenue.toLocaleString()}`, icon: IndianRupee, iconBg: 'bg-emerald-50 dark:bg-emerald-900/20', iconColor: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-100 dark:border-emerald-800', subtitle: 'From completed trips', onClick: () => navigate('/admin/revenue') },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">System overview and management</p>
          </div>
          <div className="flex items-center gap-3">
            {stats.activeTrips > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full text-sm font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                {stats.activeTrips} active trips
              </div>
            )}
            <button onClick={fetchData} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {fetchError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {fetchError}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {STAT_CARDS.map((s, i) => (
            <StatCard key={s.title} {...s} delay={i * 0.05} />
          ))}
        </div>

        {/* Pending Approvals */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pending Hospital Approvals</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">{pendingHospitals.length} awaiting review</p>
              </div>
            </div>
            {pendingHospitals.length > 0 && (
              <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold px-2.5 py-1 rounded-full">
                {pendingHospitals.length} pending
              </span>
            )}
          </div>

          {pendingHospitals.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="h-7 w-7 text-green-500" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">All caught up!</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">No pending hospital approvals</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              <AnimatePresence>
                {pendingHospitals.map((hospital) => (
                  <motion.div
                    key={`hosp-${hospital.id}`}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                    className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-5 w-5 text-red-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{hospital.hospital_name}</p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{hospital.city}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">{hospital.hospital_type}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">{(hospital as any).email}</span>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />{formatDate(hospital.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleApproveHospital(hospital.id, hospital.profile_id)}
                          disabled={approvingId === (hospital.id || hospital.profile_id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all hover:-translate-y-px active:scale-[0.97] disabled:opacity-50 shadow-sm shadow-green-200 dark:shadow-green-900/20"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleRejectHospital(hospital.id, hospital.profile_id)}
                          disabled={approvingId === (hospital.id || hospital.profile_id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all hover:-translate-y-px active:scale-[0.97] disabled:opacity-50 shadow-sm shadow-red-200 dark:shadow-red-900/20"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Approved Hospitals */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
                <Building2 className="h-5 w-5 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Approved Hospitals</h2>
            </div>
            <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold px-2.5 py-1 rounded-full">
              {approvedHospitals.length} active
            </span>
          </div>
          {approvedHospitals.length === 0 ? (
            <div className="p-10 text-center">
              <Building2 className="h-10 w-10 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
              <p className="text-gray-400 dark:text-gray-500 text-sm">No approved hospitals yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {approvedHospitals.map((hospital) => (
                <button
                  key={hospital.id}
                  onClick={() => navigate(`/admin/hospitals/${hospital.id}`)}
                  className="text-left bg-gray-50 dark:bg-gray-700/50 hover:bg-red-50 dark:hover:bg-red-900/10 border border-gray-100 dark:border-gray-700 hover:border-red-200 dark:hover:border-red-800 rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-2 group-hover:bg-red-100 dark:group-hover:bg-red-900/30 transition-colors">
                      <Building2 className="h-5 w-5 text-red-600" />
                    </div>
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full capitalize">
                      {hospital.hospital_type}
                    </span>
                  </div>
                  <p className="font-bold text-gray-900 dark:text-white text-sm group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">{hospital.hospital_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{hospital.city}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 font-semibold mt-3 flex items-center gap-1 group-hover:gap-2 transition-all">
                    View details <ChevronRight className="h-3 w-3" />
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent Bookings */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Bookings</h2>
            </div>
            <button onClick={() => navigate('/admin/bookings')} className="text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1 hover:gap-2 transition-all">
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {recentBookings.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="h-10 w-10 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
              <p className="text-gray-400 dark:text-gray-500 text-sm">No bookings yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50">
                    {['Route', 'Distance', 'Status', 'Fare', 'Type', 'Date'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {recentBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-5 py-4 text-sm text-gray-900 dark:text-gray-200 max-w-[200px]">
                        <p className="truncate font-medium">{booking.pickup_location}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">→ {booking.destination}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{booking.distance.toFixed(1)} km</td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full capitalize ${getStatusColor(booking.status)}`}>
                          {booking.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-gray-900 dark:text-white">₹{booking.fare}</td>
                      <td className="px-5 py-4">
                        {booking.is_emergency ? (
                          <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                            <Zap className="h-3 w-3" /> Emergency
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">Standard</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(booking.created_at)}</td>
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
