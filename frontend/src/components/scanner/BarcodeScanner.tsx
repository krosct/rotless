import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '@/components/ui/Button';
import { Camera, CameraOff, RefreshCw, Upload, AlertCircle } from 'lucide-react';

export interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose?: () => void;
}

export function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerContainerId = 'rotless-html5-qr-code';

  useEffect(() => {
    let isMounted = true;

    async function initScanner() {
      try {
        setIsInitializing(true);
        setErrorMessage(null);

        // Html5Qrcode formats config
        const html5QrCode = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });

        scannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 260, height: 160 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (isMounted) {
              // Beep sound feedback
              try {
                const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.12);
              } catch {
                // Ignore audio error
              }

              html5QrCode
                .stop()
                .then(() => {
                  html5QrCode.clear();
                  onScanSuccess(decodedText);
                  if (onClose) onClose();
                })
                .catch(() => {
                  onScanSuccess(decodedText);
                  if (onClose) onClose();
                });
            }
          },
          () => {
            // Frame scan failure (benign, searching for barcode)
          }
        );

        if (isMounted) {
          setIsInitializing(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setIsInitializing(false);
          const msg =
            err instanceof Error
              ? err.message
              : 'Não foi possível acessar a câmera. Verifique as permissões ou carregue uma imagem.';
          setErrorMessage(msg);
        }
      }
    }

    // Small delay to ensure DOM element is mounted
    const timer = setTimeout(() => {
      initScanner();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current
            .stop()
            .then(() => scannerRef.current?.clear())
            .catch(() => {});
        } else {
          try {
            scannerRef.current.clear();
          } catch {
            // Ignore
          }
        }
      }
    };
  }, [onScanSuccess, onClose]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setErrorMessage(null);
      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(scannerContainerId);
        scannerRef.current = scanner;
      }
      const result = await scanner.scanFile(file, true);
      onScanSuccess(result);
      if (onClose) onClose();
    } catch {
      setErrorMessage('Nenhum código de barras legível foi encontrado nesta imagem.');
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="relative w-full aspect-square max-w-[340px] bg-stone-950 rounded-2xl overflow-hidden border border-stone-800 flex items-center justify-center">
        <div id={scannerContainerId} className="w-full h-full" />

        {isInitializing && !errorMessage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-900/90 text-stone-200 gap-2 z-10">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-xs font-medium">Iniciando câmera...</p>
          </div>
        )}

        {errorMessage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-stone-900 text-center z-10">
            <CameraOff className="w-10 h-10 text-rose-400 mb-2" />
            <p className="text-xs text-rose-300 font-medium mb-4">{errorMessage}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs border-stone-700 text-stone-200 hover:bg-stone-800"
            >
              <Upload className="w-3.5 h-3.5 mr-1" />
              Escanear de foto da galeria
            </Button>
          </div>
        )}

        {/* Viewfinder target overlay when active */}
        {!isInitializing && !errorMessage && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-64 h-40 border-2 border-emerald-400/80 rounded-xl relative shadow-[0_0_15px_rgba(45,106,79,0.3)]">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500/80 animate-pulse" />
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      <div className="flex items-center justify-between w-full max-w-[340px] text-xs text-stone-500 dark:text-stone-400 px-1">
        <span className="flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-emerald-600" />
          Aponte para o código EAN/UPC
        </span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-[#2d6a4f] dark:text-emerald-400 hover:underline font-medium flex items-center gap-1"
        >
          <Upload className="w-3 h-3" />
          Enviar foto
        </button>
      </div>

      {onClose && (
        <Button variant="secondary" size="md" onClick={onClose} className="w-full max-w-[340px]">
          Cancelar leitura
        </Button>
      )}
    </div>
  );
}
