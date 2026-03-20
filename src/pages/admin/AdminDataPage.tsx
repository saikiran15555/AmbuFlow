import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate, getStatusColor } from '@/lib/utils';

type AdminSection = 'users' | 'hospitals' | 'drivers' | 'bookings' | 'trips' | 'revenue';

type AdminDataPageProps = {
  section: AdminSection;
};

const ACTIVE_TRIP_STATUSES = ['pending', 'accepted', 'arrived', 'picked_up'];

const PAGE_CONFIG: Record<AdminSection, { title: string; description: string }> = {
  users: {
    title: 'Users',
    description: 'Registered end users in the system.',
  },
  hospitals: {
    title: 'Hospitals',
    description: 'Hospital organizations and their approval state.',
  },
  drivers: {
    title: 'Drivers',
    description: 'Driver roster with linked profile information.',
  },
  bookings: {
    title: 'Bookings',
    description: 'All booking records across the platform.',
  },
  trips: {
    title: 'Active Trips',
    description: 'Bookings that are currently in progress.',
  },
  revenue: {
    title: 'Revenue',
    description: 'Completed bookings contributing to platform revenue.',
  },
};

export default function AdminDataPage({ section }: AdminDataPageProps) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revenueTotal, setRevenueTotal] = useState(0);

  useEffect(() => {
    fetchSectionData();
  }, [section]);

  const fetchSectionData = async () => {
    setLoading(true);
    setError(null);

    try {
      switch (section) {
        case 'users': {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'user')
            .order('created_at', { ascending: false });

          console.log('Admin users response:', data);
          if (error) throw error;
          setRows(data || []);
          break;
        }
        case 'hospitals': {
          const { data, error } = await supabase
            .from('hospitals')
            .select('*, profile:profiles(full_name, email, phone)')
            .order('created_at', { ascending: false });

          console.log('Admin hospitals response:', data);
          if (error) throw error;
          setRows(data || []);
          break;
        }
        case 'drivers': {
          const { data, error } = await supabase
            .from('drivers')
            .select('*, profile:profiles(full_name, email, phone)')
            .order('created_at', { ascending: false });

          console.log('Admin drivers response:', data);
          if (error) throw error;
          setRows(data || []);
          break;
        }
        case 'bookings': {
          const { data, error } = await supabase
            .from('bookings')
            .select(`
              *,
              hospital:hospitals(hospital_name),
              driver:drivers(profile:profiles(full_name, phone))
            `)
            .order('created_at', { ascending: false });

          console.log('Admin bookings response:', data);
          if (error) throw error;
          setRows(data || []);
          break;
        }
        case 'trips': {
          const { data, error } = await supabase
            .from('bookings')
            .select(`
              *,
              hospital:hospitals(hospital_name),
              driver:drivers(profile:profiles(full_name, phone))
            `)
            .in('status', ACTIVE_TRIP_STATUSES)
            .order('created_at', { ascending: false });

          console.log('Admin trips response:', data);
          if (error) throw error;
          setRows(data || []);
          break;
        }
        case 'revenue': {
          const { data, error } = await supabase
            .from('bookings')
            .select(`
              id,
              fare,
              created_at,
              pickup_location,
              destination,
              hospital:hospitals(hospital_name),
              driver:drivers(profile:profiles(full_name))
            `)
            .eq('status', 'completed')
            .order('created_at', { ascending: false });

          console.log('Admin revenue response:', data);
          if (error) throw error;
          setRows(data || []);
          setRevenueTotal((data || []).reduce((sum, booking) => sum + booking.fare, 0));
          break;
        }
      }
    } catch (fetchError: any) {
      console.error(`Admin ${section} fetch error:`, fetchError);
      setError(fetchError?.message || `Failed to fetch ${section}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const renderTable = () => {
    switch (section) {
      case 'users':
        return (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.full_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.phone || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusColor(user.approval_status)}`}>
                      {user.approval_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(user.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'hospitals':
        return (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hospital</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((hospital) => (
                <tr key={hospital.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{hospital.hospital_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{hospital.profile?.full_name || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{hospital.profile?.phone || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{hospital.city}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusColor(hospital.approval_status)}`}>
                      {hospital.approval_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(hospital.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'drivers':
        return (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">License</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Availability</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((driver) => (
                <tr key={driver.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{driver.profile?.full_name || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{driver.profile?.phone || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{driver.license_number}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusColor(driver.approval_status)}`}>
                      {driver.approval_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{driver.is_available ? 'Available' : 'Busy'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(driver.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'bookings':
      case 'trips':
        return (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hospital</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fare</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>{booking.pickup_location}</div>
                    <div className="text-xs text-gray-500">{booking.destination}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{booking.hospital?.hospital_name || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{booking.driver?.profile?.full_name || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusColor(booking.status)}`}>
                      {booking.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">${booking.fare}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(booking.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'revenue':
        return (
          <div>
            <div className="px-6 py-4 border-b bg-emerald-50 text-emerald-900 font-semibold">
              Total Revenue: ${revenueTotal}
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hospital</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fare</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>{booking.pickup_location}</div>
                      <div className="text-xs text-gray-500">{booking.destination}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{booking.hospital?.hospital_name || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{booking.driver?.profile?.full_name || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">${booking.fare}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(booking.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  };

  const { title, description } = PAGE_CONFIG[section];

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
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="inline-flex items-center text-primary hover:text-primary/90 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to admin dashboard
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-600 mt-1">{description}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          {error ? (
            <div className="p-8 text-center text-red-600">
              Failed to fetch data: {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No data available.
            </div>
          ) : (
            renderTable()
          )}
        </div>
      </div>
    </div>
  );
}
