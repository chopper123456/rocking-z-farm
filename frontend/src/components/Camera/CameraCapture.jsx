import { useState, useRef, useEffect } from 'react';
import { compressImage } from '../../utils/imageCompress';
import { getCurrentPosition } from '../../utils/geolocation';
import './CameraCapture.css';

const MAX_PHOTOS = 5;
const DEFAULT_MAX_WIDTH = 1200;
const DEFAULT_QUALITY = 0.8;

/**
 * CameraCapture: use device camera or file picker, compress, optional GPS.
 * onPhotos(photos: Array<{ blob: Blob, name: string, gps?: { lat, lng } }>)
 */
export default function CameraCapture({ onPhotos, maxPhotos = MAX_PHOTOS, withGps = true }) {
  const [stream, setStream] = useState(null);
  const [captured, setCaptured] = useState([]);
  const [gps, setGps] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('choice'); // 'choice' | 'camera' | 'picker'
  const videoRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (withGps) {
      getCurrentPosition().then(setGps);
    }
  }, [withGps]);

  useEffect(() => {
    if (mode !== 'camera' || !videoRef.current) return;
    let s = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((mediaStream) => {
        s = mediaStream;
        setStream(mediaStream);
        videoRef.current.srcObject = mediaStream;
        setError(null);
      })
      .catch((err) => {
        setError('Camera access denied or unavailable.');
        setMode('choice');
      });
    return () => {
      if (s) s.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [mode]);

  const addPhoto = async (file) => {
    if (captured.length >= maxPhotos) return;
    try {
      const blob = await compressImage(file, DEFAULT_MAX_WIDTH, DEFAULT_QUALITY);
      const name = file.name || `photo-${Date.now()}.jpg`;
      setCaptured((prev) => [...prev, { blob, name, gps: gps || undefined }]);
    } catch (e) {
      setError('Failed to process image.');
    }
  };

  const captureFromCamera = () => {
    if (!videoRef.current || !stream) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCaptured((prev) => [...prev, { blob, name: `photo-${Date.now()}.jpg`, gps: gps || undefined }]);
          if (captured.length + 1 >= maxPhotos) setMode('choice');
        }
      },
      'image/jpeg',
      DEFAULT_QUALITY
    );
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    Promise.all(Array.from(files).slice(0, maxPhotos - captured.length).map((f) => addPhoto(f))).then(() => {
      if (inputRef.current) inputRef.current.value = '';
    });
  };

  const removePhoto = (index) => {
    setCaptured((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = () => {
    if (captured.length) onPhotos(captured);
  };

  return (
    <div className="camera-capture">
      {error && <p className="camera-capture-error">{error}</p>}
      {withGps && gps && (
        <p className="camera-capture-gps">📍 Location: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</p>
      )}

      {mode === 'choice' && (
        <div className="camera-capture-choices">
          <button
            type="button"
            className="camera-capture-btn"
            onClick={() => setMode('camera')}
            aria-label="Open camera"
          >
            📷 Take Photo
          </button>
          <button
            type="button"
            className="camera-capture-btn"
            onClick={() => inputRef.current?.click()}
            aria-label="Choose from gallery"
          >
            🖼️ Choose from Gallery
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={handleFileChange}
            className="camera-capture-input"
            aria-hidden
          />
        </div>
      )}

      {mode === 'camera' && (
        <div className="camera-capture-video-wrap">
          <video ref={videoRef} autoPlay playsInline muted className="camera-capture-video" />
          <div className="camera-capture-actions">
            <button type="button" className="camera-capture-btn secondary" onClick={() => setMode('choice')}>
              Back
            </button>
            <button
              type="button"
              className="camera-capture-btn primary"
              onClick={captureFromCamera}
              disabled={captured.length >= maxPhotos}
            >
              Capture ({captured.length}/{maxPhotos})
            </button>
          </div>
        </div>
      )}

      {captured.length > 0 && (
        <div className="camera-capture-preview-list">
          <p className="camera-capture-preview-label">Photos ({captured.length})</p>
          {captured.map((p, i) => (
            <div key={i} className="camera-capture-preview-item">
              <img src={URL.createObjectURL(p.blob)} alt={`Preview ${i + 1}`} />
              {p.gps && <span className="camera-capture-preview-gps">📍</span>}
              <button
                type="button"
                className="camera-capture-remove"
                onClick={() => removePhoto(i)}
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {captured.length > 0 && (
        <button type="button" className="camera-capture-btn primary submit" onClick={submit}>
          Use {captured.length} photo{captured.length !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}
