import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Booking, Driver, Ambulance } from '@/types';
import { formatDate, getStatusColor } from '@/lib/utils';
import { Activity, CheckCircle, DollarSign, Navigation, MapPin, Phone } from 'lucide-react';
import { toast } from 'sonner';

export default function DriverDashboard() {
  const { profile } = useAuth();
  const [driverData, setDriverData] = useState<Driver | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ambulance, setAmbulance] = useState<Ambulance | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState('Location sync inactive');
  const [driverError, setDriverError] = useState<string | null>(null);
  const lastLocationPushRef = useRef(0);

  useEffect(() => {
    fetchDriverData();
  }, [profile?.id]);

  useEffect(() => {
    if (!driverData?.id) return;

    fetchBookings();
    fetchAmbulance(driverData.id);

    const subscription = supabase
      .channel(`driver_dashboard_${driverData.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'drivers',
        filter: `id=eq.${driverData.id}`,
      }, (payload) => {
        // Update driverData in-place — avoids re-triggering fetchDriverData which calls refreshProfile
        if (payload.new) setDriverData((prev) => prev ? { ...prev, ...(payload.new as Driver) } : prev);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `driver_id=eq.${driverData.id}`,
      }, () => {
        fetchBookings();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ambulances',
        filter: `driver_id=eq.${driverData.id}`,
      }, () => {
        fetchAmbulance(driverData.id);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [driverData?.id]);

  useEffect(() => {
    if (!driverData?.id || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const now = Date.now();
        if (now - lastLocationPushRef.current < 5000) return;
        lastLocationPushRef.current = now;

        const { error } = await supabase
          .from('drivers')
          .update({
            current_lat: position.coords.latitude,
            current_lng: position.coords.longitude,
          })
          .eq('id', driverData.id);

        if (error) {
          setLocationStatus('Live location sync failed');
        } else {
          setLocationStatus(`Live location synced (${Math.round(position.coords.accuracy)}m)`);
        }
      },
      () => setLocationStatus('Location permission needed'),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [driverData?.id]);

  const fetchDriverData = async () => {
    if (!profile?.id) return;

    const { data: authResponse, error: authError } = await supabase.auth.getUser();
    if (authError) console.error('DriverDashboard getUser error:', authError.message);

    if (!authResponse.user) {
      setDriverError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('drivers')
      .select('*, profile:profiles(full_name, phone), hospital:hospitals(hospital_name)')
      .eq('profile_id', authResponse.user.id)
      .maybeSingle();

    if (error) {
      setDriverError(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setDriverError('No driver record is linked to this account.');
      setLoading(false);
      return;
    }

    // Self-heal: backfill full_name and phone into drivers row if missing
    const profileData = Array.isArray(data.profile) ? data.profile[0] : data.profile;
    if ((!data.full_name || !data.phone) && profileData) {
      await supabase
        .from('drivers')
        .update({
          full_name: data.full_name || profileData.full_name || null,
          phone: data.phone || profileData.phone || null,
        })
        .eq('id', data.id);
    }

    setDriverData(data as Driver);
    setDriverError(null);
    setLocationStatus(
      data.current_lat != null && data.current_lng != null
        ? 'Live location available'
        : 'Location not available'
    );

    setLoading(false);
  };

  const fetchAmbulance = async (driverId: string) => {
    const { data } = await supabase
      .from('ambulances')
      .select('*')
      .eq('driver_id', driverId)
      .maybeSingle();
    if (data) setAmbulance(data);
  };

  const fetchBookings = async () => {
    if (!driverData?.id) return;

    const { data, error } = await supabase
      .from('bookings')
      .select('*, hospital:hospitals(hospital_name), user:profiles!bookings_user_id_fkey(full_name, phone)')
      .eq('driver_id', driverData.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    if (data) {
      setBookings(prev => {
        const prevAcceptedIds = new Set(prev.filter(b => b.status === 'accepted').map(b => b.id));
        data.filter(b => b.status === 'accepted').forEach(b => {
          if (!prevAcceptedIds.has(b.id)) {
            toast.success(`New trip assigned! Pickup: ${b.pickup_location}`, { duration: 6000 });
          }
        });
        return data;
      });
    }
  };

  const handleUpdateStatus = async (bookingId: string, status: string) => {
    setActionLoading(bookingId);

    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Status updated to ${status}`);
      if (status === 'completed' && ambulance) {
        await supabase.from('ambulances').update({ status: 'available' }).eq('id', ambulance.id);
        await supabase.from('drivers').update({ is_available: true }).eq('id', driverData!.id);
      }
      fetchBookings();
    }

    setActionLoading(null);
  };

  const toggleAvailability = async () => {
    if (!driverData) return;
    const { error } = await supabase
      .from('drivers')
      .update({ is_available: !driverData.is_available })
      .eq('id', driverData.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`You are now ${!driverData.is_available ? 'available' : 'unavailable'}`);
      fetchDriverData();
    }
  };

  const effectiveApprovalStatus =
    profile?.approval_status === 'approved' ? 'approved' : driverData?.approval_status || 'pending';

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (driverError) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-3">Driver Data Error</h3>
          <p className="text-gray-600">{driverError}</p>
        </div>
      </div>
    );
  }

  if (profile?.role === 'driver' && effectiveApprovalStatus !== 'approved') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-3">Account Pending Approval</h3>
          <p className="text-gray-600">Your driver account is awaiting hospital approval.</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90">
            Refresh Status
          </button>
        </div>
      </div>
    );
  }

  const totalBookings = bookings.length;
  const activeBookings = bookings.filter(b => ['accepted', 'arrived', 'picked_up'].includes(b.status));
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const totalEarnings = completedBookings.reduce((sum, b) => sum + b.fare, 0);
  const walletBalance = (driverData as any)?.wallet_balance ?? (driverData as any)?.walletBalance ?? null;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Driver Dashboard</h1>
            <p className="text-gray-600 mt-1">
              {(driverData as any)?.full_name || driverData?.profile?.full_name || 'Driver'}
              {driverData?.hospital?.hospital_name ? ` • ${driverData.hospital.hospital_name}` : ''}
            </p>
            <p className="text-sm text-gray-500 mt-1">License: {driverData?.license_number}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${effectiveApprovalStatus === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {effectiveApprovalStatus}
              </span>
              <span className="text-xs text-gray-500">{locationStatus}</span>
            </div>
          </div>
          <button
            onClick={toggleAvailability}
            className={`px-6 py-3 rounded-lg font-medium text-white transition-colors ${driverData?.is_available ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'}`}
          >
            {driverData?.is_available ? 'Available' : 'Unavailable'}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Bookings</p><p className="text-3xl font-bold text-gray-900 mt-1">{totalBookings}</p></div>
              <Navigation className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Active Trips</p><p className="text-3xl font-bold text-gray-900 mt-1">{activeBookings.length}</p></div>
              <Activity className="h-8 w-8 text-orange-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Completed</p><p className="text-3xl font-bold text-gray-900 mt-1">{completedBookings.length}</p></div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Wallet Balance</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">₹{walletBalance ?? totalEarnings}</p>
                <p className="text-xs text-gray-500 mt-1">Total earned: ₹{totalEarnings}</p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Bookings List */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Assigned Bookings</h2>
          </div>

          <div className="divide-y divide-gray-200">
            {bookings.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MapPin className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No bookings assigned yet</p>
              </div>
            ) : (
              bookings.map((booking) => (
                <div key={booking.id} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full capitalize ${getStatusColor(booking.status)}`}>
                          {booking.status.replace('_', ' ')}
                        </span>
                        {booking.is_emergency && (
                          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-red-600 text-white">EMERGENCY</span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {booking.pickup_location} &rarr; {booking.destination}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {booking.hospital?.hospital_name} &bull; {booking.distance.toFixed(1)} km &bull; ₹{booking.fare}
                      </p>

                      <p className="text-xs text-gray-500 mt-1">
                        Payment: {booking.payment_method === 'cash' ? 'Cash' : booking.payment_method === 'in_app' ? 'In-App (Simulated)' : '—'}
                        {booking.payment_status ? ` • ${booking.payment_status}` : ''}
                      </p>

                      {/* Patient details */}
                      {(booking as any).user && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg space-y-1">
                          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Patient Details</p>
                          <p className="text-sm font-medium text-gray-900">{(booking as any).user?.full_name || '—'}</p>
                          {(booking as any).user?.phone && (
                            <a href={`tel:${(booking as any).user.phone}`} className="flex items-center gap-1 text-sm text-primary font-medium">
                              <Phone className="h-3.5 w-3.5" />{(booking as any).user.phone}
                            </a>
                          )}
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${booking.pickup_lat},${booking.pickup_lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                          >
                            <MapPin className="h-3.5 w-3.5" />Navigate to pickup
                          </a>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-2">{formatDate(booking.created_at)}</p>
                    </div>

                    <div className="flex flex-col space-y-2 min-w-[140px]">
                      {booking.status === 'accepted' && (
                        <button
                          onClick={() => handleUpdateStatus(booking.id, 'arrived')}
                          disabled={actionLoading === booking.id}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                        >
                          {actionLoading === booking.id ? 'Updating...' : 'Mark Arrived'}
                        </button>
                      )}
                      {booking.status === 'arrived' && (
                        <button
                          onClick={() => handleUpdateStatus(booking.id, 'picked_up')}
                          disabled={actionLoading === booking.id}
                          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm font-medium disabled:opacity-50"
                        >
                          {actionLoading === booking.id ? 'Updating...' : 'Start Trip'}
                        </button>
                      )}
                      {booking.status === 'picked_up' && (
                        <button
                          onClick={() => handleUpdateStatus(booking.id, 'completed')}
                          disabled={actionLoading === booking.id}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                        >
                          {actionLoading === booking.id ? 'Completing...' : 'Complete Trip'}
                        </button>
                      )}
                      <Link
                        to={`/track/${booking.id}`}
                        className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 text-sm font-medium text-center"
                      >
                        Track
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
