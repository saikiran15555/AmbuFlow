import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string;
          role: 'user' | 'driver' | 'hospital' | 'admin';
          approval_status: 'pending' | 'approved' | 'rejected';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      hospitals: {
        Row: {
          id: string;
          profile_id: string;
          hospital_name: string;
          city: string;
          hospital_type: 'government' | 'private';
          approval_status: 'pending' | 'approved' | 'rejected';
          lat: number | null;
          lng: number | null;
          created_at: string;
        };
      };
      drivers: {
        Row: {
          id: string;
          profile_id: string;
          hospital_id: string;
          license_number: string;
          approval_status: 'pending' | 'approved' | 'rejected';
          is_available: boolean;
          current_lat: number | null;
          current_lng: number | null;
          created_at: string;
        };
      };
      ambulances: {
        Row: {
          id: string;
          hospital_id: string;
          driver_id: string | null;
          vehicle_number: string;
          ambulance_type: 'basic' | 'advanced';
          status: 'available' | 'busy' | 'maintenance';
          created_at: string;
        };
      };
      bookings: {
        Row: {
          id: string;
          user_id: string;
          driver_id: string | null;
          ambulance_id: string | null;
          hospital_id: string;
          pickup_location: string;
          pickup_lat: number;
          pickup_lng: number;
          destination: string;
          destination_lat: number;
          destination_lng: number;
          distance: number;
          fare: number;
          status: 'pending' | 'accepted' | 'arrived' | 'picked_up' | 'completed' | 'cancelled';
          is_emergency: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: 'info' | 'success' | 'warning' | 'error';
          is_read: boolean;
          created_at: string;
        };
      };
    };
  };
};
