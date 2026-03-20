import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [checkedFresh, setCheckedFresh] = useState(false);

  useEffect(() => {
    if (!profile) return;

    if ((profile.role === 'hospital' || profile.role === 'driver') && profile.approval_status !== 'approved') {
      const checkInterval = setInterval(() => {
        refreshProfile().catch((error) => {
          console.warn('ProtectedRoute: refreshProfile polling failed', error);
        });
      }, 5000);

      return () => clearInterval(checkInterval);
    }
  }, [profile, refreshProfile]);

  useEffect(() => {
    if (!profile || checkedFresh) return;

    if ((profile.role === 'hospital' || profile.role === 'driver') && profile.approval_status !== 'approved') {
      setCheckedFresh(true);
      refreshProfile().catch((error) => {
        console.warn('ProtectedRoute: initial refreshProfile failed', error);
      });
    }
  }, [profile, checkedFresh, refreshProfile]);

  console.log('ProtectedRoute:', { 
    user: !!user, 
    profile: !!profile, 
    loading, 
    role: profile?.role, 
    allowedRoles,
    approvalStatus: profile?.approval_status,
    checkedFresh
  });

  // Show loading spinner while authentication state is being determined
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If no user, redirect to login
  if (!user) {
    console.log('Redirecting to login: no user');
    return <Navigate to="/login" replace />;
  }

  // If user exists but profile is missing, show error with support message
  if (!profile) {
    console.error('User authenticated but profile missing:', user.id);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Profile Not Found</h3>
          <p className="text-sm text-gray-500 mb-4">
            Your account exists but your profile data is missing. This is a database issue.
          </p>
          <p className="text-xs text-gray-400 mb-4">User ID: {user.id}</p>
          <div className="space-y-2">
            <button
              onClick={() => window.location.href = '/login'}
              className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              Try Logging In Again
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = '/register';
              }}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              Register a New Account
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            If this problem persists, please contact support with your User ID.
          </p>
        </div>
      </div>
    );
  }

  // Only check approval status for hospital and driver roles
  // Users and admins are auto-approved
  if (profile.approval_status !== 'approved' && (profile.role === 'hospital' || profile.role === 'driver')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
            <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Account Pending Approval</h3>
          <p className="text-sm text-gray-500 mb-4">
            {profile.role === 'hospital' 
              ? 'Your hospital account is awaiting admin approval.'
              : 'Your driver account is awaiting hospital approval.'}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Auto-refreshing status every 5 seconds. Please wait.
          </p>
          <button
            onClick={() => refreshProfile()}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            Refresh Status Now
          </button>
        </div>
      </div>
    );
  }

  if (!allowedRoles.includes(profile.role)) {
    console.log('Role mismatch, redirecting to:', profile.role);
    return <Navigate to={`/${profile.role}`} replace />;
  }

  return <>{children}</>;
}
