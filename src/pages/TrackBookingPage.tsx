import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, MapPin, Navigation } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Booking } from '@/types';
import { getStatusColor } from '@/lib/utils';
import { toast } from 'sonner';
import 'leaflet/dist/leaflet.css';

const pickupIcon = L.divIcon({
  className: 'pickup-location-marker',
  html: '<div class="h-4 w-4 rounded-full bg-blue-600 border-2 border-white shadow"></div>',
});

const driverIcon = L.divIcon({
  className: 'driver-location-marker',
  html: '<div class="h-4 w-4 rounded-full bg-red-600 border-2 border-white shadow animate-pulse"></div>',
});

function RecenterToDriver({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();

  useEffect(() => {
    if (lat === null || lng === null) return;
    map.setView([lat, lng], 15, { animate: true });
  }, [lat, lng, map]);

  return null;
}

export default function TrackBookingPage() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    fetchBooking();

    const channel = supabase
      .channel(`track_booking_${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${id}`,
      }, () => {
        fetchBooking();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'drivers',
      }, () => {
        fetchBooking();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [id]);

  const fetchBooking = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        hospital:hospitals(hospital_name),
        driver:drivers(current_lat, current_lng, profile:profiles(full_name, phone))
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Track booking fetch error:', error);
      toast.error('Failed to fetch live tracking data');
    } else if (data) {
      setBooking(data);
    }

    setLoading(false);
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
        <p className="text-gray-500">Tracking data not found</p>
      </div>
    );
  }

  const driverLat = booking.driver?.current_lat ?? null;
  const driverLng = booking.driver?.current_lng ?? null;
  const backHref = profile?.role ? `/${profile.role}` : '/';
  const mapCenter: [number, number] =
    driverLat !== null && driverLng !== null
      ? [driverLat, driverLng]
      : [booking.pickup_lat, booking.pickup_lng];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to={backHref} className="inline-flex items-center text-primary hover:text-primary/90 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Link>

        <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="h-[520px]">
              <MapContainer
                center={mapCenter}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <RecenterToDriver lat={driverLat} lng={driverLng} />
                <Marker position={[booking.pickup_lat, booking.pickup_lng]} icon={pickupIcon}>
                  <Popup>Pickup: {booking.pickup_location}</Popup>
                </Marker>
                <Marker position={[booking.destination_lat, booking.destination_lng]} icon={pickupIcon}>
                  <Popup>Destination: {booking.destination}</Popup>
                </Marker>
                {driverLat !== null && driverLng !== null && (
                  <Marker position={[driverLat, driverLng]} icon={driverIcon}>
                    <Popup>
                      Driver: {booking.driver?.profile?.full_name || 'Assigned driver'}
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Live Ambulance Tracking</h1>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500">Pickup</p>
                  <p className="font-medium text-gray-900">{booking.pickup_location}</p>
                </div>
                <div>
                  <p className="text-gray-500">Destination</p>
                  <p className="font-medium text-gray-900">{booking.destination}</p>
                </div>
                <div>
                  <p className="text-gray-500">Hospital</p>
                  <p className="font-medium text-gray-900">{booking.hospital?.hospital_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Driver</p>
                  <p className="font-medium text-gray-900">{booking.driver?.profile?.full_name || 'Awaiting driver update'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">{booking.driver?.profile?.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <span className={`inline-flex mt-1 px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusColor(booking.status)}`}>
                    {booking.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-start gap-3">
                <Navigation className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-sm text-gray-600">
                  {driverLat !== null && driverLng !== null ? (
                    <p>Driver position is updating live from Supabase.</p>
                  ) : (
                    <p>Waiting for driver GPS updates to appear.</p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <p className="text-sm text-gray-600">
                  Pickup marker and destination marker are shown using booking coordinates from Supabase.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
