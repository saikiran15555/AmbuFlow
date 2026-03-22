import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, MapPin, Phone, User, Ambulance, Clock, CheckCircle2, Loader2, Navigation2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Booking } from '@/types';
import { toast } from 'sonner';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';

const pickupIcon = L.divIcon({
  className: '',
  html: `<div style="width:36px;height:36px;background:#3B82F6;border-radius:50%;border:3px solid white;box-shadow:0 4px 12px rgba(59,130,246,0.5);display:flex;align-items:center;justify-content:center">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
  </div>`,
  iconSize: [36, 36], iconAnchor: [18, 18],
});

const destIcon = L.divIcon({
  className: '',
  html: `<div style="width:36px;height:36px;background:#10B981;border-radius:50%;border:3px solid white;box-shadow:0 4px 12px rgba(16,185,129,0.5);display:flex;align-items:center;justify-content:center">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
  </div>`,
  iconSize: [36, 36], iconAnchor: [18, 18],
});

const driverIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:48px;height:48px">
    <div style="position:absolute;inset:0;background:rgba(229,57,53,0.3);border-radius:50%;animation:pulse-ring 1.4s ease-out infinite"></div>
    <div style="position:absolute;inset:6px;background:#E53935;border-radius:50%;border:3px solid white;box-shadow:0 4px 16px rgba(229,57,53,0.6);display:flex;align-items:center;justify-content:center">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
    </div>
  </div>`,
  iconSize: [48, 48], iconAnchor: [24, 24],
});

const STATUS_STEPS = [
  { key: 'pending', label: 'Searching', desc: 'Finding nearest ambulance...', icon: Loader2, spin: true },
  { key: 'accepted', label: 'Assigned', desc: 'Driver is on the way', icon: Ambulance },
  { key: 'arrived', label: 'Arrived', desc: 'Ambulance at your location', icon: MapPin },
  { key: 'picked_up', label: 'En Route', desc: 'Heading to hospital', icon: Navigation2 },
  { key: 'completed', label: 'Completed', desc: 'Trip completed safely', icon: CheckCircle2 },
];

function RecenterMap({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== null && lng !== null) map.setView([lat, lng], 15, { animate: true });
  }, [lat, lng, map]);
  return null;
}

export default function TrackBookingPage() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [eta, setEta] = useState(8);

  const fetchBooking = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('bookings')
      .select(`*, hospital:hospitals(hospital_name), driver:drivers(current_lat, current_lng, profile:profiles(full_name, phone))`)
      .eq('id', id).single();
    if (error) { toast.error('Failed to fetch tracking data'); }
    else if (data) setBooking(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchBooking();
    const ch = supabase.channel(`track_booking_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `id=eq.${id}` }, fetchBooking)
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [fetchBooking, id]);

  useEffect(() => {
    if (!id || !booking?.driver_id) return;
    const ch = supabase.channel(`track_driver_${id}_${booking.driver_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers', filter: `id=eq.${booking.driver_id}` }, fetchBooking)
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [booking?.driver_id, fetchBooking, id]);

  // Mock ETA countdown
  useEffect(() => {
    if (!booking || booking.status === 'completed' || booking.status === 'cancelled') return;
    const t = setInterval(() => setEta(e => Math.max(1, e - 1)), 30000);
    return () => clearInterval(t);
  }, [booking?.status]);

  const currentStepIdx = STATUS_STEPS.findIndex(s => s.key === booking?.status);
  const driverLat = booking?.driver?.current_lat ?? null;
  const driverLng = booking?.driver?.current_lng ?? null;
  const mapCenter: [number, number] = driverLat !== null && driverLng !== null
    ? [driverLat, driverLng]
    : booking ? [booking.pickup_lat, booking.pickup_lng] : [20.5937, 78.9629];
  const backHref = profile?.role ? `/${profile.role}` : '/';

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-4">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full bg-red-100 dark:bg-red-900/20 animate-ping" />
            <div className="relative w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-200 dark:shadow-red-900/30">
              <Ambulance className="h-9 w-9 text-white animate-ambulance" />
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading tracking data...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-3">
          <MapPin className="h-12 w-12 text-gray-300 mx-auto" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Tracking data not found</p>
          <Link to={backHref} className="text-red-600 text-sm font-medium hover:underline">← Go back</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
      {/* Top bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to={backHref} className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-red-600 transition-colors text-sm font-medium">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Live Tracking</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[1fr,380px] gap-6">
          {/* Map */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700" style={{ height: '560px' }}>
            <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
              <RecenterMap lat={driverLat} lng={driverLng} />
              <Marker position={[booking.pickup_lat, booking.pickup_lng]} icon={pickupIcon}>
                <Popup><div className="font-semibold text-sm">📍 Pickup<br /><span className="font-normal text-gray-600 text-xs">{booking.pickup_location}</span></div></Popup>
              </Marker>
              <Marker position={[booking.destination_lat, booking.destination_lng]} icon={destIcon}>
                <Popup><div className="font-semibold text-sm">🏥 Destination<br /><span className="font-normal text-gray-600 text-xs">{booking.destination}</span></div></Popup>
              </Marker>
              {driverLat !== null && driverLng !== null && (
                <Marker position={[driverLat, driverLng]} icon={driverIcon}>
                  <Popup><div className="font-semibold text-sm">🚑 {booking.driver?.profile?.full_name || 'Your Ambulance'}</div></Popup>
                </Marker>
              )}
            </MapContainer>
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            {/* ETA Card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={booking.status}
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-5 text-white shadow-lg shadow-red-200 dark:shadow-red-900/30"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                      <Clock className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-sm">Estimated Arrival</span>
                  </div>
                  <span className="text-3xl font-extrabold">{eta} min</span>
                </div>
                <div className="bg-white/10 rounded-xl px-3 py-2 text-sm">
                  {STATUS_STEPS[currentStepIdx]?.desc || 'Processing your request...'}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Status Steps */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wide">Trip Status</h3>
              <div className="space-y-3">
                {STATUS_STEPS.filter(s => s.key !== 'cancelled').map((step, i) => {
                  const done = i < currentStepIdx;
                  const active = i === currentStepIdx;
                  const Icon = step.icon;
                  return (
                    <div key={step.key} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                        done ? 'bg-green-500' : active ? 'bg-red-600 animate-siren' : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <Icon className={`h-4 w-4 ${done || active ? 'text-white' : 'text-gray-400'} ${active && step.spin ? 'animate-spin' : ''}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${active ? 'text-red-600 dark:text-red-400' : done ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                          {step.label}
                        </p>
                        {active && <p className="text-xs text-gray-500 dark:text-gray-400">{step.desc}</p>}
                      </div>
                      {done && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Driver Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wide">Driver Details</h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 flex items-center justify-center">
                  <User className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">{booking.driver?.profile?.full_name || 'Awaiting assignment'}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{booking.driver?.profile?.phone || 'Phone not available'}</p>
                </div>
              </div>
              {booking.driver?.profile?.phone && (
                <a
                  href={`tel:${booking.driver.profile.phone}`}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold text-sm transition-all hover:-translate-y-px active:scale-[0.98] shadow-sm shadow-green-200 dark:shadow-green-900/20"
                >
                  <Phone className="h-4 w-4" /> Call Driver
                </a>
              )}
            </div>

            {/* Trip Info */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
              <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wide">Trip Info</h3>
              {[
                { label: 'Pickup', value: booking.pickup_location, icon: '📍' },
                { label: 'Hospital', value: booking.hospital?.hospital_name || booking.destination, icon: '🏥' },
                { label: 'Fare', value: `₹${booking.fare}`, icon: '💰' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3">
                  <span className="text-base mt-0.5">{item.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
