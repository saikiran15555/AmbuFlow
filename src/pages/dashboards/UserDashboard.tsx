import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Booking } from '@/types';
import { formatDate, getStatusColor } from '@/lib/utils';
import { Ambulance, Activity, CheckCircle, DollarSign, AlertCircle, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export default function UserDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    totalSpent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
    
    const subscription = supabase
      .channel('user_bookings_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `user_id=eq.${profile?.id}`,
      }, () => {
        fetchBookings();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile?.id]);

  const fetchBookings = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        hospital:hospitals(hospital_name),
        driver:drivers(full_name, phone)
      `)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch bookings');
      setLoading(false);
      return;
    }

    if (data) {
      setBookings(prev => {
        // Notify user when booking status changes
        data.forEach(b => {
          const prev_b = prev.find(p => p.id === b.id);
          if (prev_b && prev_b.status !== b.status) {
            const msgs: Record<string, string> = {
              accepted: 'Ambulance assigned and on the way!',
              arrived: 'Ambulance has arrived at your location!',
              picked_up: 'You have been picked up. En route to hospital.',
              completed: 'Trip completed. Stay safe!',
              cancelled: 'Your booking was cancelled.',
            };
            if (msgs[b.status]) toast.info(msgs[b.status], { duration: 6000 });
          }
        });
        return data;
      });

      const completed = data.filter(b => b.status === 'completed');
      const active = data.filter(b => ['pending', 'accepted', 'arrived', 'picked_up'].includes(b.status));
      setStats({
        total: data.length,
        active: active.length,
        completed: completed.length,
        totalSpent: completed.reduce((sum, b) => sum + b.fare, 0),
      });
    }

    setLoading(false);
  };

  const handleEmergencyBooking = () => {
    navigate('/book?emergency=1');
  };

  const handleTrackActiveBooking = () => {
    const activeBooking = bookings.find((booking) => ['pending', 'accepted', 'arrived', 'picked_up'].includes(booking.status));

    if (!activeBooking) {
      toast.info('No active booking available to track');
      return;
    }

    navigate(`/track/${activeBooking.id}`);
  };

  const handleCancelBooking = async (bookingId: string) => {
    setActionLoadingId(bookingId);

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .eq('user_id', profile?.id);

    if (error) {
      console.error('Failed to cancel booking:', error);
      toast.error('Failed to cancel booking');
    } else {
      toast.success('Booking cancelled');
      fetchBookings();
    }

    setActionLoadingId(null);
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
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {profile?.full_name}</h1>
          <p className="text-gray-600 mt-1">Manage your ambulance bookings</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Bookings</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <Ambulance className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Trips</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.active}</p>
              </div>
              <div className="bg-orange-100 rounded-full p-3">
                <Activity className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.completed}</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">₹{stats.totalSpent}</p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link
            to="/book"
            className="bg-primary text-white rounded-lg shadow-lg p-6 hover:bg-primary/90 transition-colors"
          >
            <Ambulance className="h-8 w-8 mb-3" />
            <h3 className="text-xl font-semibold mb-2">Book Ambulance</h3>
            <p className="text-red-100">Request an ambulance with fixed fare pricing</p>
          </Link>

          <button
            onClick={handleEmergencyBooking}
            className="bg-emergency text-white rounded-lg shadow-lg p-6 hover:bg-emergency-dark transition-colors text-left"
          >
            <AlertCircle className="h-8 w-8 mb-3" />
            <h3 className="text-xl font-semibold mb-2">Emergency Help</h3>
            <p className="text-red-100">Priority booking for critical situations</p>
          </button>

          <button
            type="button"
            onClick={handleTrackActiveBooking}
            className="bg-white rounded-lg shadow-sm p-6 border-2 border-gray-200 hover:border-primary transition-colors text-left"
          >
            <MapPin className="h-8 w-8 text-primary mb-3" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Track Ambulance</h3>
            <p className="text-gray-600">Real-time tracking of your active bookings</p>
          </button>
        </div>

        {/* Recent Bookings */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">My Bookings</h2>
          </div>
          
          <div className="overflow-x-auto">
            {bookings.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Ambulance className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No bookings yet. Book your first ambulance!</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pickup</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hospital</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fare</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{booking.pickup_location}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{booking.hospital?.hospital_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {(booking as any).driver?.full_name || '—'}
                        {(booking as any).driver?.phone && (
                          <div className="text-xs text-gray-400">{(booking as any).driver.phone}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusColor(booking.status)}`}>
                          {booking.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">₹{booking.fare}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(booking.created_at)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/booking/${booking.id}`}
                            className="text-primary hover:text-primary/90 text-sm font-medium"
                          >
                            View
                          </Link>
                          {['pending', 'accepted', 'arrived', 'picked_up'].includes(booking.status) && (
                            <button
                              type="button"
                              onClick={() => navigate(`/track/${booking.id}`)}
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                            >
                              Track
                            </button>
                          )}
                          {['pending', 'accepted'].includes(booking.status) && (
                            <button
                              type="button"
                              onClick={() => handleCancelBooking(booking.id)}
                              disabled={actionLoadingId === booking.id}
                              className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                            >
                              {actionLoadingId === booking.id ? 'Cancelling...' : 'Cancel'}
                            </button>
                          )}
                        </div>
                      </td>
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
