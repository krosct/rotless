import { useState } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { createBatch } from '../api/batches';
import { ApiError } from '../api/client';
import { BarcodeScanner } from './BarcodeScanner';

interface CreateBatchFormProps {
  householdId: number;
  onCreated: () => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const fieldErrors = error.errors ? ` ${Object.values(error.errors).flat().join(' ')}` : '';
    return `${error.message}${fieldErrors}`;
  }
  return 'Something went wrong.';
}

export function CreateBatchForm({ householdId, onCreated }: CreateBatchFormProps) {
  const [mode, setMode] = useState<'barcode' | 'manual'>('barcode');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [expiresAt, setExpiresAt] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>): void {
    setPhoto(event.target.files?.[0] ?? null);
  }

  function handleBarcodeScan(scannedBarcode: string): void {
    setBarcode(scannedBarcode);
    setScannerError(null);
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'barcode') {
        if (!barcode.trim()) {
          setError('Please scan or enter a barcode.');
          setBusy(false);
          return;
        }
        await createBatch({
          household_id: householdId,
          barcode: barcode.trim(),
          quantity,
          expires_at: expiresAt,
        });
      } else {
        if (!name.trim()) {
          setError('Please enter a product name.');
          setBusy(false);
          return;
        }
        await createBatch({
          household_id: householdId,
          name: name.trim(),
          quantity,
          expires_at: expiresAt,
          photo: photo ?? undefined,
        });
      }
      onCreated();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>Add batch</h2>
      <div>
        <button type="button" onClick={() => setMode('barcode')} disabled={mode === 'barcode'}>
          Barcode
        </button>
        <button type="button" onClick={() => setMode('manual')} disabled={mode === 'manual'}>
          Manual
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        {mode === 'barcode' && (
          <>
            <label>
              Barcode
              <input
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder="Scan or type barcode"
                required
              />
            </label>
            <BarcodeScanner onScan={handleBarcodeScan} onError={setScannerError} />
            {scannerError !== null && <p role="alert" style={{ color: 'red' }}>{scannerError}</p>}
          </>
        )}
        {mode === 'manual' && (
          <>
            <label>
              Product name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Organic Milk"
                required
              />
            </label>
            <label>
              Photo (optional)
              <input type="file" accept="image/*" onChange={handlePhotoChange} />
            </label>
          </>
        )}
        <label>
          Quantity
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            required
          />
        </label>
        <label>
          Expires on
          <input
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            min={new Date().toISOString().split('T')[0]}
            required
          />
        </label>
        {error !== null && <p role="alert">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Add batch'}
        </button>
      </form>
    </section>
  );
}