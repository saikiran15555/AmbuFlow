import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Booking } from '@/types';
import { formatDate, getStatusColor } from '@/lib/utils';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { ArrowLeft, MapPin, Navigation, Phone, User, DollarSign, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import 'leaflet/dist/leaflet.css';

export default function BookingDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchBooking();
      
      const subscription = supabase
        .channel(`booking_${id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${id}`,
        }, () => {
          fetchBooking();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [id]);

  const fetchBooking = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        driver:drivers(*, profile:profiles(full_name, phone)),
        ambulance:ambulances(vehicle_number, ambulance_type),
        hospital:hospitals(hospital_name, city)
      `)
      .eq('id', id)
      .single();

    if (error) {
      toast.error('Failed to fetch booking details');
      navigate(-1);
    } else if (data) {
      setBooking(data);
    }

    setLoading(false);
  };

  const handleCancelBooking = async () => {
    if (!booking) return;

    if (!confirm('Are you sure you want to cancel this booking?')) return;

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking.id);

    if (error) {
      toast.error('Failed to cancel booking');
    } else {
      toast.success('Booking cancelled');
      fetchBooking();
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <p className="text-gray-500">Booking not found</p>
      </div>
    );
  }

  const routeCoordinates: [number, number][] = [
    [booking.pickup_lat, booking.pickup_lng],
    [booking.destination_lat, booking.destination_lng],
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-primary hover:text-primary/90 mb-6"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="h-96 lg:h-[600px]">
                <MapContainer
                  center={[booking.pickup_lat, booking.pickup_lng]}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  <Marker position={[booking.pickup_lat, booking.pickup_lng]}>
                    <Popup>Pickup Location</Popup>
                  </Marker>
                  <Marker position={[booking.destination_lat, booking.destination_lng]}>
                    <Popup>Destination</Popup>
                  </Marker>
                  <Polyline positions={routeCoordinates} color="red" weight={3} />
                </MapContainer>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Booking Status</h2>
                <span className={`px-3 py-1 text-sm font-semibold rounded-full capitalize ${getStatusColor(booking.status)}`}>
                  {booking.status.replace('_', ' ')}
                </span>
              </div>

              {booking.is_emergency && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2 mb-4">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-sm font-medium text-red-900">Emergency Booking</span>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Pickup</p>
                    <p className="text-sm text-gray-600">{booking.pickup_location}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Navigation className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Destination</p>
                    <p className="text-sm text-gray-600">{booking.destination}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Booked On</p>
                    <p className="text-sm text-gray-600">{formatDate(booking.created_at)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Hospital Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Hospital Details</h3>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="text-gray-600">Hospital:</span>{' '}
                  <span className="font-medium text-gray-900">{booking.hospital?.hospital_name}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">City:</span>{' '}
                  <span className="font-medium text-gray-900">{booking.hospital?.city}</span>
                </p>
              </div>
            </div>

            {/* Driver & Ambulance */}
            {booking.driver && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Driver & Ambulance</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <User className="h-5 w-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">
                      {booking.driver.profile?.full_name}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <a
                      href={`tel:${booking.driver.profile?.phone}`}
                      className="text-sm text-primary hover:text-primary/90"
                    >
                      {booking.driver.profile?.phone}
                    </a>
                  </div>
                  <div className="pt-3 border-t">
                    <p className="text-sm text-gray-600 mb-1">Vehicle Number</p>
                    <p className="text-sm font-medium text-gray-900">{booking.ambulance?.vehicle_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Ambulance Type</p>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {booking.ambulance?.ambulance_type} Life Support
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Fare Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Fare Details</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Distance</span>
                  <span className="font-medium text-gray-900">{booking.distance.toFixed(1)} km</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Ambulance Type</span>
                  <span className="font-medium text-gray-900 capitalize">{booking.ambulance?.ambulance_type}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Payment Method</span>
                  <span className="font-medium text-gray-900">
                    {booking.payment_method === 'cash'
                      ? 'Cash'
                      : booking.payment_method === 'in_app'
                        ? 'In-App (Simulated)'
                        : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Payment Status</span>
                  <span className="font-medium text-gray-900 capitalize">{booking.payment_status || '—'}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold text-gray-900">Total Fare</span>
                    <span className="text-2xl font-bold text-primary">₹{booking.fare}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cancel Button */}
            {profile?.role === 'user' && ['pending', 'accepted'].includes(booking.status) && (
              <button
                onClick={handleCancelBooking}
                className="w-full py-3 px-4 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 font-medium transition-colors"
              >
                Cancel Booking
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
