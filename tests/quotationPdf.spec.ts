import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

async function inspectPdf(bytes: Uint8Array) {
  const document = await getDocument({ data: bytes, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    const items = content.items.filter(item => 'str' in item);
    pages.push(items.map(item => item.str).join(' '));
    // Check content stays inside the A4 media box, including continued tables.
    for (const item of items) {
      if (!item.str.trim()) continue;
      expect(item.transform[4], item.str).toBeGreaterThanOrEqual(40);
      expect(item.transform[4] + item.width, item.str).toBeLessThanOrEqual(555);
      expect(item.transform[5], item.str).toBeGreaterThan(15);
      expect(item.transform[5], item.str).toBeLessThan(810);
    }
    expect(pages.at(-1)).toContain(`${number} / ${document.numPages}`);
    expect(pages.at(-1)!.match(/PERSONALIZED ILLUSTRATION/g)).toHaveLength(1);
    expect(pages.at(-1)).toContain('Not a contract');
  }
  await document.destroy();
  return pages;
}

for (const scenario of ['elite', 'prime', 'signature', 'long', 'combo', 'single', 'child', 'staged']) {
  test(`${scenario}: selectable, bounded A4 report with complete data and page numbering`, async ({ page }, testInfo) => {
    await page.goto('/');
    const bytes = await page.evaluate(async scenario => {
      const renderer = '/src/lib/quotationPdf.ts', fixtures = '/tests/fixtures.ts';
      const { createQuotationPdf } = await import(renderer);
      const { quotationFixture, comboFixture } = await import(fixtures);
      const options = scenario === 'combo' ? comboFixture()
        : scenario === 'long' ? quotationFixture('sdpp_elite', 'Monthly', 25)
        : scenario === 'single' ? quotationFixture('sspe', 'Single')
        : scenario === 'child' ? quotationFixture('scep_3')
        : scenario === 'staged' ? quotationFixture('s4pp')
        : quotationFixture(`sdpp_${scenario}`);
      const pdf = await createQuotationPdf(options, new Date('2026-10-15T16:00:00Z'));
      return Array.from(new Uint8Array(pdf.output('arraybuffer')));
    }, scenario);
    const pdf = new Uint8Array(bytes);
    await writeFile(testInfo.outputPath(`${scenario}.pdf`), pdf);
    const pages = await inspectPdf(pdf);
    const content = pages.join(' ');
    expect(content).toContain('Mahadi Hasan');
    expect(content).toContain('Important information & next steps');
    if (['elite', 'prime', 'signature'].includes(scenario)) {
      expect(pages).toHaveLength(2);
      expect(content).toContain('6.5%');
      expect(content).toContain('8.5%');
      expect(content).toContain('8% assumed rate');
    }
    if (scenario === 'elite') {
      expect(content).toContain('BDT 1,587,941');
      expect(content).toContain('BDT 1,926,253');
      expect(content).toContain('BDT 2,180,227');
      expect(content).toContain('BDT 2,113,539');
    }
    if (scenario === 'combo') {
      expect(content).toContain('POLICY 1 OF 2');
      expect(content).toContain('POLICY 2 OF 2');
      expect(content).toContain('10% custom rate');
      expect(content).toContain('Current account value or Paid Basic premium');
    }
  });
}

test('Bengali personal details render with a bundled font while report text stays searchable', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.route('https://**/*', route => route.abort());
  const bytes = await page.evaluate(async () => {
    const renderer = '/src/lib/quotationPdf.ts', fixtures = '/tests/fixtures.ts';
    const { createQuotationPdf } = await import(renderer);
    const { quotationFixture } = await import(fixtures);
    const options = quotationFixture();
    options.input.name = 'মাহাদী হাসান';
    const pdf = await createQuotationPdf(options);
    return Array.from(new Uint8Array(pdf.output('arraybuffer')));
  });
  const pdf = new Uint8Array(bytes);
  await writeFile(testInfo.outputPath('bengali.pdf'), pdf);
  const pages = await inspectPdf(pdf);
  expect(pages.join(' ')).toContain('Protection at a glance');
});

for (const width of [390, 1280]) {
  test(`actual download button works at ${width}px, independent of preview zoom`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/tests/quotation.html');
    await expect(page.getByRole('button', { name: 'Download PDF', exact: true })).toBeVisible();
    await page.locator('[data-page="1"]').evaluate(element => { element.style.zoom = '0.3'; });
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/Quotation_.*\.pdf$/);
    const bytes = new Uint8Array(await readFile((await download.path())!));
    expect(await inspectPdf(bytes)).toHaveLength(2);
    await expect(page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled();
    expect(errors).toEqual([]);
  });
}

test('failed asset load shows an accessible retryable error, then recovers', async ({ page }) => {
  await page.goto('/tests/quotation.html');
  await page.route('**/shanta-life-logo.png', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to save the quotation');
  await expect(page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled();
  await page.unroute('**/shanta-life-logo.png');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
  await download;
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('full customer journey: calculate an endowment plan, download the report and retain editable inputs', async ({ page }) => {
  await page.goto('/');
  await calculateEndowment(page, 'Mahadi Hasan');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
  const download = await downloadPromise;
  const content = (await inspectPdf(new Uint8Array(await readFile((await download.path())!)))).join(' ');
  expect(content).toContain('Shanta Endowment Plan');
  expect(content).toContain('Mahadi Hasan');
  expect(content).toContain('BDT 10,217');
  expect(content).toContain('BDT 1,471,248');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: '1. Personal', exact: true }).click();
  await expect(page.getByPlaceholder('Enter customer name')).toHaveValue('Mahadi Hasan');
});

async function calculateEndowment(page: Page, name: string) {
  await page.getByRole('button', { name: 'Start Valuation' }).click();
  await expect(page.getByRole('navigation', { name: 'Configuration steps' })).toBeVisible();
  await page.getByPlaceholder('Enter customer name').fill(name);
  await page.getByRole('button', { name: '♀ Female' }).click();
  await page.locator('input[type=date]').nth(0).fill('2026-10-15');
  await page.locator('input[type=date]').nth(1).fill('1979-12-24');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: '-- Select Insurance Product --' }).click();
  await page.getByRole('button', { name: 'Shanta Endowment Plan', exact: true }).click();
  await page.getByRole('button', { name: 'Fix Base Coverage (SA)', exact: true }).click();
  await page.getByRole('button', { name: 'Monthly', exact: true }).click();
  await page.locator('select:visible').selectOption('12');
  await page.getByPlaceholder('Enter amount (BDT)').fill('1440000');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'View Calculation Result' }).click();
  await expect(page.getByRole('button', { name: 'Download PDF', exact: true })).toBeVisible();
}

test('production app exports Bengali customer details offline and reloads from the updated app cache', async ({ page, context }) => {
  await page.route('https://**/*', route => route.abort());
  await page.goto('http://localhost:3001');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  expect(await page.evaluate(() => caches.keys())).toContain('premium-pulse-offline-v3');
  await calculateEndowment(page, 'মাহাদী হাসান');
  await context.setOffline(true);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
  const download = await downloadPromise;
  const content = (await inspectPdf(new Uint8Array(await readFile((await download.path())!)))).join(' ');
  expect(content).toContain('Shanta Endowment Plan');
  expect(content).toContain('BDT 10,217');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start Valuation' })).toBeVisible();
});
