import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CI_COVERAGE_CAP, CI_COVERAGE_SHARE_OF_SUM_ASSURED, CI_MAJOR_BENEFIT_SHARE_AFTER_MINOR,
  CI_MINOR_BENEFIT_SHARE, CI_MINIMUM_SUM_ASSURED, CLASSIC_CI_DISEASES, MAJOR_CI_DISEASES,
  MINOR_CI_DISEASES, ciCoverageAmount, ciDiseaseLabel, isCiRiderEligible,
} from '../src/data/ciDiseases';

// Condition wording frozen from the pre-redesign calculator dialog (PR #1). The app,
// the quotation model and the report all read these shared lists, so a rename here
// would change every surface at once.
const LOCKED_CLASSIC = [
  "Cancer (ক্যান্সার)",
  "Heart Attack (হার্ট অ্যাটাক)",
  "Stroke (স্ট্রোক)",
  "Coronary Artery Bypass Surgery (করোনারি-আর্টারি বাইপাস সার্জারি)",
  "Kidney Failure (কিডনি ফেইলিউর)",
  "Major Organ Transplantation (প্রধান অঙ্গ প্রতিস্থাপন)",
  "Paralysis (প্যারালাইসিস)",
  "Blindness (অন্ধত্ব)",
  "Multiple Sclerosis (মাল্টিপল স্কলেরোসিস)",
  "Heart Valve Replacement (হার্ট ভালভ প্রতিস্থাপন)",
  "Surgery of the Aorta (অ্যাওটিক আর্টারির সার্জারি)",
  "Benign Brain Tumour (বেনাইন ব্রেইন টিউমার)",
  "Pulmonary Hypertension (পালমোনারি হাইপারটেনশন)",
  "Alzheimer's Disease (আলঝেইমার রোগ)",
  "Third-Degree Burns (তৃতীয় মাত্রার দগ্ধ)",
  "Coma (কোমা)",
  "End-Stage Lung Disease (শেষ পর্যায়ের ফুসফুসের রোগ)",
  "End-Stage Liver Disease (শেষ পর্যায়ের যকৃতের রোগ)",
  "Fulminant Viral Hepatitis (ফালমিনেন্ট ভাইরাল হেপাটাইটিস)",
];
const LOCKED_MINOR = [
  "Cerebral Shunt Insertion (সেরিব্রাল শান্ট ইনসার্শন)",
  "Carcinoma in Situ (কার্সিনোমা ইন সিটু)",
  "Coronary Angioplasty and Other Invasive Coronary Artery Treatments (হৃৎপিন্ডের ধমনিতে অ্যাঞ্জিওপ্লাস্টি ও ধমনীর অনান্য চিকিৎসা)",
  "Small Intestine Transplantation (ক্ষুদ্রান্ত্র প্রতিস্থাপন)",
  "Cardiac Pacemaker or Defibrillator Insertion (কার্ডিয়াক পেসমেকার বা ডিফিব্রিলেটর ইনসারশন)",
  "Surgical Reconstruction of the Face Following an Accident (দুর্ঘটনায় ক্ষতিগ্রস্ত মুখমণ্ডলে অস্ত্রোপচারের মাধ্যমে পুনর্গঠন)",
  "Early-Stage Parkinson's Disease (প্রাথমিক পর্যায়ে পারকিনসন্স রোগ)",
  "Early-Stage Alzheimer's Disease (প্রাথমিক পর্যায়ে আলঝেইমার রোগ)",
  "Multiple Sclerosis (মাল্টিপল স্কলেরোসিস)",
  "Heart Valve Replacement (হার্ট ভালভ প্রতিস্থাপন)",
];
const LOCKED_MAJOR = [
  "Kidney Failure (কিডনি ফেইলর)",
  "Cancer (ক্যান্সার)",
  "Stroke (স্ট্রোক)",
  "Major Organ Transplantation (মেজর অর্গান ট্রান্সপ্লান্ট)",
  "Myocardial Infarction (মায়োকার্ডিয়াল ইনফার্কশন)",
  "Multiple Sclerosis (একাধিক স্ক্লেরোসিস)",
  "Coronary Artery Bypass Surgery (করোনারি আর্টারি বাই-পাস সার্জারি)",
  "Paralysis (প্যারালাইসিস)",
  "Blindness (অন্ধত্ব)",
  "Heart Valve Replacement (হার্ট ভালভ প্রতিস্থাপন)",
  "Third-Degree Burns (তৃতীয় ডিগ্রি বার্নস)",
  "Surgery of the Aorta (মহাধমনীর অস্ত্রোপচার)",
  "End-Stage Lung Disease (শেষ পর্যায়ে ফুসফুসের রোগ)",
  "End-Stage Liver Disease (শেষ পর্যায়ে লিভার ডিজিজ)",
  "Fulminant Viral Hepatitis (ফুলমিন্যান্ট ভাইরাল হেপাটাইটিস)",
];

test('shared lists keep the exact approved condition wording and counts', () => {
  assert.equal(CLASSIC_CI_DISEASES.length, 19);
  assert.equal(MINOR_CI_DISEASES.length, 10);
  assert.equal(MAJOR_CI_DISEASES.length, 15);
  assert.deepEqual(CLASSIC_CI_DISEASES.map(ciDiseaseLabel), LOCKED_CLASSIC);
  assert.deepEqual(MINOR_CI_DISEASES.map(ciDiseaseLabel), LOCKED_MINOR);
  assert.deepEqual(MAJOR_CI_DISEASES.map(ciDiseaseLabel), LOCKED_MAJOR);
});

test('Latin names stay selectable-report safe while Bengali names carry the script', () => {
  for (const disease of [...CLASSIC_CI_DISEASES, ...MINOR_CI_DISEASES, ...MAJOR_CI_DISEASES]) {
    assert.match(disease.english, /^[\x20-\x7e]+$/, disease.english);
    assert.match(disease.bengali, /[^\x20-\x7e]/, disease.bengali);
  }
  const labels = CLASSIC_CI_DISEASES.map(disease => disease.english);
  assert.equal(new Set(labels).size, labels.length);
});

test('coverage and eligibility helpers mirror the pricing rules', () => {
  assert.equal(CI_COVERAGE_SHARE_OF_SUM_ASSURED, 0.5);
  assert.equal(CI_COVERAGE_CAP, 3000000);
  assert.equal(CI_MINIMUM_SUM_ASSURED, 200000);
  assert.equal(ciCoverageAmount(1440000), 720000);
  assert.equal(ciCoverageAmount(8000000), 3000000);
  assert.equal(isCiRiderEligible(199999), false);
  assert.equal(isCiRiderEligible(200000), true);
  assert.equal(Math.round(CI_MINOR_BENEFIT_SHARE * 100), 30);
  assert.equal(Math.round(CI_MAJOR_BENEFIT_SHARE_AFTER_MINOR * 100), 70);
});
