import { useState, useRef, useEffect } from 'react';
import './BarcodeScanner.css';

/**
 * Barcode scanner using device camera via html5-qrcode (or fallback input).
 * onScan(result), onClose().
 */
export default function BarcodeScanner({ onScan, onClose }) {
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const containerRef = useRef(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    let scanner = null;
    const start = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        scanner = new Html5Qrcode(containerRef.current?.id || 'barcode-reader');
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 200, height: 200 } },
          (decodedText) => {
            onScan?.(decodedText);
            scanner.stop().catch(() => {});
            setScanning(false);
          },
          () => {}
        );
        scannerRef.current = scanner;
        setScanning(true);
        setError(null);
      } catch (e) {
        setError('Camera unavailable or denied.');
      }
    };
    start();
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
      }
    };
  }, [onScan]);

  return (
    <div className="barcode-scanner">
      <div className="barcode-scanner-header">
        <h3>Scan barcode</h3>
        <button type="button" className="barcode-scanner-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {error && <p className="barcode-scanner-error">{error}</p>}
      <div id="barcode-reader" ref={containerRef} className="barcode-scanner-video" />
      {!scanning && !error && <p className="barcode-scanner-hint">Point camera at barcode</p>}
    </div>
  );
}
