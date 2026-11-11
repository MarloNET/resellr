import { describe, expect, it } from 'vitest';

import { launcherPagesDir, launcherPageUrl } from './launcher-pages-location.ts';

const REF_NO = 'R-7K3M-Q9TX';

describe('address of the launcher pages (CU-310)', () => {
  it('puts the pages into launcher-pages in the program folder', () => {
    expect(launcherPagesDir('/opt/resellr')).toBe('/opt/resellr/launcher-pages');
  });

  it('gives lp-02.html as file URL with the reference number as parameter ref', () => {
    expect(launcherPageUrl('/opt/resellr', 'lp-02', { ref: REF_NO })).toBe(
      `file:///opt/resellr/launcher-pages/lp-02.html?ref=${REF_NO}`,
    );
  });

  it('encodes spaces, umlauts and # in the path of the program folder', () => {
    const url = new URL(launcherPageUrl('/home/Jörg Müller #2/resellr', 'lp-02', { ref: REF_NO }));

    expect(url.pathname).toBe(
      '/home/J%C3%B6rg%20M%C3%BCller%20%232/resellr/launcher-pages/lp-02.html',
    );
    expect(url.searchParams.get('ref')).toBe(REF_NO);
    expect(url.hash).toBe('');
  });

  it.each([[null], [undefined], ['R-1'], ['<script>']])(
    'leaves out ref %s that is no reference number',
    (ref) => {
      expect(launcherPageUrl('/opt/resellr', 'lp-02', { ref })).toBe(
        'file:///opt/resellr/launcher-pages/lp-02.html',
      );
    },
  );

  it('encodes request and dataDir as URL parameters', () => {
    const url = new URL(
      launcherPageUrl('/opt/resellr', 'lp-03', { request: 'a&b', dataDir: 'C:\\Daten & Co' }),
    );

    expect(url.searchParams.get('request')).toBe('a&b');
    expect(url.searchParams.get('dataDir')).toBe('C:\\Daten & Co');
  });
});
