import type { CalculationInput, CalculationResult, PlanFrequency, ProjectionRow, SDPPResult } from '../data/types';
import { SDPP_ILLUSTRATION_RATES } from '../services/sdpCalculator';
import {
  CI_MAJOR_BENEFIT_SHARE_AFTER_MINOR, CI_MAJOR_BENEFIT_SHARE_WITHOUT_MINOR, CI_MINOR_BENEFIT_SHARE,
  CI_MINIMUM_SUM_ASSURED, CLASSIC_CI_DISEASES, MAJOR_CI_DISEASES, MINOR_CI_DISEASES,
  ciCoverageAmount, isCiRiderEligible, type CiDisease, type CiRiderType,
} from '../data/ciDiseases';

export interface QuotationOptions {
  input: CalculationInput;
  selectedProduct?: CalculationResult;
  sdppData?: SDPPResult;
  isComboEnabled?: boolean;
  sdppComboData?: SDPPResult;
  comboSdppPlan?: string;
  comboSdppPaymentMethod?: string;
  comboSdppDeposit?: number;
  comboSdppCustomRate?: number;
  projectionData?: ProjectionRow[];
}
export interface QuoteTable {
  title: string;
  columns: string[];
  rows: string[][];
  note?: string;
}
export interface QuoteCriticalIllness {
  type: 'classic' | 'standard';
  coverage: number;
}
export interface QuotePolicy {
  title: string;
  mode: PlanFrequency;
  premium: number;
  totalPaid: number;
  summary: QuoteTable[];
  schedules: QuoteTable[];
  criticalIllness?: QuoteCriticalIllness;
}
export interface CiConditionEntry {
  index: number;
  /** Selectable Latin-script condition name. */
  english: string;
  /** Bengali condition name; rasterized with browser shaping in the report. */
  bengali: string;
}
export interface CiConditionGroup {
  heading: string;
  benefit: string;
  entries: CiConditionEntry[];
}
export interface CiRiderSchedule {
  rider: CiRiderType;
  riderName: string;
  intro: string;
  /** Rider coverage shown beside the disease list; undefined when the cover does not apply. */
  coverage?: number;
  coverageNote?: string;
  groups: CiConditionGroup[];
  note: string;
}
export interface QuotationModel {
  input: CalculationInput;
  policies: QuotePolicy[];
  notes: string[];
  /** Present only when a Critical Illness rider is selected for the quoted policy. */
  ciSchedule?: CiRiderSchedule;
}

export const paymentsPerYear = (mode: PlanFrequency): number => ({ Monthly: 12, Quarterly: 4, 'Half-yearly': 2, Yearly: 1, Single: 1 })[mode];
export function quoteMoney(value: number): string {
  if (!Number.isFinite(value)) throw new Error('A quotation amount is invalid. Please recalculate the plan.');
  return `BDT ${new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 }).format(value)}`;
}
const pairTable = (title: string, rows: string[][], note?: string): QuoteTable => ({ title, columns: ['Benefit / detail', 'Amount / terms'], rows, note });

function sdppPolicy(input: CalculationInput, data: SDPPResult, plan: string, mode: PlanFrequency): QuotePolicy {
  if (data.errors.length) throw new Error(data.errors.join('. '));
  const periods = paymentsPerYear(mode);
  const riderYears = Math.max(0, Math.min(input.term, 15, 60 - input.age));
  const rates = SDPP_ILLUSTRATION_RATES;
  const benefits = [
    ['Natural death benefit', typeof data.deathBenefit === 'number' ? `${quoteMoney(data.deathBenefit)} or account value, subject to policy terms` : data.deathBenefit],
    ['Additional accidental benefit', quoteMoney(data.accidentalBenefit)],
    ['Illustrative annual tax rebate (10% of basic premium)', quoteMoney(data.taxRebate)],
  ];
  if (data.ciCoverage > 0) benefits.push(['Critical illness coverage', quoteMoney(data.ciCoverage)]);
  if (data.hospitalCoverage > 0) benefits.push(['Hospital coverage (25 days / year)', quoteMoney(data.hospitalCoverage)]);
  const premiumRows = [['Basic deposit', quoteMoney(data.annualPremium / periods), quoteMoney(data.totalBasicPremiumPaid)]];
  if (data.ciModePremium > 0) premiumRows.push(['Critical illness', quoteMoney(data.ciModePremium), quoteMoney(data.ciMonthlyPremium * 12 * riderYears)]);
  if (data.hiModePremium > 0) premiumRows.push(['Hospital rider', quoteMoney(data.hiModePremium), quoteMoney(data.hiMonthlyPremium * 12 * riderYears)]);
  premiumRows.push(['Total', quoteMoney(data.totalModePremium), quoteMoney(data.totalPremiumPaid)]);
  const maturityRows = [
    [`At ${rates.lower}% crediting rate`, quoteMoney(data.maturity7)],
    [`At ${rates.higher}% crediting rate`, quoteMoney(data.maturity9)],
  ];
  if (data.customMaturity !== undefined && input.customInterestRate) maturityRows.push([`At ${input.customInterestRate}% custom rate`, quoteMoney(data.customMaturity)]);
  const schedules: QuoteTable[] = [];
  if (data.projection.length) schedules.push({
    title: `Year-by-year account projection | ${rates.projection}% assumed rate`,
    columns: ['Year', 'Cumulative basic\npremiums', 'Annual risk /\nadmin charges', 'Annual interest', 'Account value'],
    rows: data.projection.map(row => [String(row.year), quoteMoney(row.premiumPaid), quoteMoney(row.charges), quoteMoney(row.interest), quoteMoney(row.accountValue)]),
    note: 'Account value is not cash surrender value. Premium allocation charges are separate from the annual risk / administration charges shown. All projected values are non-guaranteed.',
  });
  if ((input.projectionMonth ?? 0) > 0) schedules.push(pairTable(`If payments stop / surrender at month ${input.projectionMonth}`, [
    ['Basic premiums paid to this month', quoteMoney(data.totalBasicPremiumPaidAtSurrender)],
    ['Rider premiums paid to this month', quoteMoney(data.totalRiderPremiumPaidAtSurrender)],
    [`Surrender value at ${rates.lower}% / ${rates.higher}%`, `${quoteMoney(data.surrenderValue7)} / ${quoteMoney(data.surrenderValue9)}`],
    [`Stop-payment maturity at ${rates.lower}% / ${rates.higher}%`, `${quoteMoney(data.stopPaymentMaturity7)} / ${quoteMoney(data.stopPaymentMaturity9)}`],
  ], 'Illustrative only. Stopping premiums may affect coverage; surrender charges and policy conditions apply.'));
  return {
    title: `Shanta Depositor's Protection Plan - ${plan}`, mode,
    premium: data.totalModePremium, totalPaid: data.totalPremiumPaid,
    summary: [
      { title: 'Premium breakdown', columns: ['Component', `${mode} payment`, 'Over policy term'], rows: premiumRows,
        note: `Basic premiums: ${input.term} years. CI / hospital rider premiums, where applicable: ${riderYears} years; rider premiums are not invested. Amounts are rounded to BDT; totals use unrounded values.` },
      pairTable('Protection at a glance', benefits, 'The accidental benefit is additional to the applicable death benefit. Benefits are subject to policy definitions, limits and exclusions.'),
      pairTable('Illustrated maturity | not guaranteed', maturityRows, 'These scenarios are not promised returns. Actual credited rates and maturity proceeds may be higher or lower.'),
    ], schedules,
  };
}

const conditionEntries = (list: CiDisease[]): CiConditionEntry[] =>
  list.map((disease, index) => ({ index: index + 1, english: disease.english, bengali: disease.bengali }));
const percent = (share: number): string => `${Math.round(share * 100)}%`;
const NO_COVERAGE = 'No coverage amount applies at the selected sum assured.';
const CI_LIST_NOTE = 'Condition names follow the rider wording used in the PremiumPulse app; they are not policy definitions. Any claim depends on the issued rider definitions, severity, waiting and survival periods, limits and exclusions, and on Shanta Life claim approval.';

/** Appendix data for the selected Critical Illness rider: the same shared lists the app dialog shows. */
function ciRiderSchedule(input: CalculationInput, rider: CiRiderType): CiRiderSchedule {
  const eligible = isCiRiderEligible(input.sumAssured);
  const coverage = eligible ? (input.ciCoverage || ciCoverageAmount(input.sumAssured)) : undefined;
  const coverageNote = eligible ? undefined
    : `The selected sum assured of ${quoteMoney(input.sumAssured)} is below the ${quoteMoney(CI_MINIMUM_SUM_ASSURED)} minimum for critical illness cover, so this quotation carries no rider coverage amount.`;
  if (rider === 'classic') {
    return {
      rider, riderName: 'Critical Illness Classic',
      intro: `Rider selected in this quotation: ${CLASSIC_CI_DISEASES.length} covered diseases.`,
      coverage, coverageNote,
      groups: [{
        heading: `Covered diseases (${CLASSIC_CI_DISEASES.length})`,
        benefit: coverage === undefined ? NO_COVERAGE : `CI coverage: ${quoteMoney(coverage)}`,
        entries: conditionEntries(CLASSIC_CI_DISEASES),
      }],
      note: CI_LIST_NOTE,
    };
  }
  return {
    rider, riderName: 'Critical Illness Standard',
    intro: `Rider selected in this quotation: ${MINOR_CI_DISEASES.length} minor and ${MAJOR_CI_DISEASES.length} major diseases.`,
    coverage, coverageNote,
    groups: [
      {
        heading: `Minor critical illness (${MINOR_CI_DISEASES.length})`,
        benefit: coverage === undefined ? NO_COVERAGE : `${percent(CI_MINOR_BENEFIT_SHARE)} of CI coverage: ${quoteMoney(coverage * CI_MINOR_BENEFIT_SHARE)}`,
        entries: conditionEntries(MINOR_CI_DISEASES),
      },
      {
        heading: `Major critical illness (${MAJOR_CI_DISEASES.length})`,
        benefit: coverage === undefined ? NO_COVERAGE
          : `If minor claimed: ${percent(CI_MAJOR_BENEFIT_SHARE_AFTER_MINOR)} - ${quoteMoney(coverage * CI_MAJOR_BENEFIT_SHARE_AFTER_MINOR)}. If minor not claimed: ${percent(CI_MAJOR_BENEFIT_SHARE_WITHOUT_MINOR)} - ${quoteMoney(coverage * CI_MAJOR_BENEFIT_SHARE_WITHOUT_MINOR)}.`,
        entries: conditionEntries(MAJOR_CI_DISEASES),
      },
    ],
    note: CI_LIST_NOTE,
  };
}

export function buildQuotationModel(options: QuotationOptions): QuotationModel {
  const { input, selectedProduct: product } = options;
  if (!product || !product.isApplicable) throw new Error('Please calculate an eligible plan before downloading a quotation.');
  if (!Number.isFinite(input.term) || input.term <= 0 || !paymentsPerYear(input.paymentMethod)) throw new Error('Please select a valid term and payment mode.');
  const isSDPP = product.productId === 'sdpp' || product.productId.startsWith('sdpp_');
  const policies: QuotePolicy[] = [];
  if (isSDPP) {
    if (!options.sdppData) throw new Error('SDPP calculation is missing. Please recalculate.');
    policies.push(sdppPolicy(input, options.sdppData, input.sdppPlan || 'Signature', input.paymentMethod));
  } else {
    if (input.hasCIClassic && input.hasCIStandard) throw new Error('Please select only one Critical Illness rider and recalculate.');
    const mode = input.paymentMethod;
    const count = mode === 'Single' ? 1 : paymentsPerYear(mode) * input.term;
    const premiumRows = [['Basic policy', quoteMoney(product.basePremium[mode])]];
    if (input.hasAccidentalProtection) premiumRows.push(['Accidental protection rider', quoteMoney(product.adbPremium?.[mode] ?? 0)]);
    if (input.hasCIClassic) premiumRows.push(['Critical illness - Classic', quoteMoney(product.ciClassicPremium?.[mode] ?? 0)]);
    if (input.hasCIStandard) premiumRows.push(['Critical illness - Standard', quoteMoney(product.ciStandardPremium?.[mode] ?? 0)]);
    premiumRows.push(['Total payable', quoteMoney(product.totalPremium[mode])]);
    const benefits = [['Natural death cover', quoteMoney(input.sumAssured)], ['Illustrative tax rebate (10% estimate)', quoteMoney(product.totalPremium[mode === 'Single' ? 'Single' : 'Yearly'] * 0.1)]];
    if (input.hasAccidentalProtection) benefits.push(
      ['Accidental death cover (total)', quoteMoney(input.sumAssured * 2)],
      ['Accidental permanent total / partial disability', `${quoteMoney(input.sumAssured)} each, subject to limits`],
      ['Accidental medical reimbursement', `Up to ${quoteMoney(input.sumAssured * 0.15)}`],
    );
    if ((input.hasCIClassic || input.hasCIStandard) && input.sumAssured >= 200000) benefits.push(['Critical illness coverage', quoteMoney(input.ciCoverage || Math.min(input.sumAssured * 0.5, 3000000))]);
    if (product.productId.startsWith('scep')) {
      const stipend = Number(product.productId.split('_').pop()) / 100;
      benefits.push(['Monthly education stipend on covered parental death', quoteMoney(input.sumAssured * stipend)], ['Waiver of premium', 'Subject to covered event and policy terms']);
    }
    let maturity = [['At maturity', quoteMoney(product.maturityValue ?? input.sumAssured)]];
    if (product.productId === 's3pp') maturity = [
      [`At year ${Math.round(input.term / 3)} (25%)`, quoteMoney(input.sumAssured * 0.25)],
      [`At year ${Math.round(input.term * 2 / 3)} (25%)`, quoteMoney(input.sumAssured * 0.25)],
      [`At maturity, year ${input.term} (50%)`, quoteMoney(input.sumAssured * 0.5)],
    ];
    if (product.productId === 's4pp') maturity = [1, 2, 3].map(part => [`At year ${Math.round(input.term * part / 4)} (15%)`, quoteMoney(input.sumAssured * 0.15)]).concat([[`At maturity, year ${input.term} (55%)`, quoteMoney(input.sumAssured * 0.55)]]);
    const schedules: QuoteTable[] = [];
    if (options.projectionData?.length) schedules.push({
      title: 'Policy value schedule', columns: ['Year', 'Base premium', 'Natural death', 'Surrender value', 'Paid-up value', 'ETI duration'],
      rows: options.projectionData.map(row => [String(row.year), quoteMoney(row.premium), quoteMoney(row.deathBenefit), quoteMoney(row.surrenderValue), quoteMoney(row.paidUpValue), row.etiDurationStr || '-']),
      note: 'Premium is the base premium for the year, not cumulative contributions. ETI means Extended Term Insurance. Values are indicative and subject to official verification.',
    });
    const summary: QuoteTable[] = [
      { title: 'Premium breakdown', columns: ['Component', `${mode} payment`], rows: premiumRows, note: 'Amounts are rounded to BDT; totals use unrounded values.' },
      pairTable('Protection at a glance', benefits),
      pairTable('Survival / maturity benefits', maturity, 'Subject to survival, policy status and official policy terms. Staged payouts are not additional to the full sum assured.'),
    ];
    if (mode !== 'Single') schedules.push({ title: 'Other payment frequencies', columns: ['Payment mode', 'Total premium per payment'], rows: (['Monthly', 'Quarterly', 'Half-yearly', 'Yearly'] as const).map(frequency => [frequency === mode ? `${frequency} (selected)` : frequency, quoteMoney(product.totalPremium[frequency])]), note: 'Each mode has its own pricing; annual payment is not necessarily the selected modal premium multiplied by payments per year.' });
    const ciType = input.hasCIClassic ? 'classic' : input.hasCIStandard ? 'standard' : undefined;
    const ciPremium = ciType === 'classic' ? product.ciClassicPremium?.[mode] : ciType === 'standard' ? product.ciStandardPremium?.[mode] : 0;
    const criticalIllness: QuoteCriticalIllness | undefined = ciType && input.sumAssured >= 200000 && (ciPremium ?? 0) > 0
      ? { type: ciType, coverage: input.ciCoverage || Math.min(input.sumAssured * 0.5, 3000000) }
      : undefined;
    policies.push({ criticalIllness, title: product.productName, mode, premium: product.totalPremium[mode], totalPaid: product.totalPremium[mode] * count, summary, schedules });
  }
  if (options.isComboEnabled && !isSDPP) {
    if (!options.sdppComboData) throw new Error('The combination calculation is missing. Please recalculate.');
    const mode = (options.comboSdppPaymentMethod || 'Monthly') as PlanFrequency;
    if (!['Monthly', 'Quarterly', 'Half-yearly', 'Yearly'].includes(mode)) throw new Error('Invalid combination payment mode.');
    // Use the already-calculated combination result, including rider costs and rider expiry.
    policies.push(sdppPolicy({ ...input, customInterestRate: options.comboSdppCustomRate }, options.sdppComboData, options.comboSdppPlan || 'Elite', mode));
  }
  const model: QuotationModel = { input, policies, notes: [
    'Unofficial sample illustration - not a contract, policy document or offer of insurance. Prepared by PremiumPulse for explanation and discussion only.',
    'Premiums and benefits are indicative calculations. Final premiums, eligibility, coverage, exclusions, waiting periods and rider expiry are determined by Shanta Life underwriting and the issued policy. Verify all figures with the insurer before purchase.',
    'Investment-based projections are non-guaranteed. Actual credited rates, charges and proceeds may differ. Early surrender or stopping premiums may reduce benefits and return less than premiums paid.',
    'Any tax rebate depends on income, qualifying investment limits and applicable Bangladesh / NBR rules. No tax saving is guaranteed by this quotation.',
    ...(policies.length > 1 ? ['This illustration contains two separate policies. Payment modes and rider durations may differ. The amounts shown for each policy are separate obligations; benefits are subject to each policy independently.'] : []),
    'Next step: review the benefits and exclusions with an authorized adviser and request an official insurer quotation before making a decision.',
  ] };
  // The appendix lists only the rider the customer actually selected, on its own final page.
  const ciRider: CiRiderType | undefined = !isSDPP && (input.hasCIClassic || input.hasCIStandard)
    ? (input.hasCIClassic ? 'classic' : 'standard') : undefined;
  if (ciRider) {
    model.ciSchedule = ciRiderSchedule(input, ciRider);
    model.notes.splice(model.notes.length - 1, 0, `The conditions covered by your selected ${model.ciSchedule.riderName} rider are listed in the appendix at the end of this report.`);
  }
  return model;
}
