import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useListingQuery } from '../../api/inventory.api.ts';
import { createQueryClient } from '../../app/query-client.ts';
import { PriceFields } from './PriceFields.tsx';

// Component tests of the price fields (CU-141, REQ-032; Technical Specification 2.7) with a
// mocked `fetch` (6.1, 6.2): in S4 the component is not part of UI-014 yet (4.4.0, #211), so the
// tests render it on its own, for the channel card as #211 will use it. States: default and
// validation (field error).

const PRICE_RULE = 'Preis: Zahl größer 0 mit höchstens zwei Nachkommastellen';
const SHOP = 1;
const KLEINANZEIGEN = 2;
const LISTING_ID = 9;

/** MI-A as `GET /api/listings/9` returns it, with the prices of Shop and Kleinanzeigen. */
const LISTING = {
  id: LISTING_ID,
  modelTemplateId: 3,
  conditionValueId: 1,
  visualGrade: 2,
  conditionDescription: '',
  variantValues: {},
  otherValues: {},
  deliveryScopeTextBlockIds: [],
  articleNumber: '626198',
  eanMode: 'original',
  ownEan: null,
  displayTitle: 'MacBook Pro 13',
  quantity: 1,
  version: 2,
  stock: { quantity: 1, wiNrs: ['626198'], batteryText: '85 %', stockHash: 'h' },
  prices: [
    { channelId: SHOP, amountCents: 26900, vb: false, source: 'manual' },
    { channelId: KLEINANZEIGEN, amountCents: 27900, vb: false, source: 'manual' },
  ],
  devices: [],
  deliveryScope: [],
};

const PRICE_PATH = (channelId: number) => `/api/listings/${LISTING_ID}/prices/${channelId}`;

type Answer = (body: unknown) => Response;

/**
 * `fetch` answering `GET /api/listings/9` with MI-A and each `PUT` of a price in turn with
 * `answers`; records the writes with path and body and counts the reads.
 */
function mockApi(...answers: Answer[]) {
  const sent: { path: string; body: unknown }[] = [];
  let reads = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET' && path === `/api/listings/${LISTING_ID}`) {
        reads += 1;
        return Response.json(LISTING);
      }
      const answer = answers[sent.length];
      if (method !== 'PUT' || !answer) throw new Error(`unexpected request ${method} ${path}`);
      const body: unknown = JSON.parse(String(init?.body));
      sent.push({ path, body });
      return answer(body);
    }),
  );
  return { sent, reads: () => reads };
}

/** `200` of the price service: the new version and the prices of all channels (DER-62-04). */
const saved =
  (version: number, prices: object[]): Answer =>
  () =>
    Response.json({ listing: { version }, prices });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The price fields of one channel with a stored price, as the channel card shows them. */
function renderFields({
  channelId = SHOP,
  vbAllowed = false,
  price = { amountCents: 26900, vb: false } as { amountCents: number; vb: boolean } | null,
} = {}) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <PriceFields
        listingId={LISTING_ID}
        version={2}
        channelId={channelId}
        vbAllowed={vbAllowed}
        price={price}
      />
    </QueryClientProvider>,
  );
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Preis' });
}

/** The error text linked to the field with `aria-describedby`, `null` without error. */
function errorOf(field: HTMLElement): string | null {
  if (field.getAttribute('aria-invalid') !== 'true') return null;
  const id = field.getAttribute('aria-describedby');
  return id === null ? null : (document.getElementById(id)?.textContent ?? null);
}

/** Types `text` into the field and leaves it. */
async function enterAndLeave(field: HTMLElement, text: string) {
  fireEvent.change(field, { target: { value: text } });
  await act(async () => {
    fireEvent.blur(field);
  });
}

describe('PriceFields (CU-141, UI-014 "Preis je Kanal")', () => {
  it('UI-014.default shows the stored price with decimal comma', () => {
    mockApi();
    const field = renderFields();

    expect(field.value).toBe('269,00');
    expect(errorOf(field)).toBeNull();
  });

  it.each([
    ['0', '0'],
    ['„12,345“', '12,345'],
  ])(
    'AC-REQ-032-03 UI-014.validation shows the price rule at the field for %s and sends nothing',
    async (_, text) => {
      const api = mockApi();
      const field = renderFields();

      await enterAndLeave(field, text);

      expect(errorOf(field)).toBe(PRICE_RULE);
      expect(api.sent).toEqual([]);
    },
  );

  it('AC-REQ-032-03 shows the price rule the server reports at the field', async () => {
    mockApi(() =>
      Response.json(
        {
          error: {
            code: 'validation_failed',
            message: '',
            fields: [{ path: 'amountCents', code: 'custom', message: PRICE_RULE }],
            details: {},
            referenceNumber: null,
          },
        },
        { status: 422 },
      ),
    );
    const field = renderFields();

    await enterAndLeave(field, '279,00');

    await screen.findByText(PRICE_RULE);
    expect(errorOf(field)).toBe(PRICE_RULE);
  });

  it('AC-REQ-032-04 offers no check box "VB" for a channel without "Verhandlungsbasis"', () => {
    mockApi();
    renderFields({ channelId: SHOP, vbAllowed: false });

    expect(screen.queryByRole('checkbox', { name: 'VB' })).toBeNull();
  });

  it('AC-REQ-032-04 offers the check box "VB" for a channel with "Verhandlungsbasis" and saves it', async () => {
    const api = mockApi(
      saved(3, [{ channelId: KLEINANZEIGEN, amountCents: 5000, vb: true, source: 'manual' }]),
    );
    renderFields({ channelId: KLEINANZEIGEN, vbAllowed: true, price: null });
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Preis' });

    fireEvent.change(field, { target: { value: '50' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'VB' }));
    });

    expect(api.sent).toEqual([
      { path: PRICE_PATH(KLEINANZEIGEN), body: { version: 2, amountCents: 5000, vb: true } },
    ]);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'VB' }).checked).toBe(true);
  });

  it.each([
    ['a decimal comma', '269,00'],
    ['a decimal point', '269.00'],
    ['no decimal places', '269'],
  ])('turns an input with %s into 26900 and saves it on leaving the field', async (_, text) => {
    const api = mockApi(
      saved(3, [{ channelId: SHOP, amountCents: 26900, vb: false, source: 'manual' }]),
    );
    const field = renderFields({ price: null });

    await enterAndLeave(field, text);

    expect(api.sent).toEqual([
      { path: PRICE_PATH(SHOP), body: { version: 2, amountCents: 26900, vb: false } },
    ]);
    expect(field.value).toBe('269,00');
  });

  it('saves with Enter', async () => {
    const api = mockApi(
      saved(3, [{ channelId: SHOP, amountCents: 28900, vb: false, source: 'manual' }]),
    );
    const field = renderFields();

    fireEvent.change(field, { target: { value: '289,00' } });
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter' });
    });

    expect(api.sent).toEqual([
      { path: PRICE_PATH(SHOP), body: { version: 2, amountCents: 28900, vb: false } },
    ]);
  });

  it('sends nothing when the field is left without a change', async () => {
    const api = mockApi();
    const field = renderFields();

    await enterAndLeave(field, '269,0');

    expect(api.sent).toEqual([]);
    expect(errorOf(field)).toBeNull();
  });

  it('DER-62-04 takes over the prices of all channels and the new version from the answer without reading again', async () => {
    const api = mockApi(
      saved(3, [
        { channelId: SHOP, amountCents: 28900, vb: false, source: 'manual' },
        { channelId: KLEINANZEIGEN, amountCents: 29900, vb: false, source: 'rule' },
      ]),
      saved(4, [
        { channelId: SHOP, amountCents: 28900, vb: false, source: 'manual' },
        { channelId: KLEINANZEIGEN, amountCents: 31900, vb: false, source: 'manual' },
      ]),
    );

    /** Both channels of MI-A from the cached model listing, as the channel cards will hold them. */
    function Cards() {
      const { data } = useListingQuery(LISTING_ID);
      if (data === undefined) return null;
      return (
        <>
          {[SHOP, KLEINANZEIGEN].map((channelId) => (
            <section key={channelId} aria-label={`Kanal ${channelId}`}>
              <PriceFields
                listingId={LISTING_ID}
                version={data.version}
                channelId={channelId}
                vbAllowed={channelId === KLEINANZEIGEN}
                price={data.prices.find((price) => price.channelId === channelId) ?? null}
              />
            </section>
          ))}
        </>
      );
    }
    render(
      <QueryClientProvider client={createQueryClient()}>
        <Cards />
      </QueryClientProvider>,
    );
    const priceOf = async (channelId: number) =>
      within(
        await screen.findByRole('region', { name: `Kanal ${channelId}` }),
      ).getByRole<HTMLInputElement>('textbox', { name: 'Preis' });

    await enterAndLeave(await priceOf(SHOP), '289,00');

    // Kleinanzeigen shows the price of the answer; the next save sends the new version.
    expect((await priceOf(KLEINANZEIGEN)).value).toBe('299,00');
    await enterAndLeave(await priceOf(KLEINANZEIGEN), '319,00');
    expect(api.sent.map((write) => write.body)).toEqual([
      { version: 2, amountCents: 28900, vb: false },
      { version: 3, amountCents: 31900, vb: false },
    ]);
    expect((await priceOf(KLEINANZEIGEN)).value).toBe('319,00');
    expect(api.reads()).toBe(1);
  });
});
