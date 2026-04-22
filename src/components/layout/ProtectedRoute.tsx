import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading, refreshProfile } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll approval status for pending driver/hospital — stop as soon as approved
  useEffect(() => {
    if (!profile) return;
    if (profile.approval_status === 'approved') {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    if (profile.role !== 'driver' && profile.role !== 'hospital') return;

    // Check drivers table directly for approval (hospital updates drivers table, not profiles)
    const checkApproval = async () => {
      if (profile.role === 'driver') {
        const { data } = await supabase
          .from('drivers')
          .select('approval_status')
          .eq('profile_id', user!.id)
          .single();
        if (data?.approval_status === 'approved') {
          await refreshProfile();
        }
      } else {
        await refreshProfile();
      }
    };

    checkApproval();
    intervalRef.current = setInterval(checkApproval, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [profile?.approval_status, profile?.role]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Profile Not Found</h3>
          <p className="text-sm text-gray-500 mb-4">Your account exists but profile data is missing.</p>
          <p className="text-xs text-gray-400 mb-4">User ID: {user.id}</p>
          <div className="space-y-2">
            <button onClick={() => window.location.href = '/login'}
              className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90">
              Try Logging In Again
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/register'; }}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">
              Register a New Account
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <p className="text-sm text-gray-400 mb-4">Checking status automatically every 5 seconds...</p>
          <button onClick={() => refreshProfile()}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 text-sm">
            Check Now
          </button>
        </div>
      </div>
    );
  }

  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to={`/${profile.role}`} replace />;
  }

  return <>{children}</>;
}
