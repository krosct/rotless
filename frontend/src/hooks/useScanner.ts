import { useState, useCallback } from 'react';

export interface UseScannerReturn {
  isScanning: boolean;
  permissionGranted: boolean | null;
  error: string | null;
  startScanning: () => void;
  stopScanning: () => void;
  setError: (err: string | null) => void;
}

export function useScanner(): UseScannerReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startScanning = useCallback(async () => {
    setError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        // Close test track immediately; Html5Qrcode will take over
        stream.getTracks().forEach((t) => t.stop());
        setPermissionGranted(true);
      }
      setIsScanning(true);
    } catch (err: unknown) {
      console.warn('Camera permission or availability check error:', err);
      setPermissionGranted(false);
      setError('Permissão de câmera negada ou câmera indisponível.');
      // Still allow opening scanner modal in case user wants to retry or upload barcode image
      setIsScanning(true);
    }
  }, []);

  const stopScanning = useCallback(() => {
    setIsScanning(false);
    setError(null);
  }, []);

  return {
    isScanning,
    permissionGranted,
    error,
    startScanning,
    stopScanning,
    setError,
  };
}
