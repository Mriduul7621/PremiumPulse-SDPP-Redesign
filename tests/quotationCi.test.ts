import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuotationModel } from '../src/lib/quotationModel';
import { CLASSIC_CI_DISEASES, MAJOR_CI_DISEASES, MINOR_CI_DISEASES } from '../src/data/ciDiseases';
import { quotationFixture, comboFixture } from './fixtures';

test('no critical illness rider: the report carries no disease appendix', () => {
  assert.equal(buildQuotationModel(quotationFixture('endowment')).ciSchedule, undefined);
  assert.equal(buildQuotationModel(quotationFixture('sdpp_elite')).ciSchedule, undefined);
});

test('CI Classic: appendix lists exactly the 19 shared covered diseases with the rider coverage', () => {
  const schedule = buildQuotationModel({ ...quotationFixture('endowment'), input: { ...quotationFixture('endowment').input, hasCIClassic: true } }).ciSchedule!;
  assert.equal(schedule.rider, 'classic');
  assert.equal(schedule.riderName, 'Critical Illness Classic');
  assert.equal(schedule.groups.length, 1);
  assert.deepEqual(schedule.groups[0].entries.map(entry => entry.english), CLASSIC_CI_DISEASES.map(disease => disease.english));
  assert.deepEqual(schedule.groups[0].entries.map(entry => entry.bengali), CLASSIC_CI_DISEASES.map(disease => disease.bengali));
  assert.deepEqual(schedule.groups[0].entries.map(entry => entry.index), CLASSIC_CI_DISEASES.map((_, index) => index + 1));
  assert.equal(schedule.coverage, 720000);
  assert.match(schedule.groups[0].benefit, /CI coverage: BDT 720,000/);
  assert.equal(schedule.coverageNote, undefined);
});

test('CI Standard: one appendix with separate minor and major sections and the benefit split', () => {
  const options = quotationFixture('endowment');
  const schedule = buildQuotationModel({ ...options, input: { ...options.input, hasCIStandard: true } }).ciSchedule!;
  assert.equal(schedule.rider, 'standard');
  assert.equal(schedule.groups.length, 2);
  assert.equal(schedule.groups[0].entries.length, MINOR_CI_DISEASES.length);
  assert.equal(schedule.groups[1].entries.length, MAJOR_CI_DISEASES.length);
  assert.match(schedule.groups[0].heading, /Minor critical illness \(10\)/);
  assert.match(schedule.groups[1].heading, /Major critical illness \(15\)/);
  assert.match(schedule.groups[0].benefit, /30% of CI coverage: BDT 216,000/);
  assert.match(schedule.groups[1].benefit, /If minor claimed: 70% - BDT 504,000\. If minor not claimed: 100% - BDT 720,000\./);
  assert.deepEqual(schedule.groups.flatMap(group => group.entries.map(entry => entry.english)),
    [...MINOR_CI_DISEASES, ...MAJOR_CI_DISEASES].map(disease => disease.english));
});

test('classic selection lists only the classic conditions', () => {
  const options = quotationFixture('endowment');
  const schedule = buildQuotationModel({ ...options, input: { ...options.input, hasCIClassic: true } }).ciSchedule!;
  assert.equal(schedule.rider, 'classic');
  assert.equal(schedule.groups.length, 1);
});

test('below the rider minimum sum assured the appendix states that no cover applies', () => {
  const options = quotationFixture('endowment');
  const schedule = buildQuotationModel({ ...options, input: { ...options.input, hasCIClassic: true, sumAssured: 150000 } }).ciSchedule!;
  assert.equal(schedule.coverage, undefined);
  assert.match(schedule.coverageNote!, /BDT 200,000/);
  assert.match(schedule.groups[0].benefit, /No coverage amount applies/);
  assert.equal(schedule.groups[0].entries.length, 19);
});

test('SDPP plans keep their own built-in CI cover and never gain the rider appendix', () => {
  const options = quotationFixture('sdpp_elite');
  const schedule = buildQuotationModel({ ...options, input: { ...options.input, hasCIClassic: true } }).ciSchedule;
  assert.equal(schedule, undefined);
});

test('combination quotations still append the primary rider disease list once', () => {
  const options = comboFixture();
  const model = buildQuotationModel({ ...options, input: { ...options.input, hasCIStandard: true } });
  assert.equal(model.policies.length, 2);
  assert.equal(model.ciSchedule!.rider, 'standard');
  assert.match(model.notes.join(' '), /Critical Illness Standard rider are listed in the appendix/);
});

test('appendix note keeps the disclaimer that these are not policy definitions', () => {
  const options = quotationFixture('endowment');
  const schedule = buildQuotationModel({ ...options, input: { ...options.input, hasCIStandard: true } }).ciSchedule!;
  assert.match(schedule.note, /not policy definitions/);
  assert.match(schedule.note, /Shanta Life claim approval/);
});
