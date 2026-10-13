export type PlanFrequency = 'Monthly' | 'Quarterly' | 'Half-yearly' | 'Yearly' | 'Single';
export type Gender = 'Male' | 'Female';
export type SDPPPlan = 'Signature' | 'Elite' | 'Prime';

export interface RateTable {
  [age: number]: {
    [term: number]: number;
  };
}

export interface ProductDefinition {
  id: string;
  name: string;
  rates: RateTable;
  minAge: number;
  maxAge: number;
  minTerm: number;
  maxTerm: number;
  terms: number[];
}

export interface CalculationInput {
  dob: string;
  age: number;
  childDob?: string;
  childAge?: number;
  term: number;
  sumAssured: number;
  gender: Gender;
  paymentMethod: PlanFrequency;
  hasAccidentalProtection: boolean;
  hasCIClassic: boolean;
  hasCIStandard: boolean;
  income?: number;
  targetPremium?: number;
  inputMode: 'SumAssured' | 'Premium';
  name?: string;
  email?: string;
  phone?: string;
  // SDPP Specific
  sdppPlan?: SDPPPlan;
  monthlyPremium?: number;
  dailyHospitalCoverage?: number;
  ciCoverage?: number;
  projectionMonth?: number;
  purchaseDate?: string;
  issueDate?: string;
  customInterestRate?: number;
}

export interface CalculationResult {
  productId: string;
  productName: string;
  pricePer1000: number;
  basePremium: {
    [key in PlanFrequency]: number;
  };
  riderPremium: {
    [key in PlanFrequency]: number;
  };
  totalPremium: {
    [key in PlanFrequency]: number;
  };
  adbPremium?: { [key in PlanFrequency]: number };
  ciClassicPremium?: { [key in PlanFrequency]: number };
  ciStandardPremium?: { [key in PlanFrequency]: number };
  isApplicable: boolean;
  message?: string;
  maturityValue?: number;
}

export interface SDPPResult {
  age: number;
  annualPremium: number;
  sumAssured: string | number;
  totalPremiumPaid: number;
  totalBasicPremiumPaid: number;
  totalRiderPremiumPaid: number;
  deathBenefit: string | number;
  accidentalBenefit: number;
  ciCoverage: number;
  ciMonthlyPremium: number;
  hiMonthlyPremium: number;
  ciModePremium: number;
  hiModePremium: number;
  hospitalCoverage: number;
  totalModePremium: number;
  maturity7: number;
  maturity9: number;
  customMaturity?: number;
  taxRebate: number;
  surrenderValue7: number;
  surrenderValue9: number;
  errors: string[];
  projection: any[];
  totalPremiumPaidAtSurrender: number;
  totalBasicPremiumPaidAtSurrender: number;
  totalRiderPremiumPaidAtSurrender: number;
  surrenderChargePercent: number;
  stopPaymentMaturity7: number;
  stopPaymentMaturity9: number;
  totalPaidAtStop: number;
}

export interface ProjectionRow {
  year: number;
  premium: number;
  deathBenefit: number;
  surrenderValue: number;
  maturityValue: number;
  paidUpValue: number;
  etiCoverage: number;
  etiSurplus: number;
  etiDurationStr: string;
}
