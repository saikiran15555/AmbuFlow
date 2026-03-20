import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Hospital, Driver, Ambulance, Booking } from '@/types';
import { formatDate, getStatusColor } from '@/lib/utils';
import { DollarSign, Ambulance as AmbulanceIcon, Users, Activity, Bell, MapPin, Phone } from 'lucide-react';
import { toast } from 'sonner';

export default function HospitalDashboard() {
  const { profile } = useAuth();
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
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
              <DollarSign className="h-8 w-8 text-green-600" />
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
