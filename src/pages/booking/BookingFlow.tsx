import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Hospital } from '@/types';
import { calculateFare, PRICING } from '@/constants/pricing';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { MapPin, Hospital as HospitalIcon, Ambulance as AmbulanceIcon, Check, AlertCircle, Search, Navigation, Loader2, LocateFixed } from 'lucide-react';
import { toast } from 'sonner';
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

function RecenterMap({ lat, lng, zoom, trigger }: { lat: number; lng: number; zoom: number; trigger: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom, { animate: true });
    setTimeout(() => map.invalidateSize(), 100);
  }, [trigger]);
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

  // Search autocomplete
  const [suggestions, setSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const geocodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const watchIdRef = useRef<number | null>(null);

  // Hospital / ambulance
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [ambulanceType, setAmbulanceType] = useState<AmbulanceType>('basic');
  const [isEmergency, setIsEmergency] = useState(false);
  const [distance, setDistance] = useState(0);
  const [fare, setFare] = useState(0);

  useEffect(() => { fetchHospitals(); }, []);

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
      const d = (selectedHospital.lat != null && selectedHospital.lng != null)
        ? haversine(pickupLat, pickupLng, selectedHospital.lat, selectedHospital.lng)
        : Math.random() * 15 + 5;
      setDistance(d);
      setFare(calculateFare(d, ambulanceType));
    }
  }, [selectedHospital, ambulanceType]);

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

  // ── GPS: get real device location ─────────────────────────────────────────
  const requestGPS = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error('GPS not supported. Tap the map or type your address.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await movePinTo(pos.coords.latitude, pos.coords.longitude, 17);
        setIsLocating(false);
      },
      (err) => {
        console.warn('GPS error:', err.code, err.message);
        toast.error(
          err.code === 1
            ? 'Location permission denied. Tap the map to set your pickup point.'
            : 'GPS unavailable. Tap the map or type your address.'
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, [movePinTo]);

  // Auto-request GPS on mount, start watch for refinement
  useEffect(() => {
    requestGPS();
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        // Only auto-update if user hasn't manually moved the pin
        if (pickupLat === DEFAULT_COORDS[0] && pickupLng === DEFAULT_COORDS[1]) {
          movePinTo(pos.coords.latitude, pos.coords.longitude, 17);
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

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
    const { data, error } = await supabase.from('hospitals').select('*').eq('approval_status', 'approved');
    if (!error && data) setHospitals(data);
  };

  const handlePickupSubmit = () => {
    if (!pickupLocation.trim()) { toast.error('Please set your pickup location'); return; }
    setStep(2);
  };

  const handleHospitalSelect = (hospital: Hospital) => { setSelectedHospital(hospital); setStep(3); };

  const handleBooking = async () => {
    if (!selectedHospital) { toast.error('Please select a hospital'); return; }
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
      destination_lat: pickupLat + (Math.random() - 0.5) * 0.1,
      destination_lng: pickupLng + (Math.random() - 0.5) * 0.1,
      distance, fare, status: 'pending', is_emergency: isEmergency,
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
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Set Pickup Location</h2>
              <p className="text-gray-500 text-sm">Search an address, tap the map, or use GPS</p>
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
                className="block w-full pl-10 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary transition-colors"
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
            <div className="relative rounded-xl overflow-hidden border-2 border-gray-200" style={{ height: '380px' }}>
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
                <MapClickHandler onMapClick={(lat, lng) => movePinTo(lat, lng, 17)} />
                <Marker
                  position={[pickupLat, pickupLng]}
                  icon={pinIcon}
                  draggable
                  eventHandlers={{
                    dragend: (e) => {
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

            <button
              onClick={handlePickupSubmit}
              disabled={!pickupLocation.trim() || isReverseGeocoding}
              className="w-full bg-primary text-white py-3 rounded-xl hover:bg-primary/90 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isReverseGeocoding ? 'Getting address...' : 'Continue to Hospital Selection'}
            </button>
          </div>
        );

      case 2: {
        const NEARBY_RADIUS_KM = 50;

        // Compute distance for every hospital
        const allWithDist = hospitals.map((h) => ({
          ...h,
          _dist: (h.lat != null && h.lng != null)
            ? haversine(pickupLat, pickupLng, h.lat, h.lng)
            : null,
        }));

        // Extract city tokens from the reverse-geocoded address for fallback matching
        const addrTokens = pickupLocation.toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);

        // A hospital is "nearby" if:
        //   - it has coords AND is within NEARBY_RADIUS_KM, OR
        //   - it has no coords BUT its city appears in the user's address string
        const nearby = allWithDist.filter((h) => {
          if (h._dist !== null) return h._dist <= NEARBY_RADIUS_KM;
          return addrTokens.some((token) => token.includes(h.city.toLowerCase()) || h.city.toLowerCase().includes(token));
        });

        // Apply search query on top
        const q = hospitalSearch.toLowerCase();
        const filtered = (hospitalSearch.trim() ? allWithDist : nearby)
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
              <button onClick={() => setStep(1)} className="text-primary hover:text-primary/90 mb-4">← Back</button>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Hospital</h2>
              <p className="text-gray-600">
                {hospitalSearch.trim()
                  ? 'Search results across all hospitals'
                  : `Hospitals within ${NEARBY_RADIUS_KM} km of your location`}
              </p>
            </div>

            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={hospitalSearch}
                onChange={(e) => setHospitalSearch(e.target.value)}
                placeholder="Search all hospitals by name or city..."
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {!hospitalSearch.trim() && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Navigation className="h-4 w-4" />
                <span>
                  {nearby.length > 0
                    ? `${nearby.length} approved hospital${nearby.length > 1 ? 's' : ''} found near your location`
                    : 'No hospitals found near your location — use the search bar to find hospitals elsewhere'}
                </span>
              </div>
            )}

            <div className="grid gap-4">
              {filtered.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <HospitalIcon className="h-10 w-10 text-gray-300 mx-auto" />
                  <p className="text-gray-500 font-medium">No hospitals found near your location</p>
                  <p className="text-sm text-gray-400">Try searching by city name above to find hospitals in other areas</p>
                </div>
              ) : (
                filtered.map((hospital) => {
                  const distLabel = hospital._dist !== null
                    ? `${hospital._dist.toFixed(1)} km away`
                    : hospital.city;
                  const isClose = hospital._dist !== null && hospital._dist <= 20;
                  return (
                    <button
                      key={hospital.id}
                      onClick={() => handleHospitalSelect(hospital)}
                      className="bg-white border-2 border-gray-200 hover:border-primary rounded-lg p-5 text-left transition-colors"
                    >
                      <div className="flex items-start space-x-4">
                        <div className="bg-red-100 rounded-full p-3 flex-shrink-0">
                          <HospitalIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-gray-900">{hospital.hospital_name}</h3>
                            {isClose && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                <Navigation className="h-3 w-3" /> Nearest
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">{hospital.city}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-400 capitalize">{hospital.hospital_type} Hospital</span>
                            <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{distLabel}
                            </span>
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
              <button
                onClick={() => setStep(2)}
                className="text-primary hover:text-primary/90 mb-4"
              >
                ← Back
              </button>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Ambulance Type</h2>
              <p className="text-gray-600">Choose the medical support level you need</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <button
                onClick={() => setAmbulanceType('basic')}
                className={`border-2 rounded-lg p-6 text-left transition-colors ${
                  ambulanceType === 'basic'
                    ? 'border-primary bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-blue-100 rounded-full p-3">
                    <AmbulanceIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  {ambulanceType === 'basic' && (
                    <Check className="h-6 w-6 text-primary" />
                  )}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {PRICING.AMBULANCE_TYPES.basic.name}
                </h3>
                <ul className="space-y-2 text-sm text-gray-600 mb-4">
                  {PRICING.AMBULANCE_TYPES.basic.features.map((feature, i) => (
                    <li key={i} className="flex items-start">
                      <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-gray-500">Base rate × 1.0</p>
              </button>

              <button
                onClick={() => setAmbulanceType('advanced')}
                className={`border-2 rounded-lg p-6 text-left transition-colors ${
                  ambulanceType === 'advanced'
                    ? 'border-primary bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-purple-100 rounded-full p-3">
                    <AmbulanceIcon className="h-6 w-6 text-purple-600" />
                  </div>
                  {ambulanceType === 'advanced' && (
                    <Check className="h-6 w-6 text-primary" />
                  )}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {PRICING.AMBULANCE_TYPES.advanced.name}
                </h3>
                <ul className="space-y-2 text-sm text-gray-600 mb-4">
                  {PRICING.AMBULANCE_TYPES.advanced.features.map((feature, i) => (
                    <li key={i} className="flex items-start">
                      <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-gray-500">Base rate × 1.5</p>
              </button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEmergency}
                    onChange={(e) => setIsEmergency(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="font-medium text-yellow-900">This is an emergency</span>
                </label>
                <p className="text-sm text-yellow-700 mt-1">
                  Emergency bookings are prioritized for faster response
                </p>
              </div>
            </div>

            {/* Fare Summary */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Fare Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Base Fare</span>
                  <span className="font-medium">₹{PRICING.BASE_FARE}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Distance ({distance.toFixed(1)} km × ₹{PRICING.PER_KM_RATE}/km)</span>
                  <span className="font-medium">₹{(distance * PRICING.PER_KM_RATE).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ambulance Type Multiplier</span>
                  <span className="font-medium">×{PRICING.AMBULANCE_TYPES[ambulanceType].multiplier}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">Total Fare</span>
                    <span className="text-2xl font-bold text-primary">₹{fare}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleBooking}
              disabled={loading}
              className="w-full bg-primary text-white py-3 rounded-lg hover:bg-primary/90 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        );

      case 4:
        return (
          <div className="text-center py-12">
            <div className="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Request Sent!</h2>
            <p className="text-lg text-gray-600 mb-8">
              Your request has been sent to the hospital. They will assign an ambulance shortly.
            </p>
            
            <div className="bg-gray-50 rounded-lg p-6 max-w-md mx-auto mb-8 text-left">
              <h3 className="font-semibold text-gray-900 mb-3">Booking Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Pickup:</span>
                  <span className="font-medium">{pickupLocation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Hospital:</span>
                  <span className="font-medium">{selectedHospital?.hospital_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ambulance Type:</span>
                  <span className="font-medium capitalize">{ambulanceType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Distance:</span>
                  <span className="font-medium">{distance.toFixed(1)} km</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-gray-900 font-semibold">Total Fare:</span>
                  <span className="text-lg font-bold text-primary">₹{fare}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/user')}
              className="bg-primary text-white px-8 py-3 rounded-lg hover:bg-primary/90 font-medium"
            >
              Go to Dashboard
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Progress Steps */}
        {step < 4 && (
          <div className="mb-12">
            <div className="flex items-center justify-between">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex-1 flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    s <= step ? 'bg-primary border-primary text-white' : 'bg-white border-gray-300 text-gray-400'
                  }`}>
                    {s < step ? <Check className="h-5 w-5" /> : s}
                  </div>
                  {s < 3 && (
                    <div className={`flex-1 h-1 mx-2 ${
                      s < step ? 'bg-primary' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-600">
              <span>Pickup</span>
              <span>Hospital</span>
              <span>Ambulance</span>
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
