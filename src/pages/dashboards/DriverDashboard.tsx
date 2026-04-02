import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Booking, Driver, Ambulance } from '@/types';
import { formatDate, getStatusColor } from '@/lib/utils';
import { Activity, CheckCircle, DollarSign, Navigation, MapPin, Phone, Locate } from 'lucide-react';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ── Map icons ────────────────────────────────────────────────────────────────
const driverMapIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:48px;height:48px">
    <div style="position:absolute;inset:0;background:rgba(220,38,38,0.25);border-radius:50%;animation:ping 1.4s ease-out infinite"></div>
    <div style="position:absolute;inset:6px;background:#DC2626;border-radius:50%;border:3px solid white;box-shadow:0 4px 16px rgba(220,38,38,0.55);display:flex;align-items:center;justify-content:center">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
    </div>
  </div>`,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

const pickupMapIcon = L.divIcon({
  className: '',
  html: `<div style="width:36px;height:36px;background:#3B82F6;border-radius:50%;border:3px solid white;box-shadow:0 4px 12px rgba(59,130,246,0.5);display:flex;align-items:center;justify-content:center">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

const destMapIcon = L.divIcon({
  className: '',
  html: `<div style="width:36px;height:36px;background:#10B981;border-radius:50%;border:3px solid white;box-shadow:0 4px 12px rgba(16,185,129,0.5);display:flex;align-items:center;justify-content:center">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  const keyRef = useRef('');
  useEffect(() => {
    if (!coords.length) return;
    const key = coords.map(c => c.join(',')).join('|');
    if (keyRef.current === key) return;
    keyRef.current = key;
    if (coords.length >= 2) {
      map.fitBounds(L.latLngBounds(coords), { padding: [52, 52], animate: true, maxZoom: 16 });
    } else {
      map.setView(coords[0], 15, { animate: true });
    }
  }, [coords, map]);
  return null;
}

export default function DriverDashboard() {
  const { profile } = useAuth();
  const [driverData, setDriverData] = useState<Driver | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ambulance, setAmbulance] = useState<Ambulance | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState('Location sync inactive');
  const [livePos, setLivePos] = useState<{ lat: number; lng: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [driverError, setDriverError] = useState<string | null>(null);
  const lastLocationPushRef = useRef(0);
  const lastRouteFetchKeyRef = useRef('');

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
          setLivePos({ lat: position.coords.latitude, lng: position.coords.longitude });
          setLocationStatus(`Live location synced (${Math.round(position.coords.accuracy)}m)`);
        }
      },
      () => setLocationStatus('Location permission needed'),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [driverData?.id]);

  // Fetch road route from driver → pickup via OSRM whenever position or active trip changes
  useEffect(() => {
    const activeTrip = bookings.find(b => ['accepted', 'arrived', 'picked_up'].includes(b.status));
    if (!livePos || !activeTrip) { setRouteCoords([]); return; }

    const key = `${livePos.lat.toFixed(4)},${livePos.lng.toFixed(4)}|${activeTrip.pickup_lat},${activeTrip.pickup_lng}`;
    if (lastRouteFetchKeyRef.current === key) return;
    lastRouteFetchKeyRef.current = key;

    (async () => {
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${livePos.lng},${livePos.lat};${activeTrip.pickup_lng},${activeTrip.pickup_lat}` +
          `?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const json = await res.json();
        const coords: [number, number][] =
          json?.routes?.[0]?.geometry?.coordinates?.map(
            ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
          ) ?? [];
        setRouteCoords(coords.length >= 2 ? coords : [[livePos.lat, livePos.lng], [activeTrip.pickup_lat, activeTrip.pickup_lng]]);
      } catch {
        setRouteCoords([[livePos.lat, livePos.lng], [activeTrip.pickup_lat, activeTrip.pickup_lng]]);
      }
    })();
  }, [livePos, bookings]);

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

        {/* ── Live Map ─────────────────────────────────────────────────────── */}
        {(() => {
          const activeTrip = activeBookings[0] ?? null;
          const mapCenter: [number, number] = livePos
            ? [livePos.lat, livePos.lng]
            : activeTrip
            ? [activeTrip.pickup_lat, activeTrip.pickup_lng]
            : [20.5937, 78.9629];
          const boundsCoords: [number, number][] = livePos && activeTrip
            ? [[livePos.lat, livePos.lng], [activeTrip.pickup_lat, activeTrip.pickup_lng]]
            : livePos ? [[livePos.lat, livePos.lng]]
            : activeTrip ? [[activeTrip.pickup_lat, activeTrip.pickup_lng]]
            : [[20.5937, 78.9629]];
          const fitCoords = routeCoords.length >= 2 ? routeCoords : boundsCoords;
          const routeStyle = { color: '#DC2626', weight: 5, opacity: 0.9, lineCap: 'round' as const, lineJoin: 'round' as const };

          return (
            <div className="mb-8 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Map header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center">
                    <Locate className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Route to Pickup</h2>
                    <p className="text-xs text-gray-500">{locationStatus}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      livePos ? 'bg-green-500' : 'bg-yellow-400'
                    }`} />
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      livePos ? 'bg-green-500' : 'bg-yellow-400'
                    }`} />
                  </span>
                  <span className={`text-xs font-semibold ${
                    livePos ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {livePos
                      ? routeCoords.length >= 2
                        ? 'Route Active'
                        : 'GPS Active'
                      : 'Waiting for GPS'}
                  </span>
                </div>
              </div>

              <div className="grid lg:grid-cols-[1fr,280px]">
                {/* Map */}
                <div style={{ height: '420px' }}>
                  <MapContainer center={mapCenter} zoom={14} style={{ height: '100%', width: '100%' }}
                    whenReady={(m) => setTimeout(() => m.target.invalidateSize(), 200)}>
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; OpenStreetMap contributors'
                    />
                    <FitBounds coords={fitCoords} />
                    {routeCoords.length >= 2 && (
                      <Polyline positions={routeCoords} pathOptions={routeStyle} />
                    )}
                    {livePos && (
                      <Marker position={[livePos.lat, livePos.lng]} icon={driverMapIcon}>
                        <Popup>
                          <div className="font-semibold text-sm">🚑 Your Location<br />
                            <span className="font-normal text-gray-500 text-xs">
                              {livePos.lat.toFixed(5)}, {livePos.lng.toFixed(5)}
                            </span>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                    {activeTrip && (
                      <Marker position={[activeTrip.pickup_lat, activeTrip.pickup_lng]} icon={pickupMapIcon}>
                        <Popup>
                          <div className="font-semibold text-sm">📍 Pickup<br />
                            <span className="font-normal text-gray-600 text-xs">{activeTrip.pickup_location}</span>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                    {activeTrip && activeTrip.destination_lat && activeTrip.destination_lng && (
                      <Marker position={[activeTrip.destination_lat, activeTrip.destination_lng]} icon={destMapIcon}>
                        <Popup>
                          <div className="font-semibold text-sm">🏥 Hospital<br />
                            <span className="font-normal text-gray-600 text-xs">{activeTrip.destination}</span>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                  </MapContainer>
                </div>

                {/* Side info panel */}
                <div className="p-5 border-l border-gray-100 flex flex-col gap-4 bg-gray-50">
                  {/* GPS coords */}
                  <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your Position</p>
                    {livePos ? (
                      <>
                        <p className="text-sm font-mono text-gray-800">{livePos.lat.toFixed(5)}</p>
                        <p className="text-sm font-mono text-gray-800">{livePos.lng.toFixed(5)}</p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400">Acquiring GPS…</p>
                    )}
                  </div>

                  {/* Active trip info */}
                  {activeTrip ? (
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Active Trip</p>
                      <div className="space-y-2.5">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <MapPin className="h-3 w-3 text-blue-600" />
                          </span>
                          <div>
                            <p className="text-xs text-gray-400">Pickup</p>
                            <p className="text-xs font-semibold text-gray-800 leading-snug">{activeTrip.pickup_location}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                            <MapPin className="h-3 w-3 text-green-600" />
                          </span>
                          <div>
                            <p className="text-xs text-gray-400">Hospital</p>
                            <p className="text-xs font-semibold text-gray-800 leading-snug">{activeTrip.destination}</p>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-full capitalize ${getStatusColor(activeTrip.status)}`}>
                            {activeTrip.status.replace('_', ' ')}
                          </span>
                          <span className="text-xs font-bold text-gray-700">₹{activeTrip.fare}</span>
                        </div>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${activeTrip.pickup_lat},${activeTrip.pickup_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 w-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
                        >
                          <Navigation className="h-3.5 w-3.5" /> Navigate
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex-1 flex flex-col items-center justify-center text-center gap-2">
                      <MapPin className="h-8 w-8 text-gray-200" />
                      <p className="text-sm text-gray-400 font-medium">No active trip</p>
                      <p className="text-xs text-gray-300">Map will update when a trip is assigned</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

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
