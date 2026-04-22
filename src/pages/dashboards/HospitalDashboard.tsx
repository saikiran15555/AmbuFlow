import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Hospital, Driver, Ambulance, Booking } from '@/types';
import { formatDate, getStatusColor } from '@/lib/utils';
import { DollarSign, IndianRupee, Ambulance as AmbulanceIcon, Users, Activity, Bell, MapPin, Phone, Map } from 'lucide-react';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ── Map icons ────────────────────────────────────────────────────────────────
const driverIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:44px;height:44px">
    <div style="position:absolute;inset:0;background:rgba(220,38,38,0.25);border-radius:50%;animation:ping 1.4s ease-out infinite"></div>
    <div style="position:absolute;inset:5px;background:#DC2626;border-radius:50%;border:3px solid white;box-shadow:0 4px 14px rgba(220,38,38,0.55);display:flex;align-items:center;justify-content:center">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
    </div>
  </div>`,
  iconSize: [44, 44], iconAnchor: [22, 22],
});

const pickupIcon = L.divIcon({
  className: '',
  html: `<div style="width:34px;height:34px;background:#3B82F6;border-radius:50%;border:3px solid white;box-shadow:0 4px 12px rgba(59,130,246,0.5);display:flex;align-items:center;justify-content:center">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
  </div>`,
  iconSize: [34, 34], iconAnchor: [17, 34],
});

const destIcon = L.divIcon({
  className: '',
  html: `<div style="width:34px;height:34px;background:#10B981;border-radius:50%;border:3px solid white;box-shadow:0 4px 12px rgba(16,185,129,0.5);display:flex;align-items:center;justify-content:center">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
  </div>`,
  iconSize: [34, 34], iconAnchor: [17, 34],
});

const hospitalSelfIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:46px;height:46px">
    <div style="position:absolute;inset:0;background:rgba(124,58,237,0.2);border-radius:50%;animation:ping 2s ease-out infinite"></div>
    <div style="position:absolute;inset:5px;background:#7C3AED;border-radius:50%;border:3px solid white;box-shadow:0 4px 16px rgba(124,58,237,0.55);display:flex;align-items:center;justify-content:center">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>
    </div>
  </div>`,
  iconSize: [46, 46], iconAnchor: [23, 23],
});

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  const keyRef = useCallback((k: string) => k, []);
  const prevKey = useCallback(() => '', []);
  useEffect(() => {
    if (!coords.length) return;
    if (coords.length >= 2) {
      map.fitBounds(L.latLngBounds(coords), { padding: [48, 48], animate: true, maxZoom: 15 });
    } else {
      map.setView(coords[0], 14, { animate: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(coords)]);
  return null;
}

export default function HospitalDashboard() {
  const { profile } = useAuth();
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [driverLocations, setDriverLocations] = useState<Record<string, { lat: number; lng: number }>>({});
  const [stats, setStats] = useState({
    driversCount: 0,
    activeBookingsCount: 0,
    totalRevenue: 0,
  });

  const getDriverById = (driverId?: string | null) =>
    driverId ? drivers.find((driver) => driver.id === driverId) || null : null;

  const normalizeProfile = useCallback(
    (profile?: Driver['profile'] | Driver['profile'][] | null) =>
      Array.isArray(profile) ? profile[0] ?? undefined : profile ?? undefined,
    []
  );

  const normalizeDriver = useCallback(
    <T extends Partial<Driver>>(driver: T): T => ({
      ...driver,
      profile: normalizeProfile(driver.profile),
    }),
    [normalizeProfile]
  );

  const getDriverDisplayName = (driver?: Partial<Driver> | null) =>
    (driver as any)?.full_name || driver?.profile?.full_name || 'Unknown Driver';

  const getDriverDisplayPhone = (driver?: Partial<Driver> | null) =>
    (driver as any)?.phone || driver?.profile?.phone || '—';

  const getDriverName = (booking: Booking) => {
    const resolvedDriver = booking.driver || getDriverById(booking.driver_id);
    return getDriverDisplayName(resolvedDriver);
  };

  const getDriverPhone = (booking: Booking) => {
    const resolvedDriver = booking.driver || getDriverById(booking.driver_id);
    return getDriverDisplayPhone(resolvedDriver);
  };

const fetchHospitalRequests = useCallback(async (hospitalId: string) => {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        driver:drivers!bookings_driver_id_fkey(
          *,
          profile:profiles(full_name, phone)
        )
      `)
      .eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false });

    console.log('Hospital dashboard bookings response:', data);

    if (error) {
      console.error('fetchHospitalRequests error:', error);
      setRequestsError(error.message);
      toast.error(error.message);
      return [];
    }

    setRequestsError(null);

    data?.forEach((booking) => {
      if (booking.driver_id && !booking.driver) {
        console.warn(
          'Booking driver relation returned null. Check bookings.driver_id -> drivers.id foreign key and RLS.',
          {
            bookingId: booking.id,
            driverId: booking.driver_id,
          }
        );
      }
    });

    return ((data as Booking[]) || []).map((booking) => ({
      ...booking,
      driver: booking.driver ? normalizeDriver(booking.driver) : booking.driver,
    }));
  }, [normalizeDriver]);

  const fetchHospitalMetrics = useCallback(async (hospitalId: string) => {
    const [
      driversCountResult,
      activeBookingsCountResult,
      completedBookingsResult,
    ] = await Promise.all([
      supabase
        .from('drivers')
        .select('id', { count: 'exact', head: true })
        .eq('hospital_id', hospitalId),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('hospital_id', hospitalId)
        .in('status', ['pending', 'accepted', 'arrived', 'picked_up']),
      supabase
        .from('bookings')
        .select('fare')
        .eq('hospital_id', hospitalId)
        .eq('status', 'completed'),
    ]);

    if (driversCountResult.error) {
      console.error('fetchHospitalMetrics drivers count error:', driversCountResult.error.message);
    }

    if (activeBookingsCountResult.error) {
      console.error('fetchHospitalMetrics active bookings count error:', activeBookingsCountResult.error.message);
    }

    if (completedBookingsResult.error) {
      console.error('fetchHospitalMetrics completed bookings error:', completedBookingsResult.error.message);
    }

    const totalRevenue = (completedBookingsResult.data || []).reduce(
      (sum, booking) => sum + (booking.fare || 0),
      0
    );

    setStats({
      driversCount: driversCountResult.count || 0,
      activeBookingsCount: activeBookingsCountResult.count || 0,
      totalRevenue,
    });
  }, []);

  const fetchDrivers = useCallback(async (hospitalId: string) => {
    const { data: driverRows, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('hospital_id', hospitalId);

    if (error) {
      console.error('fetchDrivers error:', error);
      toast.error(error.message);
      return null;
    }

    if (!driverRows || driverRows.length === 0) return [] as Driver[];

    // For drivers missing phone/full_name, try fetching from profiles (role=driver)
    const missingIds = driverRows
      .filter((d) => !d.phone || !d.full_name)
      .map((d) => d.profile_id)
      .filter(Boolean);

    const phoneMap: Record<string, { phone: string; full_name: string }> = {};

    if (missingIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id, phone, full_name')
        .eq('role', 'driver')
        .in('id', missingIds);

      if (profileError) {
        console.warn('Could not fetch driver profiles (RLS may block this):', profileError.message);
      }

      (profileRows || []).forEach((p) => {
        phoneMap[p.id] = { phone: p.phone, full_name: p.full_name };
      });

      // Backfill phone/full_name into drivers rows so future fetches work
      for (const d of driverRows.filter((d) => !d.phone || !d.full_name)) {
        const profileData = phoneMap[d.profile_id];
        if (profileData) {
          await supabase
            .from('drivers')
            .update({
              phone: d.phone || profileData.phone || null,
              full_name: d.full_name || profileData.full_name || null,
            })
            .eq('id', d.id);
        }
      }
    }

    return driverRows.map((d) => ({
      ...d,
      full_name: d.full_name || phoneMap[d.profile_id]?.full_name || null,
      phone: d.phone || phoneMap[d.profile_id]?.phone || null,
    })) as Driver[];
  }, []);

  const fetchAmbulances = useCallback(async (hospitalId: string) => {
    const { data, error } = await supabase
      .from('ambulances')
      .select('*')
      .eq('hospital_id', hospitalId);

    if (error) {
      console.error('fetchAmbulances error:', error);
      toast.error(error.message);
      return null;
    }

    return (data as Ambulance[]) || [];
  }, []);

  const fetchHospitalData = useCallback(async (userId: string) => {
    try {
      const { data: hospitalData, error: hospitalDataError } = await supabase
        .from('hospitals')
        .select('*')
        .eq('profile_id', userId)
        .maybeSingle();

      if (hospitalDataError) {
        console.error('Error fetching hospital data:', hospitalDataError);
        setRequestsError(hospitalDataError.message);
        return;
      }

      if (!hospitalData) {
        setRequestsError('No hospital record is linked to this account.');
        return;
      }

      setRequestsError(null);
      setHospital(hospitalData);

      const [driversResult, ambulancesResult, bookingsResult] = await Promise.all([
        fetchDrivers(hospitalData.id),
        fetchAmbulances(hospitalData.id),
        fetchHospitalRequests(hospitalData.id),
      ]);

      await fetchHospitalMetrics(hospitalData.id);

      if (driversResult) setDrivers(driversResult);
      if (ambulancesResult) setAmbulances(ambulancesResult);
      setBookings(bookingsResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load hospital data';
      console.error('fetchHospitalData unexpected error:', error);
      setRequestsError(message);
    }
  }, [fetchAmbulances, fetchDrivers, fetchHospitalMetrics, fetchHospitalRequests]);

  useEffect(() => {
    if (!profile?.id) return;
    setLoading(true);
    fetchHospitalData(profile.id).finally(() => setLoading(false));
  }, [profile?.id]);

  const hospitalId = hospital?.id;

  useEffect(() => {
    if (!hospitalId) return;

    const channel = supabase
      .channel(`hospital_dashboard_${hospitalId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'drivers',
        filter: `hospital_id=eq.${hospitalId}`,
      }, () => {
        fetchDrivers(hospitalId).then((data) => {
          if (data) {
            setDrivers(data);
            void fetchHospitalMetrics(hospitalId);
          }
        });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ambulances',
        filter: `hospital_id=eq.${hospitalId}`,
      }, () => {
        fetchAmbulances(hospitalId).then((data) => {
          if (data) setAmbulances(data);
        });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `hospital_id=eq.${hospitalId}`,
      }, () => {
        fetchHospitalRequests(hospitalId).then((data) => {
          setBookings(data);
          void fetchHospitalMetrics(hospitalId);
        });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'hospitals',
        filter: `id=eq.${hospitalId}`,
      }, async () => {
        if (profile?.id) await fetchHospitalData(profile.id);
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [hospitalId]);

  // Poll driver locations every 5s for active trips
  useEffect(() => {
    const activeDriverIds = bookings
      .filter(b => ['accepted', 'arrived', 'picked_up'].includes(b.status) && b.driver_id)
      .map(b => b.driver_id!);
    if (!activeDriverIds.length) return;

    const poll = async () => {
      const { data } = await supabase
        .from('drivers')
        .select('id, current_lat, current_lng')
        .in('id', activeDriverIds);
      if (data) {
        const locs: Record<string, { lat: number; lng: number }> = {};
        data.forEach(d => {
          if (d.current_lat != null && d.current_lng != null)
            locs[d.id] = { lat: d.current_lat, lng: d.current_lng };
        });
        setDriverLocations(locs);
      }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [bookings]);

  const handleAssignDriver = async (bookingId: string, driverId: string) => {
    setAssigningId(bookingId);

    // Find the ambulance linked to this driver (if any)
    const linkedAmbulance = ambulances.find(a => a.driver_id === driverId && a.status === 'available') ?? null;

    const bookingUpdate: Record<string, unknown> = {
      driver_id: driverId,
      status: 'accepted',
    };
    if (linkedAmbulance) bookingUpdate.ambulance_id = linkedAmbulance.id;

    const { error: bookingErr } = await supabase
      .from('bookings')
      .update(bookingUpdate)
      .eq('id', bookingId);

    // Mark driver as unavailable
    await supabase.from('drivers').update({ is_available: false }).eq('id', driverId);
    // Mark ambulance as busy if one is linked
    if (linkedAmbulance) {
      await supabase.from('ambulances').update({ status: 'busy' }).eq('id', linkedAmbulance.id);
    }

    if (bookingErr) {
      toast.error('Failed to assign driver');
    } else {
      toast.success('Driver assigned — en route to patient!');
      if (hospital) {
        const [d, a] = await Promise.all([
          fetchDrivers(hospital.id),
          fetchAmbulances(hospital.id),
        ]);
        if (d) setDrivers(d);
        if (a) setAmbulances(a);
      }
    }
    setAssigningId(null);
  };

  const handleApproveDriver = async (driverId: string) => {
    const { data: driverData, error: driverFetchError } = await supabase
      .from('drivers')
      .select('profile_id')
      .eq('id', driverId)
      .single();

    if (driverFetchError || !driverData) {
      toast.error('Failed to find driver record for approval');
      return;
    }

    const { error: driverError } = await supabase
      .from('drivers')
      .update({ approval_status: 'approved' })
      .eq('id', driverId);

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ approval_status: 'approved' })
      .eq('id', driverData.profile_id);

    if (driverError || profileError) {
      console.error('Approval errors:', { driverError, profileError });
      toast.error(driverError?.message || profileError?.message || 'Failed to approve driver');
      return;
    }

    toast.success('Driver approved');
    if (hospital) {
      const refreshedDrivers = await fetchDrivers(hospital.id);
      if (refreshedDrivers) {
        setDrivers(refreshedDrivers);
        await fetchHospitalMetrics(hospital.id);
      }
    }
  };

  const handleRejectDriver = async (driverId: string) => {
    const { data: driverData, error: driverFetchError } = await supabase
      .from('drivers')
      .select('profile_id')
      .eq('id', driverId)
      .single();

    if (driverFetchError || !driverData) {
      toast.error('Failed to find driver record for rejection');
      return;
    }

    const { error: driverError } = await supabase
      .from('drivers')
      .update({ approval_status: 'rejected' })
      .eq('id', driverId);

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ approval_status: 'rejected' })
      .eq('id', driverData.profile_id);

    if (driverError || profileError) {
      console.error('Rejection errors:', { driverError, profileError });
      toast.error(driverError?.message || profileError?.message || 'Failed to reject driver');
      return;
    }

    toast.success('Driver rejected');
    if (hospital) {
      const refreshedDrivers = await fetchDrivers(hospital.id);
      if (refreshedDrivers) {
        setDrivers(refreshedDrivers);
        await fetchHospitalMetrics(hospital.id);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const effectiveApprovalStatus = profile?.approval_status === 'approved' ? 'approved' : hospital?.approval_status || 'pending';

  // Guard: use profile + hospital as fallback status.
  if (profile?.role === 'hospital' && effectiveApprovalStatus !== 'approved') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-3">Account Pending Approval</h3>
          <p className="text-gray-600">Your hospital account is awaiting admin approval.</p>
          <p className="text-gray-500 mt-2">Please wait and try again after approval.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            Refresh Status
          </button>
        </div>
      </div>
    );
  }

  const activeBookings = bookings.filter(b => ['pending', 'accepted', 'arrived', 'picked_up'].includes(b.status));
  const availableAmbulances = ambulances.filter(a => a.status === 'available');
  const approvedAvailableDrivers = drivers.filter(d => d.approval_status === 'approved' && d.is_available);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">{hospital?.hospital_name}</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${effectiveApprovalStatus === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {effectiveApprovalStatus}
            </span>
          </div>
          <p className="text-gray-600 mt-1">
            {hospital?.city} • {hospital?.hospital_type === 'government' ? 'Government' : 'Private'} Hospital
          </p>
        </div>

        {/* Stats */}
        {requestsError ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {requestsError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">₹{stats.totalRevenue}</p>
              </div>
              <IndianRupee className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Available Drivers</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{approvedAvailableDrivers.length}</p>
                <p className="text-xs text-gray-500 mt-1">of {drivers.filter(d => d.approval_status === 'approved').length} approved</p>
              </div>
              <AmbulanceIcon className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Drivers</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.driversCount}</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Bookings</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.activeBookingsCount}</p>
              </div>
              <Activity className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* ── Live Trip Tracking Map ────────────────────────────────────────────── */}
        {(() => {
          const activeTrips = bookings.filter(b => ['accepted', 'arrived', 'picked_up'].includes(b.status));
          const selectedTrip = activeTrips.find(b => b.id === selectedTripId) ?? activeTrips[0] ?? null;
          if (selectedTripId === null && activeTrips.length > 0) setSelectedTripId(activeTrips[0].id);

          const driverPos = selectedTrip?.driver_id ? driverLocations[selectedTrip.driver_id] : null;
          const hospitalPos = hospital?.lat != null && hospital?.lng != null
            ? { lat: hospital.lat, lng: hospital.lng } : null;
          const boundsCoords: [number, number][] = [
            ...(driverPos ? [[driverPos.lat, driverPos.lng] as [number, number]] : []),
            ...(selectedTrip ? [[selectedTrip.pickup_lat, selectedTrip.pickup_lng] as [number, number]] : []),
            ...(selectedTrip?.destination_lat ? [[selectedTrip.destination_lat, selectedTrip.destination_lng] as [number, number]] : []),
            ...(hospitalPos ? [[hospitalPos.lat, hospitalPos.lng] as [number, number]] : []),
          ];
          const mapCenter: [number, number] = boundsCoords[0] ?? (hospitalPos ? [hospitalPos.lat, hospitalPos.lng] : [20.5937, 78.9629]);

          return (
            <div className="mb-8 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center">
                    <Map className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Live Trip Tracking</h2>
                    <p className="text-xs text-gray-500">
                      {activeTrips.length > 0 ? `${activeTrips.length} active trip${activeTrips.length > 1 ? 's' : ''} in progress` : 'No active trips right now'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeTrips.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${activeTrips.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </span>
                  <span className={`text-xs font-semibold ${activeTrips.length > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {activeTrips.length > 0 ? 'Live' : 'Idle'}
                  </span>
                </div>
              </div>

              <div className="grid lg:grid-cols-[1fr,300px]">
                {/* Map */}
                <div style={{ height: '440px' }}>
                  <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}
                    whenReady={(m) => setTimeout(() => m.target.invalidateSize(), 200)}>
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; OpenStreetMap contributors'
                    />
                    {boundsCoords.length > 0 && <FitBounds coords={boundsCoords} />}

                    {/* Hospital self marker */}
                    {hospitalPos && (
                      <Marker position={[hospitalPos.lat, hospitalPos.lng]} icon={hospitalSelfIcon}>
                        <Popup>
                          <div className="font-semibold text-sm">🏥 {hospital?.hospital_name}<br />
                            <span className="font-normal text-gray-500 text-xs">{hospital?.city} • {hospital?.hospital_type === 'government' ? 'Government' : 'Private'}</span>
                          </div>
                        </Popup>
                      </Marker>
                    )}

                    {/* Driver marker */}
                    {driverPos && (
                      <Marker position={[driverPos.lat, driverPos.lng]} icon={driverIcon}>
                        <Popup>
                          <div className="font-semibold text-sm">🚑 Driver<br />
                            <span className="font-normal text-gray-500 text-xs">
                              {selectedTrip && getDriverName(selectedTrip)}
                            </span>
                          </div>
                        </Popup>
                      </Marker>
                    )}

                    {/* Pickup marker */}
                    {selectedTrip && (
                      <Marker position={[selectedTrip.pickup_lat, selectedTrip.pickup_lng]} icon={pickupIcon}>
                        <Popup>
                          <div className="font-semibold text-sm">📍 Patient Pickup<br />
                            <span className="font-normal text-gray-600 text-xs">{selectedTrip.pickup_location}</span>
                          </div>
                        </Popup>
                      </Marker>
                    )}

                    {/* Destination marker */}
                    {selectedTrip?.destination_lat && selectedTrip?.destination_lng && (
                      <Marker position={[selectedTrip.destination_lat, selectedTrip.destination_lng]} icon={destIcon}>
                        <Popup>
                          <div className="font-semibold text-sm">🏥 {selectedTrip.destination}</div>
                        </Popup>
                      </Marker>
                    )}
                  </MapContainer>
                </div>

                {/* Side panel */}
                <div className="border-l border-gray-100 bg-gray-50 flex flex-col">
                  {/* Trip selector */}
                  <div className="p-4 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select Trip</p>
                    {activeTrips.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                        <MapPin className="h-8 w-8 text-gray-200" />
                        <p className="text-sm text-gray-400 font-medium">No active trips</p>
                        <p className="text-xs text-gray-300">Map updates when trips are assigned</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[120px] overflow-y-auto">
                        {activeTrips.map(trip => (
                          <button
                            key={trip.id}
                            onClick={() => setSelectedTripId(trip.id)}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all border ${
                              selectedTripId === trip.id
                                ? 'bg-red-600 text-white border-red-600'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-red-300'
                            }`}
                          >
                            <div className="font-semibold truncate">{trip.pickup_location}</div>
                            <div className={`capitalize mt-0.5 ${selectedTripId === trip.id ? 'text-red-100' : 'text-gray-400'}`}>
                              {trip.status.replace('_', ' ')} • ₹{trip.fare}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Trip details */}
                  {selectedTrip ? (
                    <div className="p-4 flex-1 space-y-3 overflow-y-auto">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trip Details</p>

                      <div className="bg-white rounded-xl p-3 border border-gray-100 space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <MapPin className="h-3 w-3 text-blue-600" />
                          </span>
                          <div>
                            <p className="text-xs text-gray-400">Pickup</p>
                            <p className="text-xs font-semibold text-gray-800 leading-snug">{selectedTrip.pickup_location}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <MapPin className="h-3 w-3 text-green-600" />
                          </span>
                          <div>
                            <p className="text-xs text-gray-400">Destination</p>
                            <p className="text-xs font-semibold text-gray-800 leading-snug">{selectedTrip.destination}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-3 border border-gray-100 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">Status</span>
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-full capitalize ${getStatusColor(selectedTrip.status)}`}>
                            {selectedTrip.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">Fare</span>
                          <span className="text-xs font-bold text-gray-800">₹{selectedTrip.fare}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">Distance</span>
                          <span className="text-xs font-bold text-gray-800">{selectedTrip.distance?.toFixed(1)} km</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">Driver</span>
                          <span className="text-xs font-bold text-gray-800 truncate max-w-[120px]">{getDriverName(selectedTrip)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">Driver GPS</span>
                          <span className={`text-xs font-semibold ${driverPos ? 'text-green-600' : 'text-gray-400'}`}>
                            {driverPos ? 'Live' : 'Unavailable'}
                          </span>
                        </div>
                      </div>

                      {/* Legend */}
                      <div className="bg-white rounded-xl p-3 border border-gray-100 space-y-1.5">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Map Legend</p>
                        {[['#7C3AED', '🏥 Your Hospital'], ['#DC2626', '🚑 Driver (live)'], ['#3B82F6', '📍 Patient pickup'], ['#10B981', '🏥 Destination']].map(([color, label]) => (
                          <div key={label} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                            <span className="text-xs text-gray-600">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-2">
                      <Map className="h-10 w-10 text-gray-200" />
                      <p className="text-sm text-gray-400 font-medium">No trip selected</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Incoming Requests */}
        {(() => {
          const activeRequests = bookings.filter(b =>
            ['pending', 'accepted', 'arrived', 'picked_up'].includes(b.status)
          );
          // Drivers that are approved, available, and not already assigned to an active booking
          const assignedDriverIds = new Set(
            bookings
              .filter(b => ['accepted', 'arrived', 'picked_up'].includes(b.status) && b.driver_id)
              .map(b => b.driver_id!)
          );
          const availableDrivers = drivers.filter(
            d => d.approval_status === 'approved' && d.is_available && !assignedDriverIds.has(d.id)
          );
          return activeRequests.length > 0 ? (
            <div className="bg-white rounded-lg shadow-sm mb-8 border-l-4 border-primary">
              <div className="px-6 py-4 border-b flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-gray-900">Incoming Requests</h2>
                <span className="ml-2 px-2 py-0.5 bg-primary text-white text-xs font-bold rounded-full">{activeRequests.length}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {activeRequests.map((booking) => {
                  const assignedDriver = booking.driver_id ? drivers.find(d => d.id === booking.driver_id) : null;
                  const isPending = booking.status === 'pending';
                  return (
                    <div key={booking.id} className="p-6">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {booking.is_emergency && (
                              <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full">EMERGENCY</span>
                            )}
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${getStatusColor(booking.status)}`}>
                              {booking.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="font-medium">{booking.pickup_location}</span>
                          </div>
                          <div className="text-sm text-gray-500">
                            Fare: <span className="font-medium text-gray-700">₹{booking.fare}</span>
                            &nbsp;&bull;&nbsp;{booking.distance?.toFixed(1)} km
                          </div>
                          {/* Show assigned driver info once assigned */}
                          {assignedDriver && (
                            <div className="flex items-center gap-2 mt-1 text-sm text-green-700 font-medium">
                              <Users className="h-4 w-4" />
                              <span>{assignedDriver.full_name || 'Driver'}</span>
                              {assignedDriver.phone && (
                                <span className="text-gray-500 font-normal">&bull; {assignedDriver.phone}</span>
                              )}
                            </div>
                          )}
                          <div className="text-xs text-gray-400">{formatDate(booking.created_at)}</div>
                        </div>
                        <div className="flex flex-col gap-2 min-w-[220px]">
                          {isPending ? (
                            availableDrivers.length === 0 ? (
                              <p className="text-sm text-red-500 font-medium">No available drivers</p>
                            ) : (
                              <>
                                <select
                                  id={`driver-select-${booking.id}`}
                                  className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                                  defaultValue=""
                                >
                                  <option value="" disabled>Select driver</option>
                                  {availableDrivers.map((d) => {
                                    const amb = ambulances.find(a => a.driver_id === d.id);
                                    return (
                                      <option key={d.id} value={d.id}>
                                        {d.full_name || 'Driver'}{amb ? ` — ${amb.vehicle_number}` : ''}
                                      </option>
                                    );
                                  })}
                                </select>
                                <button
                                  disabled={assigningId === booking.id}
                                  onClick={() => {
                                    const sel = document.getElementById(`driver-select-${booking.id}`) as HTMLSelectElement;
                                    if (!sel.value) { toast.error('Please select a driver'); return; }
                                    handleAssignDriver(booking.id, sel.value);
                                  }}
                                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 text-sm font-medium disabled:opacity-50"
                                >
                                  {assigningId === booking.id ? 'Assigning...' : 'Assign Driver'}
                                </button>
                              </>
                            )
                          ) : (
                            <span className="text-sm text-gray-400 italic">Driver dispatched</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null;
        })()}

        {/* Drivers Section */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Drivers</h2>
          </div>

          <div className="overflow-x-auto">
            {drivers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No drivers registered yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">License</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Availability</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {drivers.map((driver) => (
                    <tr key={driver.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {driver.full_name || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>{driver.phone || '—'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{driver.license_number}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusColor(driver.approval_status)}`}>
                          {driver.approval_status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          driver.is_available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {driver.is_available ? 'Available' : 'Busy'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {driver.approval_status === 'pending' && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApproveDriver(driver.id)}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectDriver(driver.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Ambulances Section */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Ambulances</h2>
          </div>

          <div className="overflow-x-auto">
            {ambulances.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <AmbulanceIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No ambulances added yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ambulances.map((ambulance) => {
                    const driver = ambulance.driver_id ? drivers.find(d => d.id === ambulance.driver_id) : null;
                    const driverName = driver?.full_name || '—';
                    const driverAvailable = driver?.is_available;
                    const driverApproved = driver?.approval_status === 'approved';
                    return (
                    <tr key={ambulance.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {ambulance.vehicle_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 capitalize">
                        {ambulance.ambulance_type} Life Support
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>{driverName}</div>
                        {driver && (
                          <div className="mt-1">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                              driverApproved && driverAvailable
                                ? 'bg-green-100 text-green-800'
                                : driverApproved && !driverAvailable
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {!driverApproved ? 'Pending Approval' : driverAvailable ? 'Available' : 'On Trip'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusColor(ambulance.status)}`}>
                          {ambulance.status}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Recent Bookings</h2>
          </div>

          <div className="overflow-x-auto">
            {bookings.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No bookings yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pickup → Destination</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Distance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fare</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {bookings.slice(0, 10).map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {booking.pickup_location} → {booking.destination}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {getDriverName(booking)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {getDriverPhone(booking)}
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
