import { CalculationInput, SDPPResult } from '../data/types';

// Single source of truth for illustration labels and calculation assumptions.
export const SDPP_ILLUSTRATION_RATES = { lower: 6.5, higher: 8.5, projection: 8 } as const;

// Rate Tables & Constants for SDPP
export const PREMIUM_CHARGE_SCALE: Record<number, Record<number, number>> = {
  1: { 5: 0.20, 6: 0.25, 7: 0.25, 8: 0.25, 9: 0.25, 10: 0.30, 11: 0.35, 12: 0.35, 13: 0.35, 14: 0.35, 15: 0.40, 16: 0.40, 17: 0.40, 18: 0.40, 19: 0.40, 20: 0.45, 21: 0.45, 22: 0.45, 23: 0.45, 24: 0.45, 25: 0.45 },
  2: { 5: 0.05, 6: 0.05, 7: 0.05, 8: 0.05, 9: 0.05, 10: 0.05, 11: 0.10, 12: 0.10, 13: 0.10, 14: 0.10, 15: 0.10, 16: 0.10, 17: 0.10, 18: 0.10, 19: 0.10, 20: 0.10, 21: 0.10, 22: 0.10, 23: 0.10, 24: 0.10, 25: 0.10 },
  3: { 5: 0, 6: 0, 7: 0.05, 8: 0.05, 9: 0.05, 10: 0.05, 11: 0.05, 12: 0.05, 13: 0.10, 14: 0.10, 15: 0.10, 16: 0.10, 17: 0.10, 18: 0.10, 19: 0.10, 20: 0.10, 21: 0.10, 22: 0.10, 23: 0.10, 24: 0.10, 25: 0.10 },
  4: { 5: 0, 6: 0, 7: 0, 8: 0.05, 9: 0.05, 10: 0.05, 11: 0.05, 12: 0.05, 13: 0.05, 14: 0.05, 15: 0.05, 16: 0.05, 17: 0.05, 18: 0.05, 19: 0.05, 20: 0.05, 21: 0.05, 22: 0.10, 23: 0.10, 24: 0.10, 25: 0.10 },
  5: { 5: 0, 6: 0, 7: 0, 8: 0, 9: 0.05, 10: 0.05, 11: 0.05, 12: 0.05, 13: 0.05, 14: 0.05, 15: 0.05, 16: 0.05, 17: 0.05, 18: 0.05, 19: 0.05, 20: 0.05, 21: 0.05, 22: 0.05, 23: 0.05, 24: 0.05, 25: 0.05 }
};

export const MORTALITY_TABLE: Record<number, number> = {
  18: 0.00041, 19: 0.000427, 20: 0.000444, 21: 0.000461, 22: 0.00048, 23: 0.000499, 24: 0.000519, 25: 0.000539,
  26: 0.000561, 27: 0.000583, 28: 0.000606, 29: 0.00063, 30: 0.000655, 31: 0.000682, 32: 0.000756, 33: 0.000839,
  34: 0.00093, 35: 0.001031, 36: 0.001144, 37: 0.001268, 38: 0.001407, 39: 0.00156, 40: 0.00173, 41: 0.001919,
  42: 0.002128, 43: 0.00236, 44: 0.002617, 45: 0.002902, 46: 0.003726, 47: 0.004128, 48: 0.004573, 49: 0.005066,
  50: 0.005612, 51: 0.006218, 52: 0.006888, 53: 0.007631, 54: 0.008454, 55: 0.009365, 56: 0.010375, 57: 0.011494,
  58: 0.012734, 59: 0.014107, 60: 0.015629, 61: 0.017314, 62: 0.019181, 63: 0.02125, 64: 0.023542, 65: 0.02608,
  66: 0.028893, 67: 0.032009, 68: 0.035461, 69: 0.039285, 70: 0.043522
};

export const CIC_MALE: Record<number, number[]> = {
  18: [0.5, 0.54, 0.55, 0.57, 0.58, 0.59, 0.6, 0.62, 0.63, 0.64, 0.67],
  19: [0.53, 0.57, 0.58, 0.59, 0.61, 0.62, 0.63, 0.65, 0.66, 0.68, 0.7],
  20: [0.55, 0.59, 0.61, 0.62, 0.64, 0.65, 0.67, 0.68, 0.7, 0.71, 0.74],
  21: [0.58, 0.62, 0.64, 0.65, 0.67, 0.69, 0.7, 0.72, 0.74, 0.75, 0.78],
  22: [0.61, 0.66, 0.67, 0.69, 0.70, 0.72, 0.74, 0.76, 0.78, 0.79, 0.82],
  23: [0.64, 0.69, 0.70, 0.72, 0.74, 0.76, 0.78, 0.80, 0.82, 0.84, 0.87],
  24: [0.67, 0.73, 0.74, 0.76, 0.78, 0.81, 0.82, 0.85, 0.87, 0.89, 0.92],
  25: [0.71, 0.77, 0.78, 0.8, 0.83, 0.85, 0.87, 0.9, 0.92, 0.94, 0.98],
  26: [0.75, 0.81, 0.83, 0.85, 0.87, 0.9, 0.92, 0.95, 0.97, 1, 1.04],
  27: [0.79, 0.85, 0.87, 0.9, 0.92, 0.96, 0.98, 1.01, 1.04, 1.06, 1.11],
  28: [0.83, 0.9, 0.93, 0.95, 0.98, 1.01, 1.04, 1.07, 1.1, 1.13, 1.18],
  29: [0.88, 0.96, 0.98, 1.01, 1.04, 1.08, 1.11, 1.14, 1.17, 1.21, 1.26],
  30: [0.94, 1.01, 1.04, 1.07, 1.11, 1.15, 1.18, 1.22, 1.25, 1.29, 1.34],
  31: [0.99, 1.08, 1.11, 1.14, 1.18, 1.22, 1.26, 1.30, 1.34, 1.38, 1.44],
  32: [1.06, 1.15, 1.18, 1.22, 1.26, 1.31, 1.34, 1.39, 1.43, 1.48, 1.54],
  33: [1.13, 1.22, 1.26, 1.3, 1.34, 1.4, 1.44, 1.49, 1.54, 1.58, 1.65],
  34: [1.2, 1.3, 1.34, 1.39, 1.44, 1.5, 1.54, 1.60, 1.65, 1.7, 1.78],
  35: [1.28, 1.4, 1.44, 1.49, 1.54, 1.6, 1.65, 1.72, 1.77, 1.83, 1.91],
  36: [1.37, 1.5, 1.54, 1.6, 1.66, 1.72, 1.78, 1.85, 1.9, 1.97, 2.06],
  37: [1.47, 1.6, 1.66, 1.72, 1.78, 1.85, 1.91, 1.99, 2.05, 2.12, 2.21],
  38: [1.58, 1.72, 1.78, 1.85, 1.91, 2, 2.06, 2.14, 2.21, 2.28, 2.39],
  39: [1.7, 1.85, 1.92, 1.99, 2.06, 2.15, 2.22, 2.31, 2.38, 2.46, 2.57],
  40: [1.83, 2, 2.07, 2.14, 2.22, 2.32, 2.39, 2.49, 2.57, 2.66, 2.78],
  41: [1.97, 2.15, 2.23, 2.31, 2.4, 2.5, 2.58, 2.68, 2.77, 2.86, 2.99],
  42: [2.13, 2.32, 2.4, 2.5, 2.59, 2.7, 2.79, 2.9, 2.99, 3.09, 3.23],
  43: [2.3, 2.51, 2.59, 2.69, 2.8, 2.92, 3.01, 3.13, 3.23, 3.33, 3.48],
  44: [2.48, 2.71, 2.8, 2.91, 3.02, 3.15, 3.25, 3.37, 3.48, 3.6, 3.76],
  45: [2.68, 2.92, 3.03, 3.14, 3.26, 3.40, 3.51, 3.64, 3.76, 3.88, 4.05],
  46: [2.89, 3.16, 3.27, 3.39, 3.52, 3.67, 3.78, 3.93, 4.06, 4.19],
  47: [3.13, 3.41, 3.53, 3.66, 3.8, 3.96, 4.08, 4.24, 4.37],
  48: [3.38, 3.68, 3.81, 3.95, 4.1, 4.27, 4.4, 4.57],
  49: [3.64, 3.98, 4.11, 4.27, 4.42, 4.61, 4.75],
  50: [3.93, 4.29, 4.44, 4.6, 4.77, 4.97]
};

export const CIC_FEMALE: Record<number, number[]> = {
  18: [0.45, 0.48, 0.49, 0.51, 0.52, 0.54, 0.56, 0.57, 0.59, 0.6, 0.63],
  19: [0.47, 0.51, 0.53, 0.54, 0.56, 0.58, 0.59, 0.61, 0.63, 0.64, 0.67],
  20: [0.5, 0.54, 0.56, 0.58, 0.59, 0.61, 0.63, 0.65, 0.67, 0.68, 0.71],
  21: [0.53, 0.58, 0.59, 0.61, 0.63, 0.65, 0.67, 0.69, 0.71, 0.73, 0.75],
  22: [0.57, 0.62, 0.63, 0.65, 0.67, 0.7, 0.71, 0.74, 0.75, 0.77, 0.8],
  23: [0.6, 0.65, 0.67, 0.69, 0.71, 0.74, 0.76, 0.78, 0.8, 0.82, 0.86],
  24: [0.64, 0.7, 0.72, 0.74, 0.76, 0.79, 0.81, 0.83, 0.86, 0.88, 0.91],
  25: [0.69, 0.74, 0.76, 0.79, 0.81, 0.84, 0.86, 0.89, 0.91, 0.94, 0.97],
  26: [0.73, 0.79, 0.81, 0.84, 0.86, 0.89, 0.92, 0.95, 0.97, 1, 1.04],
  27: [0.78, 0.84, 0.87, 0.89, 0.92, 0.95, 0.98, 1.01, 1.04, 1.06, 1.1],
  28: [0.83, 0.9, 0.92, 0.95, 0.98, 1.02, 1.04, 1.08, 1.1, 1.13, 1.18],
  29: [0.88, 0.96, 0.98, 1.01, 1.04, 1.08, 1.11, 1.15, 1.18, 1.21, 1.26],
  30: [0.94, 1.02, 1.05, 1.08, 1.11, 1.15, 1.18, 1.22, 1.26, 1.29, 1.34],
  31: [1, 1.09, 1.12, 1.15, 1.19, 1.23, 1.26, 1.31, 1.34, 1.38, 1.43],
  32: [1.07, 1.16, 1.19, 1.23, 1.27, 1.31, 1.35, 1.39, 1.43, 1.47, 1.53],
  33: [1.14, 1.23, 1.27, 1.31, 1.35, 1.4, 1.44, 1.49, 1.53, 1.57, 1.64],
  34: [1.21, 1.32, 1.35, 1.4, 1.44, 1.5, 1.54, 1.59, 1.63, 1.68, 1.75],
  35: [1.29, 1.4, 1.45, 1.49, 1.54, 1.6, 1.64, 1.7, 1.75, 1.8, 1.87],
  36: [1.38, 1.5, 1.54, 1.6, 1.65, 1.71, 1.76, 1.82, 1.87, 1.92, 2],
  37: [1.48, 1.6, 1.65, 1.71, 1.76, 1.83, 1.88, 1.94, 2, 2.05, 2.14],
  38: [1.58, 1.71, 1.77, 1.83, 1.89, 1.96, 2.01, 2.08, 2.14, 2.2, 2.28],
  39: [1.69, 1.83, 1.89, 1.95, 2.02, 2.09, 2.15, 2.22, 2.28, 2.35, 2.44],
  40: [1.81, 1.96, 2.02, 2.09, 2.16, 2.24, 2.3, 2.38, 2.44, 2.51, 2.60],
  41: [1.93, 2.1, 2.17, 2.24, 2.31, 2.4, 2.46, 2.54, 2.61, 2.67, 2.77],
  42: [2.07, 2.25, 2.32, 2.39, 2.47, 2.56, 2.63, 2.71, 2.78, 2.85, 2.96],
  43: [2.22, 2.41, 2.48, 2.56, 2.64, 2.74, 2.8, 2.89, 2.97, 3.04, 3.15],
  44: [2.37, 2.58, 2.65, 2.74, 2.82, 2.92, 2.99, 3.09, 3.16, 3.24, 3.36],
  45: [2.54, 2.76, 2.83, 2.92, 3.01, 3.11, 3.19, 3.29, 3.37, 3.45, 3.57],
  46: [2.71, 2.94, 3.02, 3.12, 3.21, 3.32, 3.4, 3.5, 3.58, 3.67],
  47: [2.90, 3.14, 3.22, 3.32, 3.42, 3.53, 3.61, 3.72, 3.81],
  48: [3.09, 3.34, 3.43, 3.53, 3.63, 3.76, 3.84, 3.96],
  49: [3.29, 3.56, 3.65, 3.76, 3.86, 3.99, 4.08],
  50: [3.50, 3.78, 3.88, 3.99, 4.1, 4.24]
};

export const HI_TABLE: Record<number, number[]> = {
  18: [745, 766, 775, 782, 790, 798, 806, 814, 822, 830, 839],
  20: [745, 766, 775, 783, 790, 798, 806, 814, 822, 831, 839],
  25: [746, 766, 775, 783, 791, 799, 807, 815, 823, 831, 839],
  30: [746, 766, 775, 783, 791, 799, 807, 815, 823, 831, 840],
  40: [746, 766, 775, 783, 791, 799, 807, 815, 823, 831, 842],
  41: [746, 766, 775, 783, 791, 803, 811, 819, 827, 835, 859],
  42: [746, 766, 778, 786, 795, 812, 820, 833, 841, 852, 880],
  43: [746, 769, 784, 792, 806, 825, 834, 850, 861, 874, 905],
  44: [749, 776, 793, 803, 820, 842, 853, 872, 884, 900, 934],
  45: [757, 787, 807, 819, 839, 863, 877, 897, 913, 931, 969],
  46: [770, 803, 825, 839, 862, 889, 905, 928, 947, 978, 978],
  47: [788, 824, 849, 865, 890, 920, 939, 965, 986, 986, 986],
  48: [813, 851, 878, 897, 924, 957, 978, 1008, 1008, 1008, 1008],
  49: [841, 882, 911, 932, 963, 999, 1024, 1024, 1024, 1024, 1024],
  50: [872, 916, 949, 973, 1007, 1047, 1047, 1047, 1047, 1047, 1047]
};

// --- Helper Functions ---

export const getPremiumChargeRate = (year: number, term: number): number => {
  if (year > 5) return 0;
  const yearRates = PREMIUM_CHARGE_SCALE[year];
  if (!yearRates) return 0;
  
  const availableTerms = Object.keys(yearRates).map(Number).sort((a, b) => b - a);
  const termKey = availableTerms.find(t => t <= term);
  return termKey ? yearRates[termKey] : 0;
};

export const getAdminCharge = (annualPremium: number): number => {
  return 50;
};

export const getMortalityRate = (age: number): number => {
  const availableAges = Object.keys(MORTALITY_TABLE).map(Number).sort((a, b) => a - b);
  const ageKey = availableAges.slice().reverse().find(a => a <= age) || 18;
  return MORTALITY_TABLE[ageKey];
};

export const getCIRate = (age: number, term: number, gender: string): number => {
  const table = gender.toLowerCase() === 'female' ? CIC_FEMALE : CIC_MALE;
  const availableAges = Object.keys(table).map(Number).sort((a, b) => a - b);
  const ageKey = availableAges.slice().reverse().find(a => a <= age) || 18;
  const rates = table[ageKey];
  const termIdx = Math.max(0, Math.min(term - 5, rates.length - 1));
  return rates[termIdx] || 0;
};

export const getHIRate = (age: number, term: number): number => {
  const availableAges = Object.keys(HI_TABLE).map(Number).sort((a, b) => a - b);
  const ageKey = availableAges.slice().reverse().find(a => a <= age) || 18;
  const rates = HI_TABLE[ageKey];
  const termIdx = Math.max(0, Math.min(term - 5, rates.length - 1));
  return rates[termIdx] || 0;
};

// Source SDPP age-nearest-birthday rule: round up when completed extra months >= 6.
const calculateSDPPAge = (dob: string, purchaseDate: string): number => {
  const birth = new Date(dob);
  const purchase = new Date(purchaseDate);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(purchase.getTime())) return 0;
  let years = purchase.getFullYear() - birth.getFullYear();
  let months = purchase.getMonth() - birth.getMonth();
  if (purchase.getDate() < birth.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  return years + (months >= 6 ? 1 : 0);
};

// Main Run Calculations function for SDPP
export const runSDPPCalculations = (inputs: CalculationInput): SDPPResult => {
  const { 
    dob, 
    purchaseDate = new Date().toISOString().split('T')[0], 
    sdppPlan = 'Elite', 
    paymentMethod: premiumMode, 
    term: policyTerm, 
    targetPremium: inputPremium = 0, 
    gender, 
    dailyHospitalCoverage = 0, 
    projectionMonth = 0,
    age: inputAge,
    ciCoverage
  } = inputs;
  
  const errors: string[] = [];
  const age = dob && purchaseDate ? calculateSDPPAge(dob, purchaseDate) : inputAge;
  const pTerm = Number(policyTerm);
  const pMonth = Number(projectionMonth) || 0;

  const isElite = sdppPlan === 'Elite';
  const isPrime = sdppPlan.toLowerCase() === 'prime';
  const isSignature = sdppPlan.toLowerCase() === 'signature';
  const isPrimeOrSignature = isPrime || isSignature;

  // 1. Premium Mode Normalization & Validation
  let mBasicPremium = 0;
  let minPremium = 0;
  
  switch (premiumMode) {
    case 'Monthly':
      mBasicPremium = inputPremium;
      minPremium = isElite ? 4000 : 2000;
      break;
    case 'Quarterly':
      mBasicPremium = inputPremium / 3;
      minPremium = isElite ? 12000 : 6000;
      break;
    case 'Half-yearly':
      mBasicPremium = inputPremium / 6;
      minPremium = isElite ? 24000 : 12000;
      break;
    case 'Yearly':
      mBasicPremium = inputPremium / 12;
      minPremium = isElite ? 48000 : 24000;
      break;
    default:
      mBasicPremium = inputPremium;
  }

  if (inputPremium < minPremium && inputPremium > 0) {
    errors.push(`Minimum premium for ${sdppPlan} plan with ${premiumMode} mode is ৳${minPremium.toLocaleString()}`);
  }

  if (isElite) {
    if (age < 18 || age > 50) {
      errors.push("Entry age for Elite plan must be between 18 and 50 years");
    }
    if (age + pTerm > 60) {
      errors.push(`Maximum maturity age for Elite plan is 60 (Current: ${age + pTerm})`);
    }
  } else if (isPrimeOrSignature) {
    if (age < 18 || age > 60) {
      errors.push(`Entry age for ${sdppPlan} plan must be between 18 and 60 years`);
    }
    if (age + pTerm > 70) {
      errors.push(`Maximum maturity age for ${sdppPlan} plan is 70 (Current: ${age + pTerm})`);
    }
  }

  const annualPremium = mBasicPremium * 12;

  // Rider Premium (Constant throughout the term, not invested)
  const riderTerm = Math.max(0, Math.min(pTerm, 15, 60 - age));
  
  const ciCoverageValue = !isPrimeOrSignature ? (Number(ciCoverage) || Math.min(0.5 * (annualPremium * pTerm), 1500000)) : 0;
  const ciMonthly = !isPrimeOrSignature ? (((ciCoverageValue / 1000) * getCIRate(age, riderTerm, gender)) / 12) : 0;
  const hiMonthly = (!isPrimeOrSignature && Number(dailyHospitalCoverage) >= 1000) ? ((Number(dailyHospitalCoverage) / 1000) * getHIRate(age, riderTerm)) / 12 : 0;

  if (Number(dailyHospitalCoverage) >= 1000 && !isPrimeOrSignature) {
    const faceAmountForLimits = annualPremium * pTerm;
    const maxHI = Math.min(0.02 * faceAmountForLimits, 25000);
    if (Number(dailyHospitalCoverage) > maxHI) {
      errors.push(`Daily Hospital Coverage cannot exceed ${maxHI.toLocaleString()} (2% of Face Amount or 25,000)`);
    }
  }

  if (isElite && Number(dailyHospitalCoverage) > 0 && Number(dailyHospitalCoverage) < 1000) {
    errors.push("Daily Hospital Coverage must be at least 1,000");
  }

  // Modal Rider Premiums
  let modeFactor = 1;
  if (premiumMode === 'Quarterly') modeFactor = 3;
  if (premiumMode === 'Half-yearly') modeFactor = 6;
  if (premiumMode === 'Yearly') modeFactor = 12;

  const ciModePremium = ciMonthly * modeFactor;
  const hiModePremium = hiMonthly * modeFactor;

  const calculateAV = (annualRate: number, targetMonth: number, paymentMonths: number = targetMonth) => {
    let av = 0;
    const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
    const dailyRateBase = Math.pow(1 + annualRate, 1 / 365); 

    const modeMonths = premiumMode === 'Monthly' ? 1 :
                       premiumMode === 'Quarterly' ? 3 :
                       premiumMode === 'Half-yearly' ? 6 : 12;

    const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    for (let m = 1; m <= targetMonth; m++) {
      const policyYear = Math.ceil(m / 12);
      const attainedAge = age + policyYear - 1;
      const daysInMonth = daysPerMonth[(m - 1) % 12];

      // 1. Plan-Specific Sum Assured (SA) Logic
      let currentSA = 0;
      if (isPrime) {
        const totalBasicPaidToDate = mBasicPremium * Math.min(m, paymentMonths);
        currentSA = Math.max(totalBasicPaidToDate, av);
      } else {
        currentSA = annualPremium * pTerm;
      }

      // 2. Premium Allocation (BOM) — only basic premium enters AV
      let allocatedPremium = 0;
      if (m <= paymentMonths) {
        const isDue = (m - 1) % modeMonths === 0;
        if (isDue) {
          allocatedPremium = (mBasicPremium * modeMonths) * (1 - getPremiumChargeRate(policyYear, pTerm));
        }
      }

      // 3. Charges
      const adminCharge = getAdminCharge(annualPremium);
      const mortalityRate = getMortalityRate(attainedAge) / 12;

      const balanceForNAR = av - adminCharge;
      const NAR = Math.max(0, currentSA - balanceForNAR);
      const deathBenefitCharge = NAR * mortalityRate;

      const totalCharges = adminCharge + deathBenefitCharge;

      // 4. AV Update
      av = (av - totalCharges) * (1 + monthlyRate)
           + allocatedPremium * Math.pow(dailyRateBase, daysInMonth);

      if (av < 0) av = 0;
    }
    return Math.round(av);
  };

  const getCSV = (accountValue: number, month: number) => {
    const year = Math.ceil(month / 12);
    const table: Record<number, number> = { 1: 1.0, 2: 0.6, 3: 0.3, 4: 0.2, 5: 0.1 };
    const chargePercent = table[year] || 0;
    const processingFee = 200;
    return Math.max(0, accountValue - (accountValue * chargePercent) - processingFee);
  };

  const maturity7Val = calculateAV(SDPP_ILLUSTRATION_RATES.lower / 100, pTerm * 12);
  const maturity9Val = calculateAV(SDPP_ILLUSTRATION_RATES.higher / 100, pTerm * 12);

  const customRate = Number(inputs.customInterestRate);
  const customMaturity = (customRate && customRate > 0) ? calculateAV(customRate / 100, pTerm * 12) : undefined;
  const totalModePremium = inputPremium + ciModePremium + hiModePremium;

  // Source SDPP projection: announced rate defaults to 8%, monthly balance and
  // daily-compounded allocated premium are calculated separately.
  const announcedRate = SDPP_ILLUSTRATION_RATES.projection;
  const qMonthlyRate = Math.pow(1 + announcedRate / 100, 1 / 12) - 1;
  const qDailyRateBase = Math.pow(1 + announcedRate / 100, 1 / 365);
  const modeMonths = premiumMode === 'Monthly' ? 1 : premiumMode === 'Quarterly' ? 3 : premiumMode === 'Half-yearly' ? 6 : 12;
  const fullYearDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const projection: SDPPResult['projection'] = [];
  let projAV = 0;
  for (let year = 1; year <= pTerm; year++) {
    let yearCharges = 0;
    let yearInterest = 0;
    for (let monthInYear = 1; monthInYear <= 12; monthInYear++) {
      const m = (year - 1) * 12 + monthInYear;
      const openingAV = projAV;
      const premiumDeposit = (m - 1) % modeMonths === 0 ? mBasicPremium * modeMonths : 0;
      const premiumFee = premiumDeposit * getPremiumChargeRate(year, pTerm);
      const allocatedPremium = premiumDeposit - premiumFee;
      const adminFee = getAdminCharge(annualPremium);
      const mortalityRate = getMortalityRate(age + year - 1) / 12;
      const currentSA = isPrime ? Math.max(allocatedPremium, openingAV) : annualPremium * pTerm;
      const NAR = Math.max(0, currentSA - (openingAV - adminFee));
      const totalCharges = adminFee + NAR * mortalityRate;
      const netBase = openingAV - totalCharges;
      const interestEarned = netBase * qMonthlyRate + allocatedPremium * (Math.pow(qDailyRateBase, fullYearDays[monthInYear - 1]) - 1);
      projAV = Math.max(0, netBase + allocatedPremium + interestEarned);
      yearCharges += totalCharges;
      yearInterest += interestEarned;
    }
    projection.push({ year, premiumPaid: Math.round(annualPremium * year), charges: Math.round(yearCharges), interest: Math.round(yearInterest), accountValue: Math.round(projAV) });
  }

  const calculateTotalPaidAtMonth = (month: number) => {
    let total = mBasicPremium * month;
    const riderMonthsPaid = Math.min(month, 15 * 12);
    total += (ciMonthly + hiMonthly) * riderMonthsPaid;
    return total;
  };

  const totalPremiumPaidAtSurrender = pMonth > 0 ? calculateTotalPaidAtMonth(pMonth) : 0;
  const totalPaidAtStop = pMonth > 0 ? calculateTotalPaidAtMonth(pMonth) : 0;

  const avAtSurrender7 = pMonth > 0 ? calculateAV(SDPP_ILLUSTRATION_RATES.lower / 100, pMonth) : 0;
  const avAtSurrender9 = pMonth > 0 ? calculateAV(SDPP_ILLUSTRATION_RATES.higher / 100, pMonth) : 0;

  const surrenderYear = Math.ceil(pMonth / 12);
  const chargeTable: Record<number, number> = { 1: 1.0, 2: 0.6, 3: 0.3, 4: 0.2, 5: 0.1 };
  const currentSurrenderChargePercent = pMonth > 0 ? (chargeTable[surrenderYear] || 0) * 100 : 0;

  return {
    age,
    annualPremium,
    sumAssured: isPrime ? "For Guaranteed Sum Assured please choose Signature Plan" : (annualPremium * pTerm),
    totalPremiumPaid: (annualPremium * pTerm) + ((ciMonthly + hiMonthly) * 12 * riderTerm),
    totalBasicPremiumPaid: annualPremium * pTerm,
    totalRiderPremiumPaid: (ciMonthly + hiMonthly) * 12 * riderTerm,
    deathBenefit: isPrime ? "Current account value or Paid Basic premium, whichever is higher" : (annualPremium * pTerm),
    accidentalBenefit: !!sdppPlan ? Math.min(annualPremium * pTerm * 2, 10000000) : 0,
    ciCoverage: ciCoverageValue,
    ciMonthlyPremium: ciMonthly,
    hiMonthlyPremium: hiMonthly,
    ciModePremium: ciModePremium,
    hiModePremium: hiModePremium,
    hospitalCoverage: (isPrimeOrSignature || Number(dailyHospitalCoverage) < 1000) ? 0 : ((Number(dailyHospitalCoverage) || 0) * 25),
    totalModePremium,
    maturity7: maturity7Val,
    maturity9: maturity9Val,
    customMaturity,
    taxRebate: annualPremium * 0.10,
    surrenderValue7: pMonth > 0 ? getCSV(avAtSurrender7, pMonth) : 0,
    surrenderValue9: pMonth > 0 ? getCSV(avAtSurrender9, pMonth) : 0,
    errors,
    projection,
    totalPremiumPaidAtSurrender,
    totalBasicPremiumPaidAtSurrender: pMonth > 0 ? mBasicPremium * pMonth : 0,
    totalRiderPremiumPaidAtSurrender: pMonth > 0 ? totalPremiumPaidAtSurrender - (mBasicPremium * pMonth) : 0,
    surrenderChargePercent: currentSurrenderChargePercent,
    stopPaymentMaturity7: pMonth > 0 ? calculateAV(SDPP_ILLUSTRATION_RATES.lower / 100, pTerm * 12, pMonth) : 0,
    stopPaymentMaturity9: pMonth > 0 ? calculateAV(SDPP_ILLUSTRATION_RATES.higher / 100, pTerm * 12, pMonth) : 0,
    totalPaidAtStop,
  };
};
