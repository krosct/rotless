import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError?: (error: string) => void;
}

const SCANNER_ID = 'barcode-scanner';

export function BarcodeScanner({ onScan, onError }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [hasPermission, setHasPermission] = useState<true | false | 'prompt' | null>(null);

  useEffect(() => {
    const html5Qrcode = new Html5Qrcode(SCANNER_ID);
    scannerRef.current = html5Qrcode;

    return () => {
      if (html5Qrcode.isScanning) {
        html5Qrcode.stop().catch(() => {});
      }
      html5Qrcode.clear();
    };
  }, []);

  useEffect(() => {
    const html5Qrcode = scannerRef.current;
    if (!html5Qrcode) {
      return;
    }

    const startScanning = async (): Promise<void> => {
      try {
        setHasPermission('prompt');
        await html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 100 },
            aspectRatio: 1.777778,
          },
          (decodedText) => {
            onScan(decodedText);
          },
          (errorMessage) => {
            if (errorMessage.includes('No QR code found') || errorMessage.includes('No barcode found')) {
              return;
            }
            onError?.(errorMessage);
          },
        );
        setHasPermission(true);
      } catch (err: unknown) {
        setHasPermission(false);
        const message = err instanceof Error ? err.message : 'Failed to start camera';
        onError?.(message);
      }
    };

    startScanning();

    return () => {
      if (html5Qrcode.isScanning) {
        html5Qrcode.stop().catch(() => {});
      }
    };
  }, [onScan, onError]);

  if (hasPermission === false) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <p>Camera permission denied. Please allow camera access to scan barcodes.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload to retry
        </button>
      </div>
    );
  }

  return <div id={SCANNER_ID} style={{ width: '100%', maxWidth: 400, aspectRatio: '4/3' }} />;
}