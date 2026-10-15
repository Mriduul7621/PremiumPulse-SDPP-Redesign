import { 
  MODAL_FACTORS, 
  SCEP_1_ANNUAL_RATES,
  SCEP_2_ANNUAL_RATES,
  SCEP_3_ANNUAL_RATES,
  ENDOWMENT_ANNUAL_RATES,
  SPE_MATURITY_TABLE,
  SCEP_1_SINGLE_RATES,
  SCEP_2_SINGLE_RATES,
  SCEP_3_SINGLE_RATES
} from '../data/rates';
import { CalculationInput, CalculationResult, PlanFrequency, ProjectionRow } from '../data/types';
import { runSDPPCalculations } from './sdpCalculator';
import { SCEP_CSV, ENDOWMENT_CSV, SSPE_CSV, SCEP_SINGLE_CSV } from '../data/csv_rates';
import { ETI_RATES } from '../data/eti_rates';
import { S4PP_ANNUAL_RATES, S4PP_CSV, S4PP_ETI_RATES } from '../data/s4pp_rates';
import { S3PP_ANNUAL_RATES, S3PP_CSV, S3PP_ETI_RATES } from '../data/s3pp_rates';

import { ciCoverageAmount, isCiRiderEligible } from '../data/ciDiseases';
import { getCIRate } from '../lib/rateLookup';

const ACCIDENTAL_RATE = 5.57; // per 1000

export function calculateSAFromPremium(input: CalculationInput, selectedProductId: string): number {
  const { age, term, targetPremium, paymentMethod } = input;
  if (!targetPremium || targetPremium <= 0) return input.sumAssured;

  // We need to find the rate for the selected product
  const products = [
    { id: 'endowment', name: 'Shanta Endowment Plan', rates: ENDOWMENT_ANNUAL_RATES },
    { id: 's3pp', name: 'Shanta 3 Stage Plan', rates: S3PP_ANNUAL_RATES },
    { id: 's4pp', name: 'Shanta 4 Stage Plan', rates: S4PP_ANNUAL_RATES },
    { id: 'sspe', name: 'Shanta Single Premium Endowment', rates: SPE_MATURITY_TABLE }, 
    { id: 'scep_1', name: 'Shanta Child Education Plan (1%)', rates: SCEP_1_ANNUAL_RATES },
    { id: 'scep_2', name: 'Shanta Child Education Plan (2%)', rates: SCEP_2_ANNUAL_RATES },
    { id: 'scep_3', name: 'Shanta Child Education Plan (3%)', rates: SCEP_3_ANNUAL_RATES },
    { id: 'scep_single_1', name: 'Shanta Child Education (Single) 1%', rates: SCEP_1_SINGLE_RATES },
    { id: 'scep_single_2', name: 'Shanta Child Education (Single) 2%', rates: SCEP_2_SINGLE_RATES },
    { id: 'scep_single_3', name: 'Shanta Child Education (Single) 3%', rates: SCEP_3_SINGLE_RATES },
  ];

  const product = products.find(p => p.id === selectedProductId) || products[0];
  const isSSPE = product.id === 'sspe';
  
  if (isSSPE) {
    // For SSPE, Premium = Sum Assured
    return targetPremium;
  }

  // Find rate
  const agesAvailable = Object.keys(product.rates).map(Number);
  const targetAge = agesAvailable.reduce((prev, curr) => 
    Math.abs(curr - age) < Math.abs(prev - age) ? curr : prev, 26);
  const baseRatesForAge = product.rates[targetAge];
  
  let baseRate = 0;
  if (baseRatesForAge) {
    const termsAvailable = Object.keys(baseRatesForAge).map(Number);
    const nearestTerm = termsAvailable.reduce((prev, curr) => 
      Math.abs(curr - term) < Math.abs(prev - term) ? curr : prev);
    baseRate = baseRatesForAge[nearestTerm];
  }

  if (baseRate === 0) return input.sumAssured;

  const modalFactor = MODAL_FACTORS[paymentMethod] || 1;
  const isSinglePremiumPlan = product.id.startsWith('scep_single_');

  // Target Premium fixes the BASIC policy premium and determines its Sum Assured.
  // Optional rider charges are calculated afterwards from that resulting SA;
  // they must not reduce SA or be deducted from the target base premium.
  const effectiveModalFactor = isSinglePremiumPlan ? 1 : modalFactor;
  const sa = (targetPremium * 1000) / (effectiveModalFactor * baseRate);
  return Math.ceil(sa / 1000) * 1000; // Round up to nearest 1000

}

export function calculateProjection(input: CalculationInput, selectedProductId: string): ProjectionRow[] {
  const { term, sumAssured, age } = input;
  const projection: ProjectionRow[] = [];
  
  // Find the appropriate CSV table
  let csvTable: Record<number, Record<number, number>> | null = null;
  if (selectedProductId === 'endowment') csvTable = ENDOWMENT_CSV;
  else if (selectedProductId === 's3pp') csvTable = S3PP_CSV;
  else if (selectedProductId === 's4pp') csvTable = S4PP_CSV;
  else if (selectedProductId === 'sspe') csvTable = SSPE_CSV;
  else if (selectedProductId.startsWith('scep_single')) csvTable = SCEP_SINGLE_CSV;
  else if (selectedProductId.startsWith('scep')) csvTable = SCEP_CSV;

  // Get base premium for the selected product
  const results = calculatePremiums(input);
  const selectedProduct = results.find(r => r.productId === selectedProductId);
  const modalPremium = selectedProduct ? selectedProduct.basePremium[input.paymentMethod] : 0;
  const isSinglePremium = input.paymentMethod === 'Single';

  const installmentsPerYear = {
    'Monthly': 12,
    'Quarterly': 4,
    'Half-yearly': 2,
    'Yearly': 1,
    'Single': 1
  }[input.paymentMethod] || 1;

  const yearlyTotal = isSinglePremium ? modalPremium : (modalPremium * installmentsPerYear);

  let cumulativePremium = 0;
  for (let t = 1; t <= term; t++) {
    const csvRate = (csvTable && csvTable[term]) ? csvTable[term][t] || 0 : 0;
    const surrenderValue = Math.ceil((sumAssured / 1000) * csvRate);
    
    // Calculate yearly premium paid (WITHOUT RIDERS as requested)
    const yearlyPremiumIncr = (isSinglePremium ? (t === 1 ? yearlyTotal : 0) : yearlyTotal);
    cumulativePremium += yearlyPremiumIncr;
    
    // RPU Calculation
    // Months paid / Months originally payable
    // Year t, months paid = t * 12 (if not single premium)
    const monthsPaid = isSinglePremium ? term * 12 : t * 12;
    const totalMonths = term * 12;
    const rpuFactor = Math.min(monthsPaid / totalMonths, 1);
    
    // Simplified partial maturity check for 3PP/4PP
    let partialMaturitiesPaid = 0;
    if (selectedProductId === 's3pp') {
      if (t > term / 3) partialMaturitiesPaid += sumAssured * 0.25;
      if (t > (term * 2) / 3) partialMaturitiesPaid += sumAssured * 0.25;
    } else if (selectedProductId === 's4pp') {
      if (t > term / 4) partialMaturitiesPaid += sumAssured * 0.15;
      if (t > (term * 2) / 4) partialMaturitiesPaid += sumAssured * 0.15;
      if (t > (term * 3) / 4) partialMaturitiesPaid += sumAssured * 0.15;
    }

    const paidUpValue = t >= 2 ? Math.ceil((sumAssured * rpuFactor) - partialMaturitiesPaid) : 0;

    // ETI Calculation (Return/Extra Amount Based on Full Term)
    const remTerm = term - t;
    let etiCoverage = 0;
    let etiDurationStr = '—';
    let etiSurplus = 0;
    
    if (surrenderValue > 0 && remTerm > 0) {
      const activeEtiTable = selectedProductId === 's4pp' ? S4PP_ETI_RATES : (selectedProductId === 's3pp' ? S3PP_ETI_RATES : ETI_RATES);
      const etiAges = Object.keys(activeEtiTable).map(Number);
      const nearestEtiAge = etiAges.reduce((prev, curr) => 
        Math.abs(curr - (age + t)) < Math.abs(prev - (age + t)) ? curr : prev, 30);
      const etiRatesForAge = activeEtiTable[nearestEtiAge];
      
      const termsAvailable = Object.keys(etiRatesForAge).map(Number).sort((a, b) => a - b);
      
      // User wants to know from specific year to maturity PORJONTO (until maturity)
      // cost to maintain same life coverage (sumAssured) for remaining term
      let rateFull = etiRatesForAge[remTerm];
      if (rateFull === undefined) {
          const maxT = Math.max(...termsAvailable);
          if (remTerm > maxT) rateFull = etiRatesForAge[maxT];
          else {
            const nearestT = termsAvailable.reduce((prev, curr) => 
              Math.abs(curr - remTerm) < Math.abs(prev - remTerm) ? curr : prev);
            rateFull = etiRatesForAge[nearestT];
          }
      }

      const costFull = (sumAssured / 1000) * (rateFull || 0);
      const diff = surrenderValue - costFull;
      
      // Formatting as requested: positive figure for return, negative for extra required
      etiDurationStr = (diff >= 0 ? "+" : "") + Math.ceil(diff).toLocaleString();
      etiCoverage = sumAssured;
      etiSurplus = Math.ceil(diff);
    }

    projection.push({
      year: t,
      premium: cumulativePremium,
      deathBenefit: sumAssured,
      surrenderValue: surrenderValue,
      maturityValue: t === term ? (selectedProduct?.maturityValue || sumAssured) : 0,
      paidUpValue: Math.max(0, paidUpValue),
      etiCoverage: etiCoverage,
      etiSurplus: etiSurplus,
      etiDurationStr: etiDurationStr
    });
  }

  return projection;
}

export function calculatePremiums(input: CalculationInput): (CalculationResult | any)[] {
  const { age, term, sumAssured, gender, hasAccidentalProtection, hasCIClassic, hasCIStandard } = input;
  
  const products = [
    { id: 'endowment', name: 'Shanta Endowment Plan', rates: ENDOWMENT_ANNUAL_RATES }, 
    { id: 's3pp', name: 'Shanta 3 Stage Plan', rates: S3PP_ANNUAL_RATES },
    { id: 's4pp', name: 'Shanta 4 Stage Plan', rates: S4PP_ANNUAL_RATES },
    { id: 'sspe', name: 'Shanta Single Premium Endowment', rates: SPE_MATURITY_TABLE }, 
    { id: 'scep_1', name: 'Shanta Child Education Plan (1%)', rates: SCEP_1_ANNUAL_RATES },
    { id: 'scep_2', name: 'Shanta Child Education Plan (2%)', rates: SCEP_2_ANNUAL_RATES },
    { id: 'scep_3', name: 'Shanta Child Education Plan (3%)', rates: SCEP_3_ANNUAL_RATES },
    { id: 'scep_single_1', name: 'Shanta Child Education (Single) 1%', rates: SCEP_1_SINGLE_RATES },
    { id: 'scep_single_2', name: 'Shanta Child Education (Single) 2%', rates: SCEP_2_SINGLE_RATES },
    { id: 'scep_single_3', name: 'Shanta Child Education (Single) 3%', rates: SCEP_3_SINGLE_RATES },
  ];

  const standardResults = products.map(product => {
    // Nearest neighbor lookup for age
    const agesAvailable = Object.keys(product.rates).map(Number);
    const targetAge = agesAvailable.reduce((prev, curr) => 
      Math.abs(curr - age) < Math.abs(prev - age) ? curr : prev, 26);
    
    const baseRatesForAge = product.rates[targetAge] || product.rates[26];
    
    // Check for exact term first, then nearest term
    let baseRate = baseRatesForAge ? baseRatesForAge[term] : null;
    if (!baseRate && baseRatesForAge) {
      const termsAvailable = Object.keys(baseRatesForAge).map(Number);
      if (termsAvailable.length > 0) {
        const nearestTerm = termsAvailable.reduce((prev, curr) => 
          Math.abs(curr - term) < Math.abs(prev - term) ? curr : prev);
        baseRate = baseRatesForAge[nearestTerm];
      }
    }
    
    if (!baseRate) {
      return {
        productId: product.id,
        productName: product.name,
        pricePer1000: 0,
        basePremium: Object.fromEntries(Object.keys(MODAL_FACTORS).map(f => [f, 0])) as any,
        riderPremium: Object.fromEntries(Object.keys(MODAL_FACTORS).map(f => [f, 0])) as any,
        totalPremium: Object.fromEntries(Object.keys(MODAL_FACTORS).map(f => [f, 0])) as any,
        isApplicable: false,
        message: `Not applicable for Age ${age} & Term ${term}`
      };
    }

    const isSSPE = product.id === 'sspe';
    const isSinglePremiumSCEP = product.id.startsWith('scep_single_');
    const isSinglePremiumPlan = isSSPE || isSinglePremiumSCEP;

    // For SSPE, sumAssured is the premium, and baseRate is the maturity factor
    // For others, baseRate is rate per 1000 SA
    const basePremiumYearly = isSSPE ? sumAssured : (baseRate * sumAssured) / 1000;
    const maturityValue = isSSPE ? Math.ceil(sumAssured * baseRate) : sumAssured;
    
    // Calculate individual riders
    let adbYearly = 0;
    let ciClassicYearly = 0;
    let ciStandardYearly = 0;
    
    if (hasAccidentalProtection) {
      adbYearly = (ACCIDENTAL_RATE * sumAssured) / 1000;
    }
    
    // CI Eligibility - Coverage is 50% of Sum Assured, max 30 Lakh (3,000,000)
    // Shared rider rules live in data/ciDiseases so pricing, the app and the report agree.
    const isCIEligible = isCiRiderEligible(sumAssured);
    const ciCoverage = ciCoverageAmount(sumAssured);
    if (hasCIClassic && isCIEligible) {
      ciClassicYearly = (getCIRate(age, term, gender, 'Classic') * ciCoverage) / 1000;
    }
    if (hasCIStandard && isCIEligible) {
      ciStandardYearly = (getCIRate(age, term, gender, 'Standard') * ciCoverage) / 1000;
    }

    const riderPremiumYearly = adbYearly + ciClassicYearly + ciStandardYearly;
    const finalTotalPremiumYearly = basePremiumYearly + riderPremiumYearly;

    const basePremium: any = {};
    const riderPremium: any = {};
    const totalPremium: any = {};
    const adbPremium: any = {};
    const ciClassicPremium: any = {};
    const ciStandardPremium: any = {};

    (Object.keys(MODAL_FACTORS) as PlanFrequency[]).forEach(freq => {
      if (isSinglePremiumPlan) {
        const bp = freq === 'Single' ? Math.ceil(basePremiumYearly) : 0;
        const adb = freq === 'Single' ? Math.ceil(adbYearly) : 0;
        const cic = freq === 'Single' ? Math.ceil(ciClassicYearly) : 0;
        const cis = freq === 'Single' ? Math.ceil(ciStandardYearly) : 0;

        basePremium[freq] = bp;
        adbPremium[freq] = adb;
        ciClassicPremium[freq] = cic;
        ciStandardPremium[freq] = cis;
        riderPremium[freq] = adb + cic + cis;
        totalPremium[freq] = bp + riderPremium[freq];
      } else {
        if (freq === 'Single') {
          basePremium[freq] = 0;
          riderPremium[freq] = 0;
          totalPremium[freq] = 0;
          adbPremium[freq] = 0;
          ciClassicPremium[freq] = 0;
          ciStandardPremium[freq] = 0;
        } else {
          const bp = Math.ceil(basePremiumYearly * MODAL_FACTORS[freq]);
          const adb = Math.ceil(adbYearly * MODAL_FACTORS[freq]);
          const cic = Math.ceil(ciClassicYearly * MODAL_FACTORS[freq]);
          const cis = Math.ceil(ciStandardYearly * MODAL_FACTORS[freq]);
          
          basePremium[freq] = bp;
          adbPremium[freq] = adb;
          ciClassicPremium[freq] = cic;
          ciStandardPremium[freq] = cis;
          riderPremium[freq] = adb + cic + cis;
          totalPremium[freq] = bp + riderPremium[freq];
        }
      }
    });

    return {
      productId: product.id,
      productName: product.name,
      pricePer1000: baseRate,
      basePremium,
      riderPremium,
      totalPremium,
      adbPremium,
      ciClassicPremium,
      ciStandardPremium,
      isApplicable: true,
      hasCIBenefit: isCIEligible && (hasCIClassic || hasCIStandard),
      maturityValue, // Include maturity value for reference
      isSinglePremiumEndowment: isSSPE
    };
  });

  return standardResults;
}


export function calculateSDPPResult(input: CalculationInput) {
  const plans: {id: string; name: string; plan: string}[] = [
    { id: 'sdpp_signature', name: "Shanta Depositor's Protection Plan - Signature", plan: 'Signature' },
    { id: 'sdpp_elite', name: "Shanta Depositor's Protection Plan - Elite", plan: 'Elite' },
    { id: 'sdpp_prime', name: "Shanta Depositor's Protection Plan - Prime", plan: 'Prime' },
  ];

  return plans.map(p => {
    const res = runSDPPCalculations({
      ...input,
      sdppPlan: p.plan as any,
      targetPremium: input.targetPremium ?? 0
    });

    // Calculate rider total for modes
    const riderMonthlyTotal = res.ciMonthlyPremium + res.hiMonthlyPremium;

    return {
      productId: p.id,
      productName: p.name,
      isApplicable: res.errors.length === 0,
      message: res.errors[0],
      totalPremium: {
        Monthly: (res.annualPremium / 12) + riderMonthlyTotal,
        Quarterly: (res.annualPremium / 4) + (riderMonthlyTotal * 3),
        'Half-yearly': (res.annualPremium / 2) + (riderMonthlyTotal * 6),
        Yearly: res.annualPremium + (riderMonthlyTotal * 12)
      },
      sumAssured: typeof res.sumAssured === 'number' ? res.sumAssured : (res.annualPremium * (input.term || 10)),
      maturityValue: res.customMaturity || res.maturity7 || 0,
      sdppData: res
    };
  });
}
