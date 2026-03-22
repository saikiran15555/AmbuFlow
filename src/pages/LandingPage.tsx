import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Ambulance, Shield, Clock, IndianRupee, MapPin, Phone, Zap, Star, ChevronRight, Heart, Activity } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import heroImage from '@/assets/hero-ambulance.jpg';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.5, ease: 'easeOut', delay },
});

const STATS = [
  { value: '< 8 min', label: 'Avg Response Time' },
  { value: '500+', label: 'Verified Hospitals' },
  { value: '50K+', label: 'Lives Saved' },
  { value: '4.9★', label: 'User Rating' },
];

const FEATURES = [
  { icon: IndianRupee, color: 'bg-red-100 text-red-600', title: 'Fixed Fare', desc: 'Know your exact fare before booking. Zero surge pricing.' },
  { icon: MapPin, color: 'bg-blue-100 text-blue-600', title: 'Live Tracking', desc: 'Track your ambulance in real-time from dispatch to arrival.' },
  { icon: Clock, color: 'bg-amber-100 text-amber-600', title: '24/7 Available', desc: 'Emergency medical transport available round the clock.' },
  { icon: Shield, color: 'bg-green-100 text-green-600', title: 'Certified Staff', desc: 'All drivers and medical staff are trained professionals.' },
];

const STEPS = [
  { n: '01', title: 'Tap Emergency', desc: 'One tap auto-detects your location and dispatches nearest ambulance' },
  { n: '02', title: 'Get Assigned', desc: 'Nearest verified ambulance is assigned within seconds' },
  { n: '03', title: 'Track Live', desc: 'Watch your ambulance move toward you in real-time' },
  { n: '04', title: 'Safe Arrival', desc: 'Reach hospital with full trip summary and fixed fare' },
];

export default function LandingPage() {
  const { user, profile } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const anim = (delay = 0) => prefersReducedMotion ? {} : fadeUp(delay);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 overflow-x-hidden">
      {/* Hero */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden bg-gradient-to-br from-red-50 via-white to-rose-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-red-100/60 dark:bg-red-900/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-rose-100/40 dark:bg-rose-900/10 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              className="space-y-8"
              initial={prefersReducedMotion ? {} : { opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-2 rounded-full text-sm font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                India's #1 Fixed-Fare Ambulance Service
              </div>

              <div className="space-y-4">
                <h1 className="text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white leading-[1.1] tracking-tight">
                  Emergency Help,{' '}
                  <span className="text-gradient">One Tap Away</span>
                </h1>
                <p className="text-xl text-gray-600 dark:text-gray-400 leading-relaxed max-w-lg">
                  Transparent pricing, real-time tracking, and professional care — when every second counts.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                {user ? (
                  <Link to={profile?.role === 'user' ? '/booking' : `/${profile?.role}`}>
                    <Button size="lg" className="text-base px-8 h-14 rounded-2xl shadow-lg shadow-red-200 dark:shadow-red-900/30 hover:shadow-xl hover:shadow-red-200 transition-all hover:-translate-y-0.5 active:scale-[0.98]">
                      <Ambulance className="mr-2 h-5 w-5" />
                      {profile?.role === 'user' ? 'Book Ambulance' : 'Go to Dashboard'}
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/register">
                      <Button size="lg" className="text-base px-8 h-14 rounded-2xl shadow-lg shadow-red-200 dark:shadow-red-900/30 hover:shadow-xl transition-all hover:-translate-y-0.5 active:scale-[0.98]">
                        <Zap className="mr-2 h-5 w-5" />
                        Get Started Free
                      </Button>
                    </Link>
                    <Link to="/login">
                      <Button size="lg" variant="outline" className="text-base px-8 h-14 rounded-2xl border-2 hover:-translate-y-0.5 transition-all active:scale-[0.98]">
                        Sign In
                      </Button>
                    </Link>
                  </>
                )}
              </div>

              <div className="flex items-center gap-6 pt-2">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-xl">
                    <Phone className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Emergency Helpline</p>
                    <p className="font-bold text-lg">108</p>
                  </div>
                </div>
                <div className="flex -space-x-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-red-600 border-2 border-white dark:border-gray-900 flex items-center justify-center">
                      <Heart className="h-3 w-3 text-white fill-white" />
                    </div>
                  ))}
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-white dark:border-gray-900 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">+</div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">50,000+ lives saved</p>
              </div>
            </motion.div>

            <motion.div
              className="relative"
              initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
            >
              <div className="relative">
                <img
                  src={heroImage}
                  alt="Emergency Ambulance Service"
                  className="rounded-3xl shadow-2xl w-full h-[480px] object-cover"
                />
                {/* Floating cards */}
                <motion.div
                  className="absolute -bottom-6 -left-6 glass dark:bg-gray-800/90 rounded-2xl p-4 shadow-xl border border-white/50 dark:border-gray-700"
                  animate={prefersReducedMotion ? {} : { y: [0, -6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-xl">
                      <Activity className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Ambulance ETA</p>
                      <p className="font-bold text-gray-900 dark:text-white">~6 minutes</p>
                    </div>
                  </div>
                </motion.div>
                <motion.div
                  className="absolute -top-4 -right-4 glass dark:bg-gray-800/90 rounded-2xl p-4 shadow-xl border border-white/50 dark:border-gray-700"
                  animate={prefersReducedMotion ? {} : { y: [0, 6, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                >
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span className="font-bold text-gray-900 dark:text-white">4.9</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Rating</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-gray-900 dark:bg-gray-800 py-10">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s, i) => (
            <motion.div key={s.label} className="text-center" {...(prefersReducedMotion ? {} : fadeUp(i * 0.08))}>
              <p className="text-3xl font-extrabold text-white">{s.value}</p>
              <p className="text-gray-400 text-sm mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div className="text-center mb-16" {...anim()}>
            <p className="text-red-600 font-semibold text-sm uppercase tracking-widest mb-3">Why AmbuFlow</p>
            <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4">Built for Emergencies</h2>
            <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">Every feature designed to save time when it matters most</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                className="bg-white dark:bg-gray-800 p-7 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-gray-100 dark:border-gray-700 group"
                {...(prefersReducedMotion ? {} : fadeUp(i * 0.08))}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${f.color} group-hover:scale-110 transition-transform`}>
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{f.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div className="text-center mb-16" {...anim()}>
            <p className="text-red-600 font-semibold text-sm uppercase tracking-widest mb-3">Simple Process</p>
            <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4">How It Works</h2>
            <p className="text-xl text-gray-500 dark:text-gray-400">From tap to arrival in minutes</p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-8 relative">
            <div className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-red-200 via-red-400 to-red-200 dark:from-red-900 dark:via-red-700 dark:to-red-900" />
            {STEPS.map((s, i) => (
              <motion.div key={s.n} className="text-center relative" {...(prefersReducedMotion ? {} : fadeUp(i * 0.1))}>
                <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 text-white text-xl font-extrabold mx-auto mb-5 shadow-lg shadow-red-200 dark:shadow-red-900/30">
                  {s.n}
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{s.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-br from-red-600 to-red-800 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center px-4">
          <motion.div {...anim()}>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white px-4 py-2 rounded-full text-sm font-medium mb-8">
              <Zap className="h-4 w-4" /> Available 24/7 across India
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-6 leading-tight">
              Every Second Counts.<br />Book in One Tap.
            </h2>
            <p className="text-xl text-red-100 mb-10 max-w-2xl mx-auto">
              Join thousands who trust AmbuFlow for fast, transparent, and life-saving ambulance services.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/register">
                <Button size="lg" className="bg-white text-red-600 hover:bg-red-50 text-base px-10 h-14 rounded-2xl font-bold shadow-xl hover:-translate-y-0.5 transition-all active:scale-[0.98]">
                  <Ambulance className="mr-2 h-5 w-5" /> Book Now
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="text-base px-10 h-14 rounded-2xl bg-transparent text-white border-2 border-white/50 hover:bg-white/10 hover:-translate-y-0.5 transition-all active:scale-[0.98]">
                  Sign In
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
