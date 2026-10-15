import type { CalculationInput, CalculationResult, PlanFrequency, SDPPPlan } from '../src/data/types';
import { calculatePremiums, calculateProjection, calculateSDPPResult } from '../src/services/calculator';
import { runSDPPCalculations } from '../src/services/sdpCalculator';
import type { QuotationOptions } from '../src/lib/quotationModel';

export function quotationFixture(productId = 'sdpp_elite', mode: PlanFrequency = 'Monthly', term = 12): QuotationOptions {
  const input: CalculationInput = {
    name: 'Mahadi Hasan', phone: '01920000704', email: 'mahadi@example.com',
    dob: '1979-12-24', issueDate: '2026-10-15', age: 47, gender: 'Female', term,
    paymentMethod: mode, sumAssured: 1440000, targetPremium: 10000 * ({ Monthly: 1, Quarterly: 3, 'Half-yearly': 6, Yearly: 12, Single: 1 }[mode]),
    inputMode: 'Premium', sdppPlan: 'Elite', dailyHospitalCoverage: 10000,
    hasAccidentalProtection: false, hasCIClassic: false, hasCIStandard: false, projectionMonth: 61,
  };
  if (productId.startsWith('sdpp_')) {
    input.sdppPlan = (productId.slice(5)[0].toUpperCase() + productId.slice(6)) as SDPPPlan;
    if (term > 12) { input.age = 30; input.dob = '1996-10-15'; }
    const result = calculateSDPPResult(input).find(result => result.productId === productId)!;
    return { input, selectedProduct: result as unknown as CalculationResult, sdppData: result.sdppData };
  }
  input.inputMode = 'SumAssured';
  const result = calculatePremiums(input).find(result => result.productId === productId)!;
  return { input, selectedProduct: result, projectionData: calculateProjection(input, productId) };
}
export function comboFixture(): QuotationOptions {
  const primary = quotationFixture('endowment');
  const comboInput = { ...primary.input, sdppPlan: 'Prime' as SDPPPlan, targetPremium: 30000, paymentMethod: 'Quarterly' as PlanFrequency, customInterestRate: 10 };
  return { ...primary, isComboEnabled: true, comboSdppPlan: 'Prime', comboSdppPaymentMethod: 'Quarterly', comboSdppDeposit: 30000, comboSdppCustomRate: 10, sdppComboData: runSDPPCalculations(comboInput) };
}

export function ciQuotationFixture(type: 'classic' | 'standard' | 'none' = 'none'): QuotationOptions {
  const options = quotationFixture('endowment');
  options.input.hasCIClassic = type === 'classic';
  options.input.hasCIStandard = type === 'standard';
  options.selectedProduct = calculatePremiums(options.input).find(result => result.productId === 'endowment')!;
  return options;
}
