import { readFileSync } from 'node:fs';
import { type Download, expect, test } from '@playwright/test';
import JSZip from 'jszip';
import { addAt, newProject } from './helpers';

const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PLATFORMS = ['adform', 'cm360', 'dv360', 'ttd'] as const;

test('a banner built from scratch exports correctly for all four platforms', async ({ page }) => {
  test.setTimeout(120_000);

  // ── Build the banner ──
  await newProject(page);
  await addAt(page, 'Add text', 20, 20);
  await addAt(page, 'Add CTA button', 40, 370);
  await page.locator('.toolbar input[type="file"]').setInputFiles({
    name: 'dot.png', mimeType: 'image/png', buffer: Buffer.from(PNG_1PX, 'base64'),
  });
  await expect(page.locator('.hitbox[data-name="dot"]')).toHaveCount(1);
  await page.getByRole('button', { name: '+ Add', exact: true }).click();
  await page.getByLabel(/300×250/).check();
  await page.getByRole('button', { name: 'Add 1 size' }).click();
  await expect(page.locator('.size-btn')).toHaveCount(2);

  const downloads: Download[] = [];
  page.on('download', (d) => { downloads.push(d); });

  for (const id of PLATFORMS) {
    downloads.length = 0;

    // ── Export ──
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.getByLabel('Platform', { exact: true }).selectOption(id);
    await page.getByLabel('Include backup images').uncheck();
    await expect(page.locator('.check-status')).toHaveText('Ready to export');
    await page.getByRole('button', { name: 'Download zips' }).click();
    await expect.poll(() => downloads.length).toBe(2);

    const names = downloads.map((d) => d.suggestedFilename()).sort();
    expect(names).toEqual([`Untitled-banner_${id}_300x250.zip`, `Untitled-banner_${id}_480x480.zip`]);

    // ── Unzip and verify ──
    for (const d of downloads) {
      const m = /_(\d+)x(\d+)\.zip$/.exec(d.suggestedFilename());
      expect(m).not.toBeNull();
      const [w, h] = [m![1], m![2]];
      const zip = await JSZip.loadAsync(readFileSync((await d.path())!));
      const files = Object.values(zip.files).filter((f) => !f.dir).map((f) => f.name).sort();

      expect(files.filter((f) => f.endsWith('index.html'))).toEqual(['index.html']);
      expect(files).toContain('images/dot.png');
      const html = await zip.file('index.html')!.async('string');
      expect(html).toContain('src="images/dot.png"');
      expect(html).toContain('bannr.exit = function()');
      expect(html.split('window.open').length - 1).toBe(1);

      if (id === 'adform') {
        expect(files).toContain('manifest.json');
        const manifest = JSON.parse(await zip.file('manifest.json')!.async('string')) as Record<string, unknown>;
        expect(manifest).toMatchObject({ width: w, height: h, source: 'index.html', clicktags: { clickTAG: '' } });
        expect(html).toContain('Adform.DHTML.js');
        expect(html).toContain("dhtml.getVar('clickTAG'");
        expect(html).not.toContain('ad.size');
      } else {
        expect(files).not.toContain('manifest.json');
        expect(html).toContain(`<meta name="ad.size" content="width=${w},height=${h}">`);
        if (id === 'ttd') expect(html).toContain('function getClickTag()');
        else expect(html).toContain('var clickTag = "";');
      }
    }

    await page.getByRole('button', { name: 'Close', exact: true }).click();
  }
});
