export type UserRole = 'user' | 'driver' | 'hospital' | 'admin';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type AmbulanceType = 'basic' | 'advanced';

export type BookingStatus = 'pending' | 'accepted' | 'arrived' | 'picked_up' | 'completed' | 'cancelled';

export type PaymentMethod = 'cash' | 'in_app';

export type PaymentStatus = 'pending' | 'paid';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: UserRole;
  approval_status: ApprovalStatus;
  created_at: string;
}

export interface Hospital {
  id: string;
  profile_id: string;
  hospital_name: string;
  address?: string | null;
  city: string;
  hospital_type: 'government' | 'private';
  approval_status: ApprovalStatus;
  lat?: number | null;
  lng?: number | null;
  created_at: string;
  profile?: Profile;
}

export interface Driver {
  id: string;
  profile_id: string;
  hospital_id: string;
  license_number: string;
  approval_status: ApprovalStatus;
  is_available: boolean;
  current_lat: number | null;
  current_lng: number | null;
  wallet_balance?: number | null;
  created_at: string;
  full_name?: string | null;
  phone?: string | null;
  profile?: Profile;
  hospital?: Hospital;
}

export interface Ambulance {
  id: string;
  hospital_id: string;
  driver_id: string | null;
  vehicle_number: string;
  ambulance_type: AmbulanceType;
  status: 'available' | 'busy' | 'maintenance';
  created_at: string;
  driver?: Driver;
  hospital?: Hospital;
}

export interface Booking {
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
  status: BookingStatus;
  is_emergency: boolean;
  payment_method?: PaymentMethod | null;
  payment_status?: PaymentStatus | null;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
  driver?: Driver;
  ambulance?: Ambulance;
  hospital?: Hospital;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
}
