import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Ambulance, User, Mail, Phone, Lock, Building2, FileText,
  MapPin, Eye, EyeOff, ShieldCheck, CheckCircle2, Circle,
} from 'lucide-react';
import type { Hospital, UserRole } from '@/types';

// ── Reusable field wrapper ────────────────────────────────────────────────────
function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-gray-700">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">{icon}</span>
        {children}
      </div>
    </div>
  );
}

const inputCls = 'block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors bg-white';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(false);

  // Common
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);

  // Driver
  const [licenseNumber, setLicenseNumber] = useState('');
  const [selectedHospital, setSelectedHospital] = useState('');
  const [hospitals, setHospitals] = useState<Pick<Hospital, 'id' | 'hospital_name' | 'city' | 'hospital_type'>[]>([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);

  // Hospital
  const [hospitalName, setHospitalName] = useState('');
  const [city, setCity] = useState('');
  const [hospitalType, setHospitalType] = useState<'government' | 'private'>('government');
  const [agreeAccuracy, setAgreeAccuracy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeCompliance, setAgreeCompliance] = useState(false);

  const loadHospitals = async () => {
    setHospitalsLoading(true);
    const { data, error } = await supabase.rpc('get_approved_hospitals');
    if (data) setHospitals(data);
    if (error) console.error('Failed to load hospitals:', error.message);
    setHospitalsLoading(false);
  };

  // Load hospitals on mount so the dropdown is ready when driver tab is clicked
  useEffect(() => { loadHospitals(); }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (role === 'hospital' && (!agreeAccuracy || !agreeTerms || !agreeCompliance)) {
      toast.error('Please accept all declarations to proceed'); return;
    }
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone, role } },
    });

    if (authError) {
      if (authError.message.includes('rate limit')) toast.error('Too many attempts. Please wait a few minutes.');
      else if (authError.message.includes('already registered')) toast.error('Email already registered. Please sign in.');
      else toast.error(authError.message);
      setLoading(false);
      return;
    }

    if (!authData.user) { toast.error('Registration failed'); setLoading(false); return; }

    await new Promise(r => setTimeout(r, 500));

    if (role === 'hospital') {
      // Fix profile approval_status to pending (DB default is 'approved')
      await supabase
        .from('profiles')
        .update({ approval_status: 'pending' })
        .eq('id', authData.user.id);

      // Geocode city to get lat/lng for proximity search
      let hospitalLat: number | null = null;
      let hospitalLng: number | null = null;
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city + ', India')}&limit=1`,
          { headers: { 'Accept-Language': 'en', 'User-Agent': 'ambulance-booking/1.0' } }
        );
        const geoData = await geoRes.json();
        if (geoData?.[0]) {
          hospitalLat = parseFloat(geoData[0].lat);
          hospitalLng = parseFloat(geoData[0].lon);
        }
      } catch { /* proceed without coords */ }

      const { error } = await supabase.from('hospitals').insert({
        profile_id: authData.user.id,
        hospital_name: hospitalName,
        city,
        hospital_type: hospitalType,
        approval_status: 'pending',
        lat: hospitalLat,
        lng: hospitalLng,
      });
      if (error) { toast.error(`Failed to create hospital profile: ${error.message}`); setLoading(false); return; }
    } else if (role === 'driver') {
      const { error } = await supabase.from('drivers').insert({
        profile_id: authData.user.id,
        hospital_id: selectedHospital,
        license_number: licenseNumber,
        approval_status: 'pending',
        is_available: false,
        full_name: fullName,
        phone,
      });
      if (error) { toast.error('Failed to create driver profile'); setLoading(false); return; }
    }

    toast.success('Registration successful!');
    if (role === 'user') {
      navigate('/user');
    } else {
      toast.info('Your account is pending approval. You will be notified once approved.');
      await supabase.auth.signOut();
      navigate('/login');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-gray-50 py-12 px-4">
      <div className="max-w-2xl w-full space-y-6">

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Ambulance className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
          <p className="mt-1 text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
          </p>
        </div>

        {/* Role tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex gap-1">
          {(['user', 'driver', 'hospital', 'admin'] as UserRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${
                role === r
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <form onSubmit={handleRegister} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">

          {/* ── HOSPITAL FORM ─────────────────────────────────────────────── */}
          {role === 'hospital' ? (
            <div>
              {/* Form header banner */}
              <div className="bg-gradient-to-r from-primary to-red-600 px-8 py-5">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-xl p-2">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">Hospital Registration</h3>
                    <p className="text-red-100 text-xs mt-0.5">All fields are required · Pending admin approval</p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6">

                {/* Section: Hospital Identity */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Hospital Details</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Hospital Name" icon={<Building2 className="h-4 w-4" />}>
                      <input
                        type="text" required value={hospitalName}
                        onChange={(e) => setHospitalName(e.target.value)}
                        className={inputCls} placeholder="e.g. Apollo Hospital"
                      />
                    </Field>
                    <Field label="Contact Person Name" icon={<User className="h-4 w-4" />}>
                      <input
                        type="text" required value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={inputCls} placeholder="e.g. Dr. Ramesh Kumar"
                      />
                    </Field>
                    <Field label="City" icon={<MapPin className="h-4 w-4" />}>
                      <input
                        type="text" required value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={inputCls} placeholder="e.g. Chennai"
                      />
                    </Field>
                  </div>
                </div>

                {/* Hospital Type */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">Hospital Type</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(['government', 'private'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setHospitalType(type)}
                        className={`relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                          hospitalType === type
                            ? 'border-primary bg-red-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          hospitalType === type ? 'border-primary' : 'border-gray-300'
                        }`}>
                          {hospitalType === type && (
                            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                          )}
                        </div>
                        <div>
                          <p className={`text-sm font-semibold capitalize ${hospitalType === type ? 'text-primary' : 'text-gray-700'}`}>
                            {type}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {type === 'government' ? 'Govt. funded facility' : 'Privately owned facility'}
                          </p>
                        </div>
                        {hospitalType === type && (
                          <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section: Account Credentials */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Account Credentials</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Official / Hospital Email" icon={<Mail className="h-4 w-4" />}>
                      <input
                        type="email" required value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputCls} placeholder="admin@hospital.com"
                      />
                    </Field>
                    <Field label="Phone Number" icon={<Phone className="h-4 w-4" />}>
                      <input
                        type="tel" required value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={inputCls} placeholder="+91 98765 43210"
                      />
                    </Field>
                    <Field label="Password" icon={<Lock className="h-4 w-4" />}>
                      <input
                        type={showPw ? 'text' : 'password'} required value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${inputCls} pr-10`} placeholder="Min. 6 characters"
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </Field>
                    <Field label="Confirm Password" icon={<Lock className="h-4 w-4" />}>
                      <input
                        type={showCpw ? 'text' : 'password'} required value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`${inputCls} pr-10`} placeholder="Re-enter password"
                      />
                      <button type="button" onClick={() => setShowCpw(!showCpw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showCpw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </Field>
                  </div>
                  {/* Password match indicator */}
                  {confirmPassword && (
                    <p className={`text-xs mt-2 flex items-center gap-1 ${password === confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                      {password === confirmPassword
                        ? <><CheckCircle2 className="h-3.5 w-3.5" /> Passwords match</>
                        : <><Circle className="h-3.5 w-3.5" /> Passwords do not match</>}
                    </p>
                  )}
                </div>

                {/* Declarations */}
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <p className="text-sm font-bold text-gray-700">Declarations & Agreement</p>
                  </div>

                  {[
                    {
                      id: 'accuracy',
                      checked: agreeAccuracy,
                      set: setAgreeAccuracy,
                      text: 'I confirm that all information provided is accurate, complete, and belongs to a legitimate medical facility.',
                    },
                    {
                      id: 'terms',
                      checked: agreeTerms,
                      set: setAgreeTerms,
                      text: 'I agree to the Terms of Service and Privacy Policy, and authorise this platform to process hospital data.',
                    },
                    {
                      id: 'compliance',
                      checked: agreeCompliance,
                      set: setAgreeCompliance,
                      text: 'I confirm this hospital complies with applicable healthcare regulations and is authorised to provide emergency ambulance services.',
                    },
                  ].map(({ id, checked, set, text }) => (
                    <label key={id} className="flex items-start gap-3 cursor-pointer group">
                      <div
                        onClick={() => set(!checked)}
                        className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          checked
                            ? 'bg-primary border-primary'
                            : 'border-gray-300 group-hover:border-primary/60 bg-white'
                        }`}
                      >
                        {checked && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm text-gray-600 leading-relaxed">{text}</span>
                    </label>
                  ))}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || !agreeAccuracy || !agreeTerms || !agreeCompliance}
                  className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  {loading ? 'Registering Hospital...' : 'Register Hospital'}
                </button>
                <p className="text-xs text-center text-gray-400">
                  Your registration will be reviewed by an admin before activation.
                </p>
              </div>
            </div>

          ) : (
            /* ── OTHER ROLES (user / driver / admin) ──────────────────────── */
            <div className="p-8 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Full Name" icon={<User className="h-4 w-4" />}>
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                    className={inputCls} placeholder="John Doe" />
                </Field>
                <Field label="Email Address" icon={<Mail className="h-4 w-4" />}>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className={inputCls} placeholder="you@example.com" />
                </Field>
                <Field label="Phone Number" icon={<Phone className="h-4 w-4" />}>
                  <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                    className={inputCls} placeholder="+91 98765 43210" />
                </Field>
                <Field label="Password" icon={<Lock className="h-4 w-4" />}>
                  <input type={showPw ? 'text' : 'password'} required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputCls} pr-10`} placeholder="Min. 6 characters" />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </Field>
                <div className="md:col-span-2">
                  <Field label="Confirm Password" icon={<Lock className="h-4 w-4" />}>
                    <input type={showCpw ? 'text' : 'password'} required value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`${inputCls} pr-10`} placeholder="Re-enter password" />
                    <button type="button" onClick={() => setShowCpw(!showCpw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showCpw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </Field>
                  {confirmPassword && (
                    <p className={`text-xs mt-2 flex items-center gap-1 ${password === confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                      {password === confirmPassword
                        ? <><CheckCircle2 className="h-3.5 w-3.5" /> Passwords match</>
                        : <><Circle className="h-3.5 w-3.5" /> Passwords do not match</>}
                    </p>
                  )}
                </div>
              </div>

              {/* Driver extra fields */}
              {role === 'driver' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                  <Field label="Driving Licence Number" icon={<FileText className="h-4 w-4" />}>
                    <input type="text" required value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      className={inputCls} placeholder="DL-1234567890" />
                  </Field>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-gray-700">Select Hospital</label>
                    <select required value={selectedHospital} onChange={(e) => setSelectedHospital(e.target.value)}
                      className="block w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary bg-white disabled:bg-gray-50 disabled:text-gray-400"
                      disabled={hospitalsLoading}>
                      <option value="">
                        {hospitalsLoading ? 'Loading hospitals...' : hospitals.length === 0 ? 'No approved hospitals yet' : 'Choose a hospital'}
                      </option>
                      {hospitals.map((h) => <option key={h.id} value={h.id}>{h.hospital_name} — {h.city}</option>)}
                    </select>
                    {!hospitalsLoading && hospitals.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">No approved hospitals are available yet. Please check back later.</p>
                    )}
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>

              {role !== 'user' && (
                <p className="text-xs text-center text-gray-400">
                  {role === 'driver' && 'Your registration will be reviewed by the hospital.'}
                  {role === 'admin' && 'Admin accounts require manual approval.'}
                </p>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
