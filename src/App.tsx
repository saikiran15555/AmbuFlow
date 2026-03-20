import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/layout/Navbar';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import UserDashboard from '@/pages/dashboards/UserDashboard';
import DriverDashboard from '@/pages/dashboards/DriverDashboard';
import HospitalDashboard from '@/pages/dashboards/HospitalDashboard';
import AdminDashboard from '@/pages/dashboards/AdminDashboard';
import AdminDataPage from '@/pages/admin/AdminDataPage';
import HospitalDetailPage from '@/pages/admin/HospitalDetailPage';
import BookingFlow from '@/pages/booking/BookingFlow';
import BookingDetailsPage from '@/pages/BookingDetailsPage';
import TrackBookingPage from '@/pages/TrackBookingPage';
import ProfilePage from '@/pages/ProfilePage';
import NotFoundPage from '@/pages/NotFoundPage';

function App() {
  const { user, profile, loading, profileResolved, profileError } = useAuth();

  if (loading || (user && !profileResolved)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={
          user ? (
            profile ? (
              <Navigate to={`/${profile.role}`} replace />
            ) : profileError ? (
              <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
                <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
                  <h3 className="text-lg font-semibold mb-2">Unable to load profile</h3>
                  <p className="text-sm text-gray-500 mb-4">{profileError}</p>
                  <a href="/" className="text-primary font-medium">Go to home</a>
                </div>
              </div>
            ) : (
              <div className="min-h-screen flex items-center justify-center">Loading profile...</div>
            )
          ) : <LoginPage />
        } />
        <Route path="/register" element={
          user ? (
            profile ? (
              <Navigate to={`/${profile.role}`} replace />
            ) : profileError ? (
              <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
                <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
                  <h3 className="text-lg font-semibold mb-2">Unable to load profile</h3>
                  <p className="text-sm text-gray-500 mb-4">{profileError}</p>
                  <a href="/" className="text-primary font-medium">Go to home</a>
                </div>
              </div>
            ) : (
              <div className="min-h-screen flex items-center justify-center">Loading profile...</div>
            )
          ) : <RegisterPage />
        } />
        
        {/* Shared Protected Routes */}
        <Route path="/profile" element={
          <ProtectedRoute allowedRoles={['user', 'driver', 'hospital', 'admin']}>
            <ProfilePage />
          </ProtectedRoute>
        } />
        <Route path="/booking/:id" element={
          <ProtectedRoute allowedRoles={['user', 'driver', 'hospital', 'admin']}>
            <BookingDetailsPage />
          </ProtectedRoute>
        } />
        <Route path="/track/:id" element={
          <ProtectedRoute allowedRoles={['user', 'driver', 'hospital', 'admin']}>
            <TrackBookingPage />
          </ProtectedRoute>
        } />
        
        {/* User Routes */}
        <Route path="/user" element={
          <ProtectedRoute allowedRoles={['user']}>
            <UserDashboard />
          </ProtectedRoute>
        } />
        <Route path="/booking" element={
          <ProtectedRoute allowedRoles={['user']}>
            <BookingFlow />
          </ProtectedRoute>
        } />
        <Route path="/book" element={
          <ProtectedRoute allowedRoles={['user']}>
            <BookingFlow />
          </ProtectedRoute>
        } />
        
        {/* Driver Routes */}
        <Route path="/driver" element={
          <ProtectedRoute allowedRoles={['driver']}>
            <DriverDashboard />
          </ProtectedRoute>
        } />
        
        {/* Hospital Routes */}
        <Route path="/hospital" element={
          <ProtectedRoute allowedRoles={['hospital']}>
            <HospitalDashboard />
          </ProtectedRoute>
        } />
        
        {/* Admin Routes */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDataPage section="users" />
          </ProtectedRoute>
        } />
        <Route path="/admin/hospitals" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDataPage section="hospitals" />
          </ProtectedRoute>
        } />
        <Route path="/admin/hospitals/:id" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <HospitalDetailPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/drivers" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDataPage section="drivers" />
          </ProtectedRoute>
        } />
        <Route path="/admin/bookings" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDataPage section="bookings" />
          </ProtectedRoute>
        } />
        <Route path="/admin/trips" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDataPage section="trips" />
          </ProtectedRoute>
        } />
        <Route path="/admin/revenue" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDataPage section="revenue" />
          </ProtectedRoute>
        } />
        
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

export default App;
