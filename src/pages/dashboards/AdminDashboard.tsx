import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Profile, Hospital, Driver, Booking } from '@/types';
import { formatDate, getStatusColor } from '@/lib/utils';
import { Users, Building2, UserCheck, Activity, MapPin, DollarSign } from 'lucide-react';
import StatCard from '@/components/features/StatCard';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalHospitals: 0,
    totalDrivers: 0,
    totalBookings: 0,
    activeTrips: 0,
    totalRevenue: 0,
  });
  
  const [pendingHospitals, setPendingHospitals] = useState<Hospital[]>([]);
  const [approvedHospitals, setApprovedHospitals] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setFetchError(null);
    setLoading(true);

    const [
      { count: userCount, error: userCountError },
      { count: hospitalCount, error: hospitalCountError },
      { count: driverCount, error: driverCountError },
      { count: bookingCount, error: bookingCountError },
      { count: activeCount, error: activeCountError },
      { data: completedBookings, error: completedBookingsError },
      { data: hospitals, error: pendingHospitalsError },
      { data: approvedHospitalRows, error: approvedHospitalsError },
      { data: bookings, error: bookingsError },
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

    const totalRevenue = completedBookings?.reduce((sum, b) => sum + b.fare, 0) || 0;

    if (userCountError || hospitalCountError || driverCountError || bookingCountError || activeCountError || completedBookingsError) {
      const e = userCountError || hospitalCountError || driverCountError || bookingCountError || activeCountError || completedBookingsError;
      setFetchError(`Stats query failed: ${e?.message || 'unknown error'}`);
    }

    setStats({
      totalUsers: userCount || 0,
      totalHospitals: hospitalCount || 0,
      totalDrivers: driverCount || 0,
      totalBookings: bookingCount || 0,
      activeTrips: activeCount || 0,
      totalRevenue,
    });

    if (pendingHospitalsError) {
      setFetchError((prev) => `${prev || ''}${prev ? ' | ' : ''}Hospitals fetch error: ${pendingHospitalsError.message}`);
    }

    // Read email/phone from embedded profiles join
    const mergedHospitals = (hospitals || []).map((h: any) => ({
      ...h,
      email: h.profile?.email || '-',
      phone: h.profile?.phone || '-',
    }));
    setPendingHospitals(mergedHospitals);

    if (approvedHospitalsError) console.warn('Approved hospitals error:', approvedHospitalsError.message);
    setApprovedHospitals((approvedHospitalRows || []).map((h: any) => ({
      ...h,
      email: h.profile?.email || '-',
      phone: h.profile?.phone || '-',
    })));

    if (bookingsError) {
      setFetchError((prev) => `${prev || ''}${prev ? ' | ' : ''}Bookings fetch error: ${bookingsError.message}`);
    }
    if (bookings) setRecentBookings(bookings);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin_dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hospitals' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleApproveHospital = async (hospitalId: string | null, profileId: string) => {
    if (!profileId) {
      toast.error('No profile ID provided for approval');
      return;
    }

    // Keep roles consistent, source of truth is profiles.
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ approval_status: 'approved' })
      .eq('id', profileId);

    let hospitalError = null;
    if (hospitalId) {
      const result = await supabase
        .from('hospitals')
        .update({ approval_status: 'approved' })
        .eq('id', hospitalId);
      hospitalError = result.error;
    } else {
      // sync by profile_id if hospital row exists for this profile
      const result = await supabase
        .from('hospitals')
        .update({ approval_status: 'approved' })
        .eq('profile_id', profileId);
      hospitalError = result.error;
    }

    if (profileError || hospitalError) {
      console.error('Approval errors:', { profileError, hospitalError });
      toast.error('Failed to approve hospital');
      return;
    }

    toast.success('Hospital approved');
    await fetchData();

    // Ensure auth state is consistent and refetched.
    try {
      await refreshProfile();
    } catch (error) {
      console.warn('refreshProfile failed after hospital approval', error);
    }
  };

  const handleRejectHospital = async (hospitalId: string | null, profileId: string) => {
    if (!profileId) {
      toast.error('No profile ID provided for rejection');
      return;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ approval_status: 'rejected' })
      .eq('id', profileId);

    let hospitalError = null;
    if (hospitalId) {
      const result = await supabase
        .from('hospitals')
        .update({ approval_status: 'rejected' })
        .eq('id', hospitalId);
      hospitalError = result.error;
    } else {
      const result = await supabase
        .from('hospitals')
        .update({ approval_status: 'rejected' })
        .eq('profile_id', profileId);
      hospitalError = result.error;
    }

    if (profileError || hospitalError) {
      console.error('Rejection errors:', { profileError, hospitalError });
      toast.error('Failed to reject hospital');
      return;
    }

    toast.success('Hospital rejected');
    await fetchData();

    try {
      await refreshProfile();
    } catch (error) {
      console.warn('refreshProfile failed after hospital rejection', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">System overview and management</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            icon={Users}
            iconColor="text-blue-600"
            subtitle="View all registered users"
            onClick={() => navigate('/admin/users')}
          />
          <StatCard
            title="Total Hospitals"
            value={stats.totalHospitals}
            icon={Building2}
            iconColor="text-red-600"
            subtitle="Manage hospital accounts"
            onClick={() => navigate('/admin/hospitals')}
          />
          <StatCard
            title="Total Drivers"
            value={stats.totalDrivers}
            icon={UserCheck}
            iconColor="text-green-600"
            subtitle="Inspect driver roster"
            onClick={() => navigate('/admin/drivers')}
          />
          <StatCard
            title="Total Bookings"
            value={stats.totalBookings}
            icon={MapPin}
            iconColor="text-purple-600"
            subtitle="Open booking history"
            onClick={() => navigate('/admin/bookings')}
          />
          <StatCard
            title="Active Trips"
            value={stats.activeTrips}
            icon={Activity}
            iconColor="text-orange-600"
            subtitle="Track in-progress trips"
            onClick={() => navigate('/admin/trips')}
          />
          <StatCard
            title="Total Revenue"
            value={`₹${stats.totalRevenue}`}
            icon={DollarSign}
            iconColor="text-emerald-600"
            subtitle="Review completed-trip revenue"
            onClick={() => navigate('/admin/revenue')}
          />
        </div>

        {/* Pending Hospitals */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Pending Hospital Approvals</h2>
            {fetchError && (
              <p className="text-sm text-red-600">{fetchError}</p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hospital Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pendingHospitals.map((hospital) => (
                  <tr key={`hosp-${hospital.id}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{hospital.hospital_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{(hospital as any).email || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{(hospital as any).phone || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{hospital.city}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 capitalize">{hospital.hospital_type}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(hospital.created_at)}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleApproveHospital(hospital.id, hospital.profile_id)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectHospital(hospital.id, hospital.profile_id)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {pendingHospitals.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No pending hospital approvals.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Approved Hospitals */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Approved Hospitals</h2>
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">{approvedHospitals.length} active</span>
          </div>
          {approvedHospitals.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Building2 className="h-10 w-10 mx-auto mb-2 text-gray-200" />
              <p>No approved hospitals yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {approvedHospitals.map((hospital) => (
                <button
                  key={hospital.id}
                  onClick={() => navigate(`/admin/hospitals/${hospital.id}`)}
                  className="text-left bg-gray-50 hover:bg-primary/5 border border-gray-200 hover:border-primary/30 rounded-xl p-4 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="bg-primary/10 rounded-lg p-2 group-hover:bg-primary/20 transition-colors">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full capitalize">
                      {hospital.hospital_type}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 group-hover:text-primary transition-colors">{hospital.hospital_name}</p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{hospital.city}
                  </p>
                  {hospital.email && hospital.email !== '-' && (
                    <p className="text-xs text-gray-400 mt-1 truncate">{hospital.email}</p>
                  )}
                  {hospital.phone && hospital.phone !== '-' && (
                    <p className="text-xs text-gray-400 mt-0.5">{hospital.phone}</p>
                  )}
                  <p className="text-xs text-primary font-medium mt-3 group-hover:underline">View details →</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent Bookings */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Recent Bookings</h2>
          </div>

          <div className="overflow-x-auto">
            {recentBookings.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No bookings yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Distance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fare</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Emergency</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>{booking.pickup_location}</div>
                        <div className="text-xs text-gray-500">→ {booking.destination}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {booking.distance.toFixed(1)} km
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusColor(booking.status)}`}>
                          {booking.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">₹{booking.fare}</td>
                      <td className="px-6 py-4">
                        {booking.is_emergency && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-600 text-white">
                            EMERGENCY
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(booking.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
