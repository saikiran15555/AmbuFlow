import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Ambulance, Shield, Clock, DollarSign, MapPin, Phone } from 'lucide-react';
import heroImage from '@/assets/hero-ambulance.jpg';

export default function LandingPage() {
  const { user, profile } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-red-50 to-white py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-5xl font-bold text-gray-900 leading-tight">
                Fixed Fare Ambulance Booking
              </h1>
              <p className="text-xl text-gray-600">
                Transparent pricing, no hidden charges. Get emergency medical transport with real-time tracking and professional care.
              </p>
              <div className="flex flex-wrap gap-4">
                {user ? (
                  <Link to={profile?.role === 'user' ? '/booking' : `/${profile?.role}`}>
                    <Button size="lg" className="text-lg px-8">
                      <Ambulance className="mr-2 h-5 w-5" />
                      {profile?.role === 'user' ? 'Book Ambulance' : 'Go to Dashboard'}
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/register">
                      <Button size="lg" className="text-lg px-8">
                        <Ambulance className="mr-2 h-5 w-5" />
                        Book Now
                      </Button>
                    </Link>
                    <Link to="/login">
                      <Button size="lg" variant="outline" className="text-lg px-8">
                        Sign In
                      </Button>
                    </Link>
                  </>
                )}
              </div>
              
              <div className="flex items-center space-x-6 pt-4">
                <div className="flex items-center space-x-2">
                  <Phone className="h-5 w-5 text-primary" />
                  <span className="text-lg font-semibold text-gray-900">Emergency: 108</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <img
                src={heroImage}
                alt="Emergency Ambulance Service"
                className="rounded-2xl shadow-2xl w-full h-[400px] object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Choose AmbuFlow?</h2>
            <p className="text-xl text-gray-600">Fast, reliable, and transparent emergency medical transport</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-red-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Fixed Fare</h3>
              <p className="text-gray-600">
                Know your exact fare before booking. No surge pricing, no hidden charges.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-red-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Real-Time Tracking</h3>
              <p className="text-gray-600">
                Track your ambulance location in real-time from dispatch to arrival.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-red-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">24/7 Available</h3>
              <p className="text-gray-600">
                Emergency medical transport available round the clock, every day.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-red-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Certified Staff</h3>
              <p className="text-gray-600">
                All drivers and medical staff are trained and certified professionals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600">Book an ambulance in just a few simple steps</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '01', title: 'Enter Pickup Location', desc: 'Provide your current location or address' },
              { step: '02', title: 'Select Hospital', desc: 'Choose your preferred hospital destination' },
              { step: '03', title: 'Choose Ambulance Type', desc: 'Select Basic or Advanced Life Support' },
              { step: '04', title: 'Track & Ride', desc: 'Track ambulance arrival in real-time' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="bg-primary text-white text-2xl font-bold rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            Need Emergency Medical Transport?
          </h2>
          <p className="text-xl text-red-100 mb-8">
            Fast, reliable ambulance service with transparent pricing. Book now or join as a service provider.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/register">
              <Button size="lg" variant="secondary" className="text-lg px-8">
                Get Started
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="text-lg px-8 bg-transparent text-white border-white hover:bg-white hover:text-primary">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
