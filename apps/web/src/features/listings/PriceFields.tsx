import { formatMoneyInput } from '@resellr/domain/format/format-value';
import { decimalToCents, parseDecimal } from '@resellr/domain/format/parse-decimal';
import { FIELD_MESSAGES } from '@resellr/domain/messages/messages.de';
import { priceAmountSchema } from '@resellr/domain/schemas/listing.schema';
import { useState } from 'react';

import { useSaveListingPriceMutation } from '../../api/inventory.api.ts';
import { FormField, useDeferredBlurCheck } from '../../components/forms/FormField.tsx';
import { Checkbox } from '../../components/ui/Checkbox.tsx';
import { Input } from '../../components/ui/Input.tsx';

export interface PriceFieldsProps {
  listingId: number;
  /** The version of the model listing the page shows (2.0.3). */
  version: number;
  channelId: number;
  /** The channel allows "Verhandlungsbasis" (REQ-029); otherwise there is no check box "VB". */
  vbAllowed: boolean;
  /** The stored price of the channel, `null` without one. */
  price: { amountCents: number; vb: boolean } | null;
}

/** The entered price in cents, `null` if it breaks the rule "> 0, at most two decimal places". */
function enteredCents(text: string): number | null {
  const canonical = parseDecimal(text);
  const cents = canonical === null ? null : decimalToCents(canonical);
  return priceAmountSchema.safeParse(cents).success ? cents : null;
}

/**
 * Price fields (CU-141, REQ-032; Technical Specification 2.7, UI-014 "Preis je Kanal"): the price of
 * one channel with decimal comma or point and, only where the channel allows it, the check box
 * "VB". Leaving the field, Enter or a click on "VB" saves (`PUT …/prices/{channelId}`); a price
 * that breaks the rule shows the field error and sends nothing (AC-REQ-032-03). The answer updates
 * the cached model listing, so all price fields take over the new prices and version (DER-62-04).
 * Banner, lock and the other page states of saving follow with #274; the channel card (CU-187)
 * places the fields in UI-014 with #211. Extended in S5 by "Vorschlag nach Preisregel".
 */
export function PriceFields({ listingId, version, channelId, vbAllowed, price }: PriceFieldsProps) {
  const save = useSaveListingPriceMutation(listingId);
  const blurCheck = useDeferredBlurCheck();
  const storedText = price === null ? '' : formatMoneyInput(price.amountCents);
  const storedVb = price?.vb ?? false;
  const [shown, setShown] = useState({ text: storedText, vb: storedVb });
  const [text, setText] = useState(storedText);
  const [vb, setVb] = useState(storedVb);
  const [errors, setErrors] = useState<{ amountCents?: string; vb?: string }>({});

  // A new stored price, e.g. from the answer of another channel's save, replaces the input.
  if (shown.text !== storedText || shown.vb !== storedVb) {
    setShown({ text: storedText, vb: storedVb });
    setText(storedText);
    setVb(storedVb);
  }

  function submit(nextVb: boolean) {
    // One save at a time: Enter and then leaving the field would send the same version twice.
    if (save.isPending || (text.trim() === '' && price === null)) return;
    const amountCents = enteredCents(text);
    if (amountCents === null) {
      setErrors({ amountCents: FIELD_MESSAGES.price });
      return;
    }
    setErrors({});
    if (amountCents === price?.amountCents && nextVb === price.vb) {
      setText(storedText);
      return;
    }
    save.mutate(
      { channelId, body: { version, amountCents, vb: nextVb } },
      {
        onSuccess: ({ prices }) => {
          const answered = prices.find((entry) => entry.channelId === channelId);
          if (answered === undefined) return;
          setText(formatMoneyInput(answered.amountCents));
          setVb(answered.vb);
        },
        onError: (error) => {
          if (error.kind !== 'validation') return;
          const next: { amountCents?: string; vb?: string } = {};
          for (const { path, message } of error.error?.fields ?? []) {
            if (path === 'amountCents' || path === 'vb') next[path] ??= message;
          }
          setErrors(next);
        },
      },
    );
  }

  return (
    // A click on "VB" leaves the price field first; its check waits for the click, which saves.
    <div className="flex flex-col gap-2" onPointerDown={blurCheck.pressPointer}>
      <FormField label="Preis" error={errors.amountCents}>
        {(control) => (
          <Input
            {...control}
            inputMode="decimal"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={() => blurCheck.checkOnBlur(() => submit(vb))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit(vb);
            }}
          />
        )}
      </FormField>
      {vbAllowed && (
        <Checkbox
          label="VB"
          checked={vb}
          error={errors.vb}
          onChange={(checked) => {
            blurCheck.cancel();
            setVb(checked);
            submit(checked);
          }}
        />
      )}
    </div>
  );
}
