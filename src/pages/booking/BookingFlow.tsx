import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Hospital, PaymentMethod } from '@/types';
import { calculateFare, PRICING } from '@/constants/pricing';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { MapPin, Hospital as HospitalIcon, Ambulance as AmbulanceIcon, Check, AlertCircle, Search, Navigation, Loader2, LocateFixed } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const DEFAULT_COORDS: [number, number] = [20.5937, 78.9629];

// Draggable marker icon
const pinIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:32px;height:42px">
    <svg viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:32px;height:42px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 26 16 26s16-16 16-26C32 7.163 24.837 0 16 0z" fill="#ef4444"/>
      <circle cx="16" cy="16" r="7" fill="white"/>
    </svg>
  </div>`,
  iconSize: [32, 42],
  iconAnchor: [16, 42],
  popupAnchor: [0, -42],
});

const hospitalMarkerIcon = L.divIcon({
  className: 'nearby-hospital-marker',
  html: '<div class="h-4 w-4 rounded-full bg-emerald-600 border-2 border-white shadow"></div>',
});

const selectedHospitalMarkerIcon = L.divIcon({
  className: 'selected-hospital-marker',
  html: '<div class="h-4 w-4 rounded-full bg-primary border-2 border-white shadow"></div>',
});

function RecenterMap({ lat, lng, zoom, trigger }: { lat: number; lng: number; zoom: number; trigger: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom, { animate: true });
    setTimeout(() => map.invalidateSize(), 100);
  }, [lat, lng, map, trigger, zoom]);
  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

type AmbulanceType = 'basic' | 'advanced';

export default function BookingFlow() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Location state
  const [pickupLocation, setPickupLocation] = useState('');
  const [pickupLat, setPickupLat] = useState(DEFAULT_COORDS[0]);
  const [pickupLng, setPickupLng] = useState(DEFAULT_COORDS[1]);
  const [isLocating, setIsLocating] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [mapTrigger, setMapTrigger] = useState(0);
  const [mapZoom, setMapZoom] = useState(5);
  const [gpsMeta, setGpsMeta] = useState<{ lat: number; lng: number; accuracy: number; ts: number } | null>(null);

  // Search autocomplete
  const [suggestions, setSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const geocodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const watchIdRef = useRef<number | null>(null);
  const pickupLockedRef = useRef(false);
  const lastAutoMoveRef = useRef(0);
  const hasInitialGPSFixRef = useRef(false);
  const bestAccuracyRef = useRef<number | null>(null);

  // Hospital / ambulance
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hospitalCoordOverrides, setHospitalCoordOverrides] = useState<Record<string, { lat: number; lng: number }>>({});
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [resolvingHospitalId, setResolvingHospitalId] = useState<string | null>(null);
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [ambulanceType, setAmbulanceType] = useState<AmbulanceType>('basic');
  const [isEmergency, setIsEmergency] = useState(false);
  const [distance, setDistance] = useState(0);
  const [fare, setFare] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  const geocodeHospitalsInFlightRef = useRef(false);

  useEffect(() => { fetchHospitals(); }, []);

  const getResolvedHospitalCoords = useCallback((h: Hospital): { lat: number; lng: number } | null => {
    if (h.lat != null && h.lng != null) return { lat: h.lat, lng: h.lng };
    const override = hospitalCoordOverrides[h.id];
    return override ? { lat: override.lat, lng: override.lng } : null;
  }, [hospitalCoordOverrides]);

  const geocodeHospitalCoords = useCallback(async (h: Hospital): Promise<{ lat: number; lng: number } | null> => {
    try {
      const queries = [
        `${h.hospital_name}, ${h.address ?? ''}, ${h.city}, India`,
        `${h.hospital_name}, ${h.city}, India`,
        `${h.address ?? ''}, ${h.city}, India`,
        `${h.city}, India`,
      ].map((q) => q.replace(/\s+/g, ' ').trim()).filter((q) => q.length >= 3);

      for (const query of queries) {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=in`,
          { headers: { 'Accept-Language': 'en', 'User-Agent': 'ambulance-booking/1.0' } }
        );
        const data = await res.json();
        const hit = Array.isArray(data) ? data[0] : null;
        if (!hit?.lat || !hit?.lon) continue;
        const lat = parseFloat(hit.lat);
        const lng = parseFloat(hit.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        return { lat, lng };
      }

      return null;
    } catch {
      return null;
    }
  }, []);

  // Resolve missing hospital coordinates (so we can compute distances + allow selection)
  useEffect(() => {
    if (step !== 2) return;
    if (geocodeHospitalsInFlightRef.current) return;

    const missing = hospitals
      .filter((h) => (h.lat == null || h.lng == null) && !hospitalCoordOverrides[h.id]);

    if (missing.length === 0) return;

    geocodeHospitalsInFlightRef.current = true;
    let cancelled = false;

    (async () => {
      for (const h of missing) {
        if (cancelled) break;
        const coords = await geocodeHospitalCoords(h);
        if (coords) {
          setHospitalCoordOverrides((prev) => ({
            ...prev,
            [h.id]: coords,
          }));
        }
        // Be polite to Nominatim rate limits
        await new Promise((r) => setTimeout(r, 1100));
      }
      geocodeHospitalsInFlightRef.current = false;
    })();

    return () => {
      cancelled = true;
      geocodeHospitalsInFlightRef.current = false;
    };
  }, [geocodeHospitalCoords, hospitalCoordOverrides, hospitals, step]);

  // Haversine distance in km between two lat/lng points
  const haversine = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  useEffect(() => {
    if (searchParams.get('emergency') === '1') setIsEmergency(true);
  }, [searchParams]);

  useEffect(() => {
    if (selectedHospital) {
      const coords = getResolvedHospitalCoords(selectedHospital);
      const d = coords ? haversine(pickupLat, pickupLng, coords.lat, coords.lng) : 0;
      setDistance(d);
      setFare(calculateFare(d, ambulanceType));
    }
  }, [selectedHospital, ambulanceType, pickupLat, pickupLng, getResolvedHospitalCoords]);

  // ── Reverse geocode: coords → address string ──────────────────────────────
  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'ambulance-booking/1.0' } }
      );
      const data = await res.json();
      return data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }, []);

  // ── Move pin to coords, reverse geocode, update address box ───────────────
  const movePinTo = useCallback(async (lat: number, lng: number, zoom = 16) => {
    setPickupLat(lat);
    setPickupLng(lng);
    setMapZoom(zoom);
    setMapTrigger((t) => t + 1);
    setIsReverseGeocoding(true);
    const address = await reverseGeocode(lat, lng);
    setPickupLocation(address);
    setIsReverseGeocoding(false);
  }, [reverseGeocode]);

  const getDeviceLocation = useCallback((opts: PositionOptions) => {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, opts);
    });
  }, []);

  // ── GPS: get real device location ─────────────────────────────────────────
  const requestGPS = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error('GPS not supported. Tap the map or type your address.');
      return;
    }

    // Geolocation requires a secure context (HTTPS) except localhost.
    if (!window.isSecureContext) {
      toast.error('Location needs HTTPS (or localhost). Open the app on https:// or http://localhost.');
      return;
    }

    pickupLockedRef.current = false;
    setIsLocating(true);
    try {
      // High accuracy first: avoids showing an unrelated coarse location.
      const pos = await getDeviceLocation({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
      bestAccuracyRef.current = pos.coords.accuracy;
      setGpsMeta({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        ts: Date.now(),
      });
      await movePinTo(pos.coords.latitude, pos.coords.longitude, 17);
      hasInitialGPSFixRef.current = true;

      if (pos.coords.accuracy > 300) {
        toast.info(
          `Location accuracy is ~${Math.round(pos.coords.accuracy)}m. Enable precise location / device location services for better accuracy.`,
          { duration: 7000 }
        );
      }
    } catch (err) {
      const e = err as GeolocationPositionError;
      console.warn('GPS error:', e?.code, e?.message);

      // Fallback: allow cached/network-based location if high accuracy fails.
      try {
        const fallback = await getDeviceLocation({ enableHighAccuracy: false, timeout: 30000, maximumAge: 60000 });
        if (fallback.coords.accuracy <= 5000) {
          bestAccuracyRef.current = fallback.coords.accuracy;
          setGpsMeta({
            lat: fallback.coords.latitude,
            lng: fallback.coords.longitude,
            accuracy: fallback.coords.accuracy,
            ts: Date.now(),
          });
          await movePinTo(
            fallback.coords.latitude,
            fallback.coords.longitude,
            fallback.coords.accuracy <= 1000 ? 16 : 14
          );
          hasInitialGPSFixRef.current = true;
        } else {
          toast.error('Location is too inaccurate right now. Tap the map to set your pickup point.');
        }
      } catch (fallbackErr) {
        const fe = fallbackErr as GeolocationPositionError;
        toast.error(
          fe?.code === 1
            ? 'Location permission denied. Tap the map to set your pickup point.'
            : 'Unable to fetch GPS location. Tap the map or type your address.'
        );
      }
    } finally {
      setIsLocating(false);
    }
  }, [movePinTo]);

  // Auto-request GPS on mount, start watch for refinement
  useEffect(() => {
    requestGPS();
    if (!navigator.geolocation) return;
    if (!window.isSecureContext) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (pickupLockedRef.current) return;

        // Only apply updates when accuracy improves (prevents jumping to worse locations).
        const nextAccuracy = pos.coords.accuracy;
        const bestAccuracy = bestAccuracyRef.current;
        if (bestAccuracy != null && nextAccuracy != null) {
          const improvedEnough = nextAccuracy < bestAccuracy * 0.85;
          if (!improvedEnough) return;
        }

        const now = Date.now();
        if (now - lastAutoMoveRef.current < 6000) return;
        lastAutoMoveRef.current = now;
        if (!hasInitialGPSFixRef.current) hasInitialGPSFixRef.current = true;

        bestAccuracyRef.current = nextAccuracy;
        setGpsMeta({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          ts: Date.now(),
        });
        movePinTo(pos.coords.latitude, pos.coords.longitude, 17);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 }
    );
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [movePinTo, requestGPS]);

  // ── Forward geocode: text → suggestions ───────────────────────────────────
  const forwardGeocode = useCallback(async (query: string) => {
    if (query.trim().length < 3) { setSuggestions([]); return; }
    setIsGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'ambulance-booking/1.0' } }
      );
      const data = await res.json();
      setSuggestions(data || []);
      setShowSuggestions((data || []).length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  const handleAddressInput = (value: string) => {
    setPickupLocation(value);
    if (geocodeDebounceRef.current) clearTimeout(geocodeDebounceRef.current);
    if (value.trim().length >= 3) {
      geocodeDebounceRef.current = setTimeout(() => forwardGeocode(value), 500);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionSelect = async (s: { display_name: string; lat: string; lon: string }) => {
    pickupLockedRef.current = true;
    setSuggestions([]);
    setShowSuggestions(false);
    await movePinTo(parseFloat(s.lat), parseFloat(s.lon), 16);
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node))
        setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchHospitals = async () => {
    const { data, error } = await supabase
      .from('hospitals')
      .select('*')
      .eq('approval_status', 'approved');

    if (!error && data) {
      setHospitals(data);
      return;
    }

    // Fallback: booking users may not have direct SELECT on hospitals (RLS).
    // Use the SECURITY DEFINER function that returns approved hospitals.
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_approved_hospitals');
    if (rpcError) {
      console.error('Failed to load hospitals:', error ?? rpcError);
      toast.error('Unable to load hospitals. Please try again later.');
      return;
    }

    const mapped = (rpcData ?? []).map((h: any) => {
      const hospitalType = h.hospital_type === 'government' ? 'government' : 'private';
      return {
        id: h.id,
        profile_id: '',
        hospital_name: h.hospital_name,
        address: h.address ?? null,
        city: h.city,
        hospital_type: hospitalType,
        approval_status: 'approved',
        lat: typeof h.lat === 'number' ? h.lat : (h.lat != null ? Number(h.lat) : null),
        lng: typeof h.lng === 'number' ? h.lng : (h.lng != null ? Number(h.lng) : null),
        created_at: new Date().toISOString(),
      } satisfies Hospital;
    });

    setHospitals(mapped as Hospital[]);
  };

  const handlePickupSubmit = () => {
    if (!pickupLocation.trim()) { toast.error('Please set your pickup location'); return; }
    setStep(2);
  };

  const handleHospitalSelect = async (hospital: Hospital) => {
    // Always allow clicking any hospital. If coordinates are missing, resolve them on-demand.
    const existing = getResolvedHospitalCoords(hospital);
    if (existing) {
      setSelectedHospital({ ...hospital, lat: existing.lat, lng: existing.lng });
      setStep(3);
      return;
    }

    try {
      setResolvingHospitalId(hospital.id);
      const coords = await geocodeHospitalCoords(hospital);
      if (!coords) {
        toast.error('Unable to resolve this hospital location. Please try another hospital.');
        return;
      }

      setHospitalCoordOverrides((prev) => ({
        ...prev,
        [hospital.id]: coords,
      }));

      setSelectedHospital({ ...hospital, lat: coords.lat, lng: coords.lng });
      setStep(3);
    } finally {
      setResolvingHospitalId(null);
    }
  };

  const handleBooking = async () => {
    if (!selectedHospital) { toast.error('Please select a hospital'); return; }
    const dest = getResolvedHospitalCoords(selectedHospital);
    if (!dest) {
      toast.error('This hospital location is not configured yet. Please select a different hospital.');
      return;
    }
    setLoading(true);
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) { toast.error('You must be logged in to book'); setLoading(false); return; }
    const { error } = await supabase.from('bookings').insert({
      user_id: authUser.id,
      driver_id: null, ambulance_id: null,
      hospital_id: selectedHospital.id,
      pickup_location: pickupLocation,
      pickup_lat: pickupLat, pickup_lng: pickupLng,
      destination: selectedHospital.hospital_name,
      destination_lat: dest.lat,
      destination_lng: dest.lng,
      distance, fare, status: 'pending', is_emergency: isEmergency,
      payment_method: paymentMethod,
      payment_status: 'pending',
    });
    if (error) { console.error('Booking error:', error); toast.error(`Booking failed: ${error.message}`); setLoading(false); return; }
    toast.success('Booking request sent to hospital!');
    setStep(4);
    setLoading(false);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-1">📍 Set Pickup Location</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Search an address, tap the map, or use GPS</p>
            </div>

            {/* Search box with autocomplete */}
            <div className="relative" ref={suggestionsRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10 pointer-events-none" />
              {(isGeocoding || isReverseGeocoding) && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin z-10" />
              )}
              <input
                type="text"
                value={pickupLocation}
                onChange={(e) => handleAddressInput(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                className="block w-full pl-10 pr-10 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:border-red-400 dark:focus:border-red-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 transition-colors"
                placeholder="Search your pickup address..."
                autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                  {suggestions.map((s, i) => (
                    <li
                      key={i}
                      onMouseDown={() => handleSuggestionSelect(s)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-red-50 cursor-pointer border-b last:border-b-0 border-gray-100"
                    >
                      <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700 leading-snug">{s.display_name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Map with draggable pin */}
            <div className="relative rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-gray-700" style={{ height: '380px' }}>
              <MapContainer
                center={[pickupLat, pickupLng]}
                zoom={mapZoom}
                style={{ height: '100%', width: '100%' }}
                whenReady={(m) => setTimeout(() => m.target.invalidateSize(), 200)}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />
                <RecenterMap lat={pickupLat} lng={pickupLng} zoom={mapZoom} trigger={mapTrigger} />
                <MapClickHandler onMapClick={(lat, lng) => { pickupLockedRef.current = true; movePinTo(lat, lng, 17); }} />
                <Marker
                  position={[pickupLat, pickupLng]}
                  icon={pinIcon}
                  draggable
                  eventHandlers={{
                    dragend: (e) => {
                      pickupLockedRef.current = true;
                      const { lat, lng } = (e.target as L.Marker).getLatLng();
                      movePinTo(lat, lng, 17);
                    },
                  }}
                >
                  <Popup>Drag me to adjust your pickup point</Popup>
                </Marker>
              </MapContainer>

              {/* GPS button overlay */}
              <button
                type="button"
                onClick={requestGPS}
                disabled={isLocating}
                className="absolute bottom-4 right-4 z-[1000] bg-white shadow-lg border border-gray-200 rounded-full p-3 hover:bg-gray-50 disabled:opacity-60 transition-all"
                title="Use my GPS location"
              >
                {isLocating
                  ? <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  : <LocateFixed className="h-5 w-5 text-primary" />
                }
              </button>

              {/* Hint overlay */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-black/60 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
                Tap map or drag pin to set location
              </div>
            </div>

            {/* GPS diagnostics */}
            <div className="text-xs text-gray-500">
              {gpsMeta ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    GPS: {gpsMeta.lat.toFixed(5)}, {gpsMeta.lng.toFixed(5)}
                  </span>
                  <span>
                    Accuracy: ~{Math.round(gpsMeta.accuracy)}m
                  </span>
                  <span>
                    Updated: {new Date(gpsMeta.ts).toLocaleTimeString()}
                  </span>
                </div>
              ) : (
                <span>GPS: waiting for device location…</span>
              )}
            </div>

            <button
              onClick={handlePickupSubmit}
              disabled={!pickupLocation.trim() || isReverseGeocoding}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-px active:scale-[0.98] shadow-lg shadow-red-200 dark:shadow-red-900/30"
            >
              {isReverseGeocoding ? 'Getting address...' : 'Continue to Hospital Selection →'}
            </button>
          </div>
        );

      case 2: {
        // Compute distance for every hospital
        const allWithDist = hospitals.map((h) => ({
          ...h,
          _dist: (() => {
            const coords = getResolvedHospitalCoords(h);
            return coords ? haversine(pickupLat, pickupLng, coords.lat, coords.lng) : null;
          })(),
        }));

        // Apply search query on top
        const q = hospitalSearch.toLowerCase();
          const filtered = allWithDist
            .filter((h) => !hospitalSearch.trim() || h.hospital_name.toLowerCase().includes(q) || h.city.toLowerCase().includes(q))
            .sort((a, b) => {
              if (a._dist !== null && b._dist !== null) return a._dist - b._dist;
              if (a._dist !== null) return -1;
              if (b._dist !== null) return 1;
              return a.hospital_name.localeCompare(b.hospital_name);
            });

        return (
          <div className="space-y-6">
            <div>
              <button onClick={() => setStep(1)} className="text-red-600 hover:text-red-700 mb-4 text-sm font-medium flex items-center gap-1">← Back</button>
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-1">🏥 Select Hospital</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {hospitalSearch.trim()
                    ? 'Search results (sorted by distance)'
                    : 'All approved hospitals (sorted by nearest first)'}
              </p>
            </div>

            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={hospitalSearch}
                onChange={(e) => setHospitalSearch(e.target.value)}
                placeholder="Search hospitals by name or city..."
                className="block w-full pl-10 pr-3 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:border-red-400 dark:focus:border-red-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 transition-colors"
              />
            </div>

            {/* Nearby hospitals on map */}
            <div className="relative rounded-xl overflow-hidden border border-gray-200" style={{ height: '340px' }}>
              <MapContainer
                center={[pickupLat, pickupLng]}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
                whenReady={(m) => setTimeout(() => m.target.invalidateSize(), 200)}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />
                <Marker position={[pickupLat, pickupLng]} icon={pinIcon}>
                  <Popup>Your pickup location</Popup>
                </Marker>
                  {filtered
                    .filter((h) => getResolvedHospitalCoords(h as Hospital) !== null)
                    .slice(0, 30)
                  .map((h) => (
                    <Marker
                      key={h.id}
                        position={[getResolvedHospitalCoords(h as Hospital)!.lat, getResolvedHospitalCoords(h as Hospital)!.lng]}
                      icon={selectedHospital?.id === h.id ? selectedHospitalMarkerIcon : hospitalMarkerIcon}
                    >
                      <Popup>
                        <div className="space-y-2">
                          <div className="font-semibold text-gray-900">{h.hospital_name}</div>
                          <div className="text-xs text-gray-600">{h.city}</div>
                          {h._dist != null && (
                            <div className="text-xs font-medium text-blue-600">{h._dist.toFixed(1)} km away</div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleHospitalSelect(h as Hospital)}
                            className="w-full bg-primary text-white rounded-md px-3 py-2 text-sm font-medium hover:bg-primary/90"
                          >
                            Select hospital
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
            </div>

            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <Navigation className="h-4 w-4" />
              <span>
                {filtered.length} approved hospital{filtered.length !== 1 ? 's' : ''} found
                {hospitalSearch.trim() ? ' (filtered)' : ''}
              </span>
            </div>

            <div className="grid gap-3">
              {filtered.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto">
                    <HospitalIcon className="h-7 w-7 text-gray-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No hospitals found</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Try searching by hospital name or city</p>
                </div>
              ) : (
                filtered.map((hospital) => {
                  const distLabel = hospital._dist !== null
                    ? `${hospital._dist.toFixed(1)} km away`
                    : hospital.city;
                  const isClose = hospital._dist !== null && hospital._dist <= 20;
                  const hasCoords = getResolvedHospitalCoords(hospital as Hospital) !== null;
                  const isResolving = resolvingHospitalId === hospital.id && !hasCoords;
                  return (
                    <button
                      key={hospital.id}
                      onClick={() => void handleHospitalSelect(hospital)}
                      className="bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl p-5 text-left transition-all hover:border-red-300 dark:hover:border-red-700 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60"
                      disabled={isResolving}
                    >
                      <div className="flex items-start gap-4">
                        <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-3 flex-shrink-0">
                          <HospitalIcon className="h-6 w-6 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">{hospital.hospital_name}</h3>
                            {isClose && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                <Navigation className="h-3 w-3" /> Nearest
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{hospital.city}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">{hospital.hospital_type}</span>
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{distLabel}
                            </span>
                            {isResolving && (
                              <span className="text-xs text-gray-400 inline-flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" /> Resolving…
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      }

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <button onClick={() => setStep(2)} className="text-red-600 hover:text-red-700 mb-4 text-sm font-medium flex items-center gap-1">
                ← Back
              </button>
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-1">🚑 Select Ambulance Type</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Choose the medical support level you need</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {(['basic', 'advanced'] as const).map((type) => {
                const t = PRICING.AMBULANCE_TYPES[type];
                const selected = ambulanceType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setAmbulanceType(type)}
                    className={`border-2 rounded-2xl p-6 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
                      selected
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/10 shadow-md shadow-red-100 dark:shadow-red-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`rounded-2xl p-3 ${type === 'basic' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-purple-100 dark:bg-purple-900/30'}`}>
                        <AmbulanceIcon className={`h-6 w-6 ${type === 'basic' ? 'text-blue-600' : 'text-purple-600'}`} />
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        selected ? 'border-red-500 bg-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {selected && <Check className="h-3.5 w-3.5 text-white" />}
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{t.name}</h3>
                    <ul className="space-y-1.5 mb-4">
                      {t.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Rate: ₹{PRICING.PER_KM_RATE}/km</p>
                  </button>
                );
              })}
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <label className="flex items-start gap-3 cursor-pointer flex-1">
                <input type="checkbox" checked={isEmergency} onChange={(e) => setIsEmergency(e.target.checked)} className="mt-1 accent-red-600" />
                <div>
                  <span className="font-semibold text-amber-900 dark:text-amber-200">This is an emergency</span>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">Emergency bookings are prioritized for faster response</p>
                </div>
              </label>
            </div>

            {/* Fare Summary */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Fare Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Base Fare</span><span className="font-medium text-gray-900 dark:text-white">₹{PRICING.BASE_FARE}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Distance ({distance.toFixed(1)} km × ₹{PRICING.PER_KM_RATE}/km)</span>
                  <span className="font-medium text-gray-900 dark:text-white">₹{(distance * PRICING.PER_KM_RATE).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Multiplier</span><span className="font-medium text-gray-900 dark:text-white">×{PRICING.AMBULANCE_TYPES[ambulanceType].multiplier}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-2 flex justify-between items-center">
                  <span className="font-bold text-gray-900 dark:text-white">Total Fare</span>
                  <span className="text-2xl font-extrabold text-red-600">₹{fare}</span>
                </div>
              </div>
            </div>

            {/* Payment method */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Payment Method</h3>
              <div className="space-y-3">
                {[{ value: 'cash', label: 'Cash', desc: 'Pay the driver on drop completion.' }, { value: 'in_app', label: 'In-App (Simulated)', desc: 'Marked paid when trip completes.' }].map(opt => (
                  <label key={opt.value} className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border-2 transition-all ${
                    paymentMethod === opt.value ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-100 dark:border-gray-700 hover:border-gray-200'
                  }`}>
                    <input type="radio" name="payment_method" value={opt.value} checked={paymentMethod === opt.value as PaymentMethod} onChange={() => setPaymentMethod(opt.value as PaymentMethod)} className="mt-1 accent-red-600" />
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white text-sm">{opt.label}</div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleBooking}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-px active:scale-[0.98] shadow-lg shadow-red-200 dark:shadow-red-900/30"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Confirming Booking...
                </span>
              ) : '🚑 Confirm Booking'}
            </button>
          </div>
        );

      case 4:
        return (
          <div className="text-center py-10">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-200 dark:shadow-green-900/30"
            >
              <Check className="h-12 w-12 text-white" />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">🚑 Request Sent!</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">
                Your request has been sent to the hospital. An ambulance will be assigned shortly.
              </p>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-6 max-w-md mx-auto mb-8 text-left border border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wide">Booking Summary</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Pickup', value: pickupLocation },
                    { label: 'Hospital', value: selectedHospital?.hospital_name },
                    { label: 'Ambulance', value: ambulanceType === 'basic' ? 'Basic Life Support' : 'Advanced Life Support' },
                    { label: 'Distance', value: `${distance.toFixed(1)} km` },
                    { label: 'Payment', value: paymentMethod === 'cash' ? 'Cash' : 'In-App' },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">{item.label}</span>
                      <span className="font-semibold text-gray-900 dark:text-white text-right max-w-[200px] truncate">{item.value}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-3 flex justify-between items-center">
                    <span className="font-bold text-gray-900 dark:text-white">Total Fare</span>
                    <span className="text-2xl font-extrabold text-red-600">₹{fare}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate('/user')}
                className="bg-red-600 hover:bg-red-700 text-white px-10 py-4 rounded-2xl font-bold text-base transition-all hover:-translate-y-px active:scale-[0.98] shadow-lg shadow-red-200 dark:shadow-red-900/30"
              >
                Go to Dashboard
              </button>
            </motion.div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Progress Steps */}
        {step < 4 && (
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex-1 flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-2xl text-sm font-bold transition-all ${
                    s < step ? 'bg-green-500 text-white shadow-md shadow-green-200 dark:shadow-green-900/30'
                    : s === step ? 'bg-red-600 text-white shadow-md shadow-red-200 dark:shadow-red-900/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                  }`}>
                    {s < step ? <Check className="h-5 w-5" /> : s}
                  </div>
                  {s < 3 && (
                    <div className={`flex-1 h-1 mx-3 rounded-full transition-all ${
                      s < step ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <span className={step === 1 ? 'text-red-600' : ''}>Pickup</span>
              <span className={step === 2 ? 'text-red-600' : ''}>Hospital</span>
              <span className={step === 3 ? 'text-red-600' : ''}>Ambulance</span>
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 sm:p-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
