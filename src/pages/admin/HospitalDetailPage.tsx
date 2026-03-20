import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatDate, getStatusColor } from '@/lib/utils';
import { ArrowLeft, Building2, MapPin, Phone, Mail, Users, Ambulance, CheckCircle, XCircle, Clock } from 'lucide-react';

interface HospitalDetail {
  id: string;
  profile_id: string;
  hospital_name: string;
  city: string;
  hospital_type: string;
  approval_status: string;
  created_at: string;
  profile: { email: string; phone: string; full_name: string } | null;
}

interface DriverDetail {
  id: string;
  profile_id: string;
  license_number: string;
  approval_status: string;
  is_available: boolean;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  profile: { email: string; full_name: string; phone: string } | null;
  ambulance: { vehicle_number: string; ambulance_type: string; status: string } | null;
}

export default function HospitalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [hospital, setHospital] = useState<HospitalDetail | null>(null);
  const [drivers, setDrivers] = useState<DriverDetail[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalBookings: 0, activeBookings: 0, completedBookings: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchAll(id);
  }, [id]);

  const fetchAll = async (hospitalId: string) => {
    setLoading(true);
    setError(null);

    const [
      { data: hospitalData, error: hospitalErr },
      { data: driverRows, error: driversErr },
      { data: ambulanceRows, error: ambulancesErr },
      { data: bookingRows, error: bookingsErr },
    ] = await Promise.all([
      supabase
        .from('hospitals')
        .select('*, profile:profiles(email, phone, full_name)')
        .eq('id', hospitalId)
        .single(),
      supabase
        .from('drivers')
        .select('*, profile:profiles(email, full_name, phone), ambulance:ambulances(vehicle_number, ambulance_type, status)')
        .eq('hospital_id', hospitalId),
      supabase
        .from('ambulances')
        .select('*')
        .eq('hospital_id', hospitalId),
      supabase
        .from('bookings')
        .select('fare, status')
        .eq('hospital_id', hospitalId),
    ]);

    if (hospitalErr) { setError(hospitalErr.message); setLoading(false); return; }
    if (driversErr) console.warn('Drivers fetch error:', driversErr.message);
    if (ambulancesErr) console.warn('Ambulances fetch error:', ambulancesErr.message);
    if (bookingsErr) console.warn('Bookings fetch error:', bookingsErr.message);

    setHospital(hospitalData as HospitalDetail);

    // Normalize ambulance — PostgREST returns array for has-many
    const normalizedDrivers = (driverRows || []).map((d: any) => ({
      ...d,
      ambulance: Array.isArray(d.ambulance) ? d.ambulance[0] ?? null : d.ambulance,
    }));
    setDrivers(normalizedDrivers as DriverDetail[]);
    setAmbulances(ambulanceRows || []);

    const bookings = bookingRows || [];
    const completed = bookings.filter((b: any) => b.status === 'completed');
    setStats({
      totalBookings: bookings.length,
      activeBookings: bookings.filter((b: any) => ['pending', 'accepted', 'arrived', 'picked_up'].includes(b.status)).length,
      completedBookings: completed.length,
      totalRevenue: completed.reduce((sum: number, b: any) => sum + (b.fare || 0), 0),
    });

    setLoading(false);
  };

  if (loading) return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  );

  if (error || !hospital) return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-600 mb-4">{error || 'Hospital not found'}</p>
        <button onClick={() => navigate('/admin')} className="text-primary hover:underline">← Back to Dashboard</button>
      </div>
    </div>
  );

  const approvedDrivers = drivers.filter(d => d.approval_status === 'approved');
  const pendingDrivers = drivers.filter(d => d.approval_status === 'pending');
  const availableDrivers = drivers.filter(d => d.approval_status === 'approved' && d.is_available);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Back */}
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>

        {/* Hospital Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 rounded-xl p-3 flex-shrink-0">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">{hospital.hospital_name}</h1>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                    hospital.approval_status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : hospital.approval_status === 'pending'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {hospital.approval_status}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 capitalize">
                    {hospital.hospital_type}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                  <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-gray-400" />{hospital.city}</span>
                  {hospital.profile?.email && <span className="flex items-center gap-1.5"><Mail className="h-4 w-4 text-gray-400" />{hospital.profile.email}</span>}
                  {hospital.profile?.phone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4 text-gray-400" />{hospital.profile.phone}</span>}
                </div>
                <p className="text-xs text-gray-400 mt-2">Registered {formatDate(hospital.created_at)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Drivers', value: drivers.length, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Available Drivers', value: availableDrivers.length, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Total Ambulances', value: ambulances.length, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Total Revenue', value: `₹${stats.totalRevenue}`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Drivers Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">Drivers</h2>
              <span className="ml-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">{drivers.length}</span>
            </div>
            <div className="flex gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-green-500" />{approvedDrivers.length} approved</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-yellow-500" />{pendingDrivers.length} pending</span>
            </div>
          </div>

          {drivers.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <Users className="h-10 w-10 mx-auto mb-2 text-gray-200" />
              <p>No drivers registered for this hospital</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {drivers.map(driver => {
                const name = driver.full_name || driver.profile?.full_name || '—';
                const phone = driver.phone || driver.profile?.phone || '—';
                const email = driver.profile?.email || '—';
                return (
                  <div key={driver.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      {/* Driver identity */}
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-bold text-sm">{name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{name}</p>
                          <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{phone}</span>
                            <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{email}</span>
                          </div>
                        </div>
                      </div>

                      {/* Driver details */}
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <div className="bg-gray-100 rounded-lg px-3 py-1.5">
                          <span className="text-gray-400">License</span>
                          <p className="font-semibold text-gray-700 mt-0.5">{driver.license_number}</p>
                        </div>

                        {driver.ambulance && (
                          <div className="bg-blue-50 rounded-lg px-3 py-1.5">
                            <span className="text-blue-400 flex items-center gap-1"><Ambulance className="h-3 w-3" />Ambulance</span>
                            <p className="font-semibold text-blue-700 mt-0.5">{driver.ambulance.vehicle_number}</p>
                            <p className="text-blue-400 capitalize">{driver.ambulance.ambulance_type} · {driver.ambulance.status}</p>
                          </div>
                        )}

                        <span className={`px-2.5 py-1 rounded-full font-semibold capitalize ${getStatusColor(driver.approval_status)}`}>
                          {driver.approval_status}
                        </span>

                        <span className={`px-2.5 py-1 rounded-full font-semibold ${
                          driver.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {driver.is_available ? 'Available' : 'Busy'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ambulances Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b flex items-center gap-2">
            <Ambulance className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Ambulances</h2>
            <span className="ml-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">{ambulances.length}</span>
          </div>

          {ambulances.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <Ambulance className="h-10 w-10 mx-auto mb-2 text-gray-200" />
              <p>No ambulances registered for this hospital</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle No.</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ambulances.map(amb => (
                    <tr key={amb.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900">{amb.vehicle_number}</td>
                      <td className="px-6 py-3 text-sm text-gray-600 capitalize">{amb.ambulance_type} Life Support</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusColor(amb.status)}`}>
                          {amb.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">{formatDate(amb.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
