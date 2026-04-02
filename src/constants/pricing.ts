export const PRICING = {
  BASE_FARE: 20, // Base fare in rupees
  PER_KM_RATE: 20, // Rate per kilometer (default, overridden per type)
  AMBULANCE_TYPES: {
    basic: {
      name: 'Basic Life Support (BLS)',
      multiplier: 1,
      baseFare: 20,
      perKmRate: 20,
      features: [
        'Trained EMT Staff',
        'Basic Medical Equipment',
        'Oxygen Support',
        'First Aid Kit',
      ],
    },
    advanced: {
      name: 'Advanced Life Support (ALS)',
      multiplier: 1,
      baseFare: 20,
      perKmRate: 35,
      features: [
        'Paramedic Staff',
        'Advanced Medical Equipment',
        'Cardiac Monitor',
        'Defibrillator',
        'IV Medications',
      ],
    },
  },
};

export function calculateFare(distance: number, ambulanceType: 'basic' | 'advanced'): number {
  const { baseFare, perKmRate, multiplier } = PRICING.AMBULANCE_TYPES[ambulanceType];
  return Math.round((baseFare + distance * perKmRate) * multiplier);
}
