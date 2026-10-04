import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';

// Full-screen camera barcode scanner for phones without a USB/BT HID
// scanner. Deliberately stays open after a hit (onDetect resolves and the
// camera keeps decoding) so a cashier can scan several items in a row —
// only the explicit close button tears the stream down. `onDetect` is
// async and returns { ok, text } so this component can flash the result
// without needing to know anything about products/carts.
export function CameraScanner({ onDetect, onClose }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const lastRef = useRef({ code: '', time: 0 });
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(null);

  // Stashed in a ref (rather than a useEffect dependency) so the camera
  // stream is opened once on mount — a fresh `onDetect` identity on every
  // CashierPage re-render must never tear down and reopen the camera.
  const onDetectRef = useRef(onDetect);
  useEffect(() => {
    onDetectRef.current = onDetect;
  });

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    async function handleResult(code) {
      const now = Date.now();
      if (code === lastRef.current.code && now - lastRef.current.time < 2000) return;
      lastRef.current = { code, time: now };
      const result = await onDetectRef.current(code);
      if (!cancelled) setFlash({ ...result, key: now });
    }

    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        (result) => {
          if (result && !cancelled) handleResult(result.getText());
        }
      )
      .then((controls) => {
        if (cancelled) {
          controls.stop();
        } else {
          controlsRef.current = controls;
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Kameraga ruxsat berilmadi');
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(timer);
  }, [flash]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted autoPlay />

      <div className="relative flex items-start justify-between p-4">
        <p className="rounded-field bg-black/40 px-3 py-1.5 text-sm text-white backdrop-blur-sm">
          Shtrix-kodni ramka ichiga joylashtiring
        </p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-transform hover:scale-105"
          aria-label="Yopish"
        >
          <X size={20} />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        <div
          className="relative h-40 w-72 max-w-[80vw] overflow-hidden rounded-box border-2 border-white/80"
          style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}
        >
          <div className="scan-line" />
        </div>
      </div>

      {error && (
        <div className="relative mx-4 mb-6 rounded-field bg-error/90 p-3 text-center text-sm text-white">{error}</div>
      )}

      {flash && (
        <div
          key={flash.key}
          className={`animate-pop relative mx-4 mb-6 rounded-field p-3 text-center text-sm font-medium text-white ${
            flash.ok ? 'bg-success/90' : 'bg-error/90'
          }`}
        >
          {flash.text}
        </div>
      )}
    </div>
  );
}
