export const PRICING = {
  BASE_FARE: 0, // Base fare in rupees
  PER_KM_RATE: 10, // Rate per kilometer
  AMBULANCE_TYPES: {
    basic: {
      name: 'Basic Life Support (BLS)',
      multiplier: 1,
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
  const baseFare = PRICING.BASE_FARE;
  const distanceFare = distance * PRICING.PER_KM_RATE;
  const multiplier = PRICING.AMBULANCE_TYPES[ambulanceType].multiplier;
  
  return Math.round((baseFare + distanceFare) * multiplier);
}
