import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuotationModel, quoteMoney } from '../src/lib/quotationModel';
import { quotationFixture, comboFixture } from './fixtures';
import { quotationFilename } from '../src/lib/quotationPdf';

for (const plan of ['elite', 'signature', 'prime']) {
  for (const mode of ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly'] as const) {
    test(`SDPP ${plan} / ${mode}: uses computed premiums, benefits, scenarios and projection`, () => {
      const options = quotationFixture(`sdpp_${plan}`, mode);
      const policy = buildQuotationModel(options).policies[0];
      assert.equal(policy.premium, options.sdppData!.totalModePremium);
      assert.equal(policy.totalPaid, options.sdppData!.totalPremiumPaid);
      const content = JSON.stringify(policy);
      assert.match(content, /At 6\.5% crediting rate/);
      assert.match(content, /At 8\.5% crediting rate/);
      assert.match(content, /8% assumed rate/);
      assert.equal(policy.schedules[0].rows.length, options.input.term);
      if (plan !== 'elite') assert.doesNotMatch(content, /Critical illness coverage|Hospital coverage/);
      if (plan === 'prime') assert.match(content, /Current account value or Paid Basic premium/);
    });
  }
}

test('25-year term counts rider payments only through the applicable rider term', () => {
  const options = quotationFixture('sdpp_elite', 'Monthly', 25);
  const policy = buildQuotationModel(options).policies[0];
  assert.equal(policy.totalPaid, options.sdppData!.totalBasicPremiumPaid + options.sdppData!.totalRiderPremiumPaid);
  assert.equal(policy.summary[0].rows[1][2], quoteMoney(options.sdppData!.ciMonthlyPremium * 12 * 15));
  assert.match(policy.summary[0].note!, /15 years/);
});

test('combination preserves separate payment modes and Prime formula, without inventing a numeric guarantee', () => {
  const options = comboFixture();
  const model = buildQuotationModel(options);
  assert.equal(model.policies.length, 2);
  assert.equal(model.policies[0].mode, 'Monthly');
  assert.equal(model.policies[1].mode, 'Quarterly');
  assert.equal(model.policies[1].totalPaid, options.sdppComboData!.totalPremiumPaid);
  assert.match(JSON.stringify(model.policies[1]), /At 10% custom rate/);
  assert.match(model.notes.join(' '), /two separate policies/);
});

for (const product of ['sspe', 'scep_single_1']) {
  test(`${product}: single premium is paid once, never multiplied by the term`, () => {
    const options = quotationFixture(product, 'Single');
    const policy = buildQuotationModel(options).policies[0];
    assert.equal(policy.premium, options.selectedProduct!.totalPremium.Single);
    assert.equal(policy.totalPaid, policy.premium);
    assert.doesNotMatch(JSON.stringify(policy), /Other payment frequencies/);
  });
}
for (const product of ['s3pp', 's4pp']) {
  test(`${product}: staged payouts reconcile to the sum assured`, () => {
    const options = quotationFixture(product);
    const policy = buildQuotationModel(options).policies[0];
    assert.equal(policy.summary[2].rows.length, product === 's3pp' ? 3 : 4);
    const total = policy.summary[2].rows.reduce((sum, row) => sum + Number(row[1].replace(/[^0-9]/g, '')), 0);
    assert.equal(total, options.input.sumAssured);
  });
}
for (const stipend of [1, 2, 3]) {
  test(`child plan ${stipend}%: uses the selected stipend percentage`, () => {
    const options = quotationFixture(`scep_${stipend}`);
    const policy = buildQuotationModel(options).policies[0];
    assert.equal(policy.summary[1].rows.find(row => row[0].startsWith('Monthly education'))![1], quoteMoney(options.input.sumAssured * stipend / 100));
  });
}

test('missing / ineligible / invalid calculation fails instead of exporting a misleading quote', () => {
  const options = quotationFixture();
  assert.throws(() => buildQuotationModel({ ...options, selectedProduct: undefined }), /eligible plan/);
  assert.throws(() => buildQuotationModel({ ...options, sdppData: undefined }), /missing/);
  assert.throws(() => buildQuotationModel({ ...options, input: { ...options.input, term: 0 } }), /valid term/);
  assert.throws(() => quoteMoney(NaN), /invalid/);
});

test('filenames include plan and precise time, use safe characters', () => {
  const options = comboFixture();
  const filename = quotationFilename(options, new Date('2026-10-15T13:24:12Z'));
  assert.match(filename, /Combo_Quotation_20261015T132412\.pdf$/);
  assert.doesNotMatch(filename, /[\\/:*?"<>|]/);
});
