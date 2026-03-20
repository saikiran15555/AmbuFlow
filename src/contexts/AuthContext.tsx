import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileResolved: boolean;
  profileError: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileResolved, setProfileResolved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const createProfileFromUser = async (userId: string): Promise<Profile | null> => {
    const { data: userResponse, error: userError } = await supabase.auth.getUser();
    if (userError || !userResponse?.user) {
      console.error('Unable to retrieve user metadata to create profile:', userError);
      return null;
    }

    const role = (userResponse.user.user_metadata?.role as UserRole) || 'user';
    const full_name = userResponse.user.user_metadata?.full_name || '';
    const phone = userResponse.user.user_metadata?.phone || '';
    const approval_status = role === 'user' || role === 'admin' ? 'approved' : 'pending';

    const profileFallback = {
      id: userId,
      email: userResponse.user.email || '',
      full_name,
      phone,
      role,
      approval_status,
      created_at: new Date().toISOString(),
    } as Profile;

    // If DB insert/update fails due RLS, use in-memory profile fallback so app continues.
    const { data: createdProfile, error: createError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: userResponse.user.email || '',
        full_name,
        phone,
        role,
        approval_status,
      })
      .select('*')
      .single();

    if (createError) {
      console.warn('Unable to create missing profile (RLS or other); using fallback profile:', createError);
      return profileFallback;
    }

    console.log('Created missing profile automatically:', createdProfile);
    return (createdProfile as Profile) || profileFallback;
  };

  const fetchProfile = async (userId: string, retryCount = 0): Promise<Profile | null> => {
    try {
      console.log(`Fetching profile for user ${userId} (attempt ${retryCount + 1})`);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile fetch error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });

        if (error.code === 'PGRST116' && retryCount < 3) {
          console.log(`Profile not found, retrying in ${500 * (retryCount + 1)}ms...`);
          await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1)));
          return fetchProfile(userId, retryCount + 1);
        }

        if (error.code === 'PGRST116' || error?.status === 404 || error?.status === 500) {
          const fallbackProfile = await createProfileFromUser(userId);
          if (fallbackProfile) {
            setProfile(fallbackProfile);
            setProfileError(null);
            return fallbackProfile;
          }
        }

        const errText = `Profile fetch failed (${error.code || error.status}): ${error.message}`;
        setProfileError(errText);
        setProfile(null);
        return null;
      }

      if (data) {
        let profileData = data;

        // Self-heal: if hospital profile is pending but hospitals row is approved,
        // treat profile as approved and sync back.
        if (profileData.role === 'hospital' && profileData.approval_status !== 'approved') {
          const { data: hospitalRow, error: hospitalRowError } = await supabase
            .from('hospitals')
            .select('*')
            .eq('profile_id', profileData.id)
            .single();

          if (!hospitalRowError && hospitalRow?.approval_status === 'approved') {
            console.log('Hospital row approved while profile pending, auto-syncing profile status.');
            profileData = { ...profileData, approval_status: 'approved' };
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ approval_status: 'approved' })
              .eq('id', profileData.id);
            if (updateError) {
              console.warn('Failed to auto-sync profile approval_status:', updateError);
            }
          }
        }

        // Self-heal: if driver profile is pending but drivers row is approved,
        // treat profile as approved and sync back.
        if (profileData.role === 'driver' && profileData.approval_status !== 'approved') {
          const { data: driverRow, error: driverRowError } = await supabase
            .from('drivers')
            .select('*')
            .eq('profile_id', profileData.id)
            .single();

          if (!driverRowError && driverRow?.approval_status === 'approved') {
            console.log('Driver row approved while profile pending, auto-syncing profile status.');
            profileData = { ...profileData, approval_status: 'approved' };
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ approval_status: 'approved' })
              .eq('id', profileData.id);
            if (updateError) {
              console.warn('Failed to auto-sync profile approval_status:', updateError);
            }
          }
        }

        console.log('✅ Profile loaded successfully:', {
          id: profileData.id,
          email: profileData.email,
          role: profileData.role,
          approval_status: profileData.approval_status
        });
        setProfileError(null);
        setProfile(profileData);
        return profileData;
      }
      
      console.warn('Profile query returned no data, applying fallback profile');
      const fallback = await createProfileFromUser(userId);
      if (fallback) {
        setProfileError(null);
        setProfile(fallback);
        return fallback;
      }

      setProfileError('Profile is empty and cannot be created automatically');
      setProfile(null);
      return null;
    } catch (error: any) {
      console.error('Unexpected error fetching profile:', error);
      setProfileError('Unexpected error while fetching profile');
      setProfile(null);
      return null;
    } finally {
      setProfileResolved(true);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (error) {
          console.error('Session error:', error);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        if (session?.user) {
          console.log('Session found for user:', session.user.email);
          setUser(session.user);
          setProfileResolved(false);
          setLoading(false); // proceed to app render while profile resolves

          fetchProfile(session.user.id)
            .then((profile) => {
              if (!profile && mounted) {
                console.error('❌ Profile not found after all retries. User needs to contact support or re-register.');
                setProfileError('Unable to load profile. Please contact support.');
              }
            })
            .catch((error) => {
              console.error('Error during profile fetch:', error);
              setProfileError('Unable to load profile. Please contact support.');
            })
            .finally(() => {
              if (mounted) setProfileResolved(true);
            });
        } else {
          setProfileResolved(true);
          console.log('No session found');
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setUser(null);
        setProfile(null);
      } finally {
        if (mounted) {
          console.log('Auth initialization complete');
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('Auth state changed:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          setLoading(false); // render while profile resolves
          setProfileResolved(false);
          console.log('User signed in:', session.user.email);
          setUser(session.user);

          fetchProfile(session.user.id)
            .then((profile) => {
              if (!profile && mounted) {
                console.error('❌ Profile not found after sign in');
                setProfileError('Unable to load profile after sign in.');
              }
            })
            .catch((error) => {
              console.error('Error during profile fetch after sign in:', error);
              setProfileError('Unable to load profile after sign in.');
            })
            .finally(() => {
              if (mounted) setProfileResolved(true);
            });
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const profileChannel = supabase
      .channel(`profiles_updates_${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`,
      }, async () => {
        await fetchProfile(user.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileResolved, profileError, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
