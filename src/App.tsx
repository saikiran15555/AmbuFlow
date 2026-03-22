import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

function App() {
  const { user, profile, loading, profileResolved, profileError } = useAuth();
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  const Page = ({ children }: { children: React.ReactNode }) => (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: 'easeOut' }}
      className="will-change-transform"
    >
      {children}
    </motion.div>
  );

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
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Page><LandingPage /></Page>} />
          <Route path="/login" element={
            <Page>
              {user ? (
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
              ) : <LoginPage />}
            </Page>
          } />
          <Route path="/register" element={
            <Page>
              {user ? (
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
              ) : <RegisterPage />}
            </Page>
          } />
        
        {/* Shared Protected Routes */}
        <Route path="/profile" element={
          <Page>
            <ProtectedRoute allowedRoles={['user', 'driver', 'hospital', 'admin']}>
              <ProfilePage />
            </ProtectedRoute>
          </Page>
        } />
        <Route path="/booking/:id" element={
          <Page>
            <ProtectedRoute allowedRoles={['user', 'driver', 'hospital', 'admin']}>
              <BookingDetailsPage />
            </ProtectedRoute>
          </Page>
        } />
        <Route path="/track/:id" element={
          <Page>
            <ProtectedRoute allowedRoles={['user', 'driver', 'hospital', 'admin']}>
              <TrackBookingPage />
            </ProtectedRoute>
          </Page>
        } />
        
        {/* User Routes */}
        <Route path="/user" element={
          <Page>
            <ProtectedRoute allowedRoles={['user']}>
              <UserDashboard />
            </ProtectedRoute>
          </Page>
        } />
        <Route path="/booking" element={
          <Page>
            <ProtectedRoute allowedRoles={['user']}>
              <BookingFlow />
            </ProtectedRoute>
          </Page>
        } />
        <Route path="/book" element={
          <Page>
            <ProtectedRoute allowedRoles={['user']}>
              <BookingFlow />
            </ProtectedRoute>
          </Page>
        } />
        
        {/* Driver Routes */}
        <Route path="/driver" element={
          <Page>
            <ProtectedRoute allowedRoles={['driver']}>
              <DriverDashboard />
            </ProtectedRoute>
          </Page>
        } />
        
        {/* Hospital Routes */}
        <Route path="/hospital" element={
          <Page>
            <ProtectedRoute allowedRoles={['hospital']}>
              <HospitalDashboard />
            </ProtectedRoute>
          </Page>
        } />
        
        {/* Admin Routes */}
        <Route path="/admin" element={
          <Page>
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          </Page>
        } />
        <Route path="/admin/users" element={
          <Page>
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDataPage section="users" />
            </ProtectedRoute>
          </Page>
        } />
        <Route path="/admin/hospitals" element={
          <Page>
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDataPage section="hospitals" />
            </ProtectedRoute>
          </Page>
        } />
        <Route path="/admin/hospitals/:id" element={
          <Page>
            <ProtectedRoute allowedRoles={['admin']}>
              <HospitalDetailPage />
            </ProtectedRoute>
          </Page>
        } />
        <Route path="/admin/drivers" element={
          <Page>
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDataPage section="drivers" />
            </ProtectedRoute>
          </Page>
        } />
        <Route path="/admin/bookings" element={
          <Page>
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDataPage section="bookings" />
            </ProtectedRoute>
          </Page>
        } />
        <Route path="/admin/trips" element={
          <Page>
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDataPage section="trips" />
            </ProtectedRoute>
          </Page>
        } />
        <Route path="/admin/revenue" element={
          <Page>
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDataPage section="revenue" />
            </ProtectedRoute>
          </Page>
        } />

          <Route path="*" element={<Page><NotFoundPage /></Page>} />
        </Routes>
      </AnimatePresence>
    </>
  );
}

export default App;
