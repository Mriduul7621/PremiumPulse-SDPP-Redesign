/**
 * Critical illness rider cover lists.
 *
 * Single shared source for the on-screen disease dialog, the quotation preview
 * and the downloaded quotation report, so the app and the PDF can never drift.
 * Condition names and the coverage / benefit split below are the existing
 * PremiumPulse rider wording - nothing is re-derived or estimated here.
 */

export type CiRiderType = 'classic' | 'standard';

export interface CiDisease {
  /** Latin-script condition name; selectable text in the report. */
  english: string;
  /** Bengali condition name; shaped by the browser and rasterized in the report. */
  bengali: string;
}

/** Coverage is 50% of the sum assured, capped at BDT 3,000,000 (rider pricing rule). */
export const CI_COVERAGE_SHARE_OF_SUM_ASSURED = 0.5;
export const CI_COVERAGE_CAP = 3_000_000;
/** Standard rider benefit split: 30% for a minor claim, 70% for a later major claim. */
export const CI_MINOR_BENEFIT_SHARE = 0.3;
export const CI_MAJOR_BENEFIT_SHARE_AFTER_MINOR = 0.7;
export const CI_MAJOR_BENEFIT_SHARE_WITHOUT_MINOR = 1;

export const ciCoverageAmount = (sumAssured: number): number =>
  Math.min(sumAssured * CI_COVERAGE_SHARE_OF_SUM_ASSURED, CI_COVERAGE_CAP);

/** Minimum sum assured used by the rider pricing rules; below it no CI cover applies. */
export const CI_MINIMUM_SUM_ASSURED = 200_000;
export const isCiRiderEligible = (sumAssured: number): boolean => sumAssured >= CI_MINIMUM_SUM_ASSURED;

/** Label shown in the app dialog, identical to the wording used before this module existed. */
export const ciDiseaseLabel = (disease: CiDisease): string => `${disease.english} (${disease.bengali})`;

/** CI Classic: every covered condition pays the full rider coverage. */
export const CLASSIC_CI_DISEASES: CiDisease[] = [
  { english: 'Cancer', bengali: 'ক্যান্সার' },
  { english: 'Heart Attack', bengali: 'হার্ট অ্যাটাক' },
  { english: 'Stroke', bengali: 'স্ট্রোক' },
  { english: 'Coronary Artery Bypass Surgery', bengali: 'করোনারি-আর্টারি বাইপাস সার্জারি' },
  { english: 'Kidney Failure', bengali: 'কিডনি ফেইলিউর' },
  { english: 'Major Organ Transplantation', bengali: 'প্রধান অঙ্গ প্রতিস্থাপন' },
  { english: 'Paralysis', bengali: 'প্যারালাইসিস' },
  { english: 'Blindness', bengali: 'অন্ধত্ব' },
  { english: 'Multiple Sclerosis', bengali: 'মাল্টিপল স্কলেরোসিস' },
  { english: 'Heart Valve Replacement', bengali: 'হার্ট ভালভ প্রতিস্থাপন' },
  { english: 'Surgery of the Aorta', bengali: 'অ্যাওটিক আর্টারির সার্জারি' },
  { english: 'Benign Brain Tumour', bengali: 'বেনাইন ব্রেইন টিউমার' },
  { english: 'Pulmonary Hypertension', bengali: 'পালমোনারি হাইপারটেনশন' },
  { english: "Alzheimer's Disease", bengali: 'আলঝেইমার রোগ' },
  { english: 'Third-Degree Burns', bengali: 'তৃতীয় মাত্রার দগ্ধ' },
  { english: 'Coma', bengali: 'কোমা' },
  { english: 'End-Stage Lung Disease', bengali: 'শেষ পর্যায়ের ফুসফুসের রোগ' },
  { english: 'End-Stage Liver Disease', bengali: 'শেষ পর্যায়ের যকৃতের রোগ' },
  { english: 'Fulminant Viral Hepatitis', bengali: 'ফালমিনেন্ট ভাইরাল হেপাটাইটিস' },
];

/** CI Standard, minor conditions: 30% of the rider coverage. */
export const MINOR_CI_DISEASES: CiDisease[] = [
  { english: 'Cerebral Shunt Insertion', bengali: 'সেরিব্রাল শান্ট ইনসার্শন' },
  { english: 'Carcinoma in Situ', bengali: 'কার্সিনোমা ইন সিটু' },
  { english: 'Coronary Angioplasty and Other Invasive Coronary Artery Treatments', bengali: 'হৃৎপিন্ডের ধমনিতে অ্যাঞ্জিওপ্লাস্টি ও ধমনীর অনান্য চিকিৎসা' },
  { english: 'Small Intestine Transplantation', bengali: 'ক্ষুদ্রান্ত্র প্রতিস্থাপন' },
  { english: 'Cardiac Pacemaker or Defibrillator Insertion', bengali: 'কার্ডিয়াক পেসমেকার বা ডিফিব্রিলেটর ইনসারশন' },
  { english: 'Surgical Reconstruction of the Face Following an Accident', bengali: 'দুর্ঘটনায় ক্ষতিগ্রস্ত মুখমণ্ডলে অস্ত্রোপচারের মাধ্যমে পুনর্গঠন' },
  { english: "Early-Stage Parkinson's Disease", bengali: 'প্রাথমিক পর্যায়ে পারকিনসন্স রোগ' },
  { english: "Early-Stage Alzheimer's Disease", bengali: 'প্রাথমিক পর্যায়ে আলঝেইমার রোগ' },
  { english: 'Multiple Sclerosis', bengali: 'মাল্টিপল স্কলেরোসিস' },
  { english: 'Heart Valve Replacement', bengali: 'হার্ট ভালভ প্রতিস্থাপন' },
];

/** CI Standard, major conditions: 70% after a minor claim, otherwise 100%. */
export const MAJOR_CI_DISEASES: CiDisease[] = [
  { english: 'Kidney Failure', bengali: 'কিডনি ফেইলর' },
  { english: 'Cancer', bengali: 'ক্যান্সার' },
  { english: 'Stroke', bengali: 'স্ট্রোক' },
  { english: 'Major Organ Transplantation', bengali: 'মেজর অর্গান ট্রান্সপ্লান্ট' },
  { english: 'Myocardial Infarction', bengali: 'মায়োকার্ডিয়াল ইনফার্কশন' },
  { english: 'Multiple Sclerosis', bengali: 'একাধিক স্ক্লেরোসিস' },
  { english: 'Coronary Artery Bypass Surgery', bengali: 'করোনারি আর্টারি বাই-পাস সার্জারি' },
  { english: 'Paralysis', bengali: 'প্যারালাইসিস' },
  { english: 'Blindness', bengali: 'অন্ধত্ব' },
  { english: 'Heart Valve Replacement', bengali: 'হার্ট ভালভ প্রতিস্থাপন' },
  { english: 'Third-Degree Burns', bengali: 'তৃতীয় ডিগ্রি বার্নস' },
  { english: 'Surgery of the Aorta', bengali: 'মহাধমনীর অস্ত্রোপচার' },
  { english: 'End-Stage Lung Disease', bengali: 'শেষ পর্যায়ে ফুসফুসের রোগ' },
  { english: 'End-Stage Liver Disease', bengali: 'শেষ পর্যায়ে লিভার ডিজিজ' },
  { english: 'Fulminant Viral Hepatitis', bengali: 'ফুলমিন্যান্ট ভাইরাল হেপাটাইটিস' },
];
