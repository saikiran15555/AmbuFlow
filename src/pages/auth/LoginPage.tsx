import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Ambulance, Mail, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type UserRole = 'user' | 'driver' | 'hospital' | 'admin';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [role, setRole] = useState<UserRole>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && profile) {
      if (profile.role !== role) {
        toast.success('Logged in successfully — redirecting to your dashboard.');
      }
      navigate(`/${profile.role}`, { replace: true });
    }
  }, [user, profile, role, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('Attempting login for role:', role);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        toast.error(error.message);
        setLoading(false);
        return;
      }

      if (!data.user) {
        toast.error('Login failed. Please try again.');
        setLoading(false);
        return;
      }

      console.log('Login successful, user ID:', data.user.id);
      toast.success('Login successful! Loading your dashboard...');
      setLoading(false);
      
      // AuthContext will refresh session/profile; useEffect above will redirect once profile is available
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error?.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <Ambulance className="h-12 w-12 text-primary" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Sign in to AmbuFlow</h2>
          <p className="mt-2 text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-primary hover:text-primary/90">
              Register now
            </Link>
          </p>
        </div>

        {/* Role Tabs */}
        <div className="bg-white rounded-lg shadow-sm p-2">
          <div className="grid grid-cols-4 gap-2">
            {(['user', 'driver', 'hospital', 'admin'] as UserRole[]).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`py-2 px-3 rounded-md text-sm font-medium capitalize transition-colors ${
                  role === r
                    ? 'bg-primary text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <form className="mt-8 space-y-6 bg-white shadow-lg rounded-lg p-8" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
