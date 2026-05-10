import { useEffect, useRef, useState } from "react";
import { Camera, ScanLine } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

type BarcodeDetectorResult = { rawValue?: string };
type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<BarcodeDetectorResult[]>;
};
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  const detector = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return detector ?? null;
}

interface CameraBarcodeScannerProps {
  onDetected: (code: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function CameraBarcodeScanner({ onDetected, label = "Scan with camera", disabled, className }: CameraBarcodeScannerProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const busyRef = useRef(false);

  const stopScanner = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    busyRef.current = false;
  };

  useEffect(() => {
    if (!open) {
      stopScanner();
      setError("");
      return;
    }

    const startScanner = async () => {
      setIsStarting(true);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Camera access is not supported on this device/browser.");
          return;
        }
        const BarcodeDetectorImpl = getBarcodeDetectorCtor();
        if (!BarcodeDetectorImpl) {
          setError("Barcode scanning is not supported in this browser. Please scan using a supported mobile browser or type the barcode.");
          return;
        }

        detectorRef.current = new BarcodeDetectorImpl({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "codabar", "qr_code"],
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        streamRef.current = stream;
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const tick = async () => {
          const video = videoRef.current;
          const detector = detectorRef.current;
          if (!video || !detector) return;
          if (!busyRef.current) {
            busyRef.current = true;
            try {
              const codes = await detector.detect(video);
              const value = codes.find((code) => typeof code.rawValue === "string" && code.rawValue.trim().length > 0)?.rawValue?.trim();
              if (value) {
                onDetected(value);
                setOpen(false);
                return;
              }
            } catch {
              // Ignore transient frame detection errors.
            } finally {
              busyRef.current = false;
            }
          }
          rafRef.current = requestAnimationFrame(() => {
            void tick();
          });
        };

        rafRef.current = requestAnimationFrame(() => {
          void tick();
        });
      } catch (err: unknown) {
        const error = err as { name?: string };
        if (error?.name === "NotAllowedError") {
          setError("Camera permission was denied. Please allow camera access and try again.");
        } else if (error?.name === "NotFoundError") {
          setError("No camera was found on this device.");
        } else if (error?.name === "NotReadableError") {
          setError("Camera is currently in use by another application.");
        } else {
          setError("Unable to start camera scanner. Please allow camera access and try again.");
        }
      } finally {
        setIsStarting(false);
      }
    };

    void startScanner();
    return () => stopScanner();
  }, [open, onDetected]);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} disabled={disabled} className={className}>
        <ScanLine className="w-4 h-4" /> {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Scan barcode with camera" size="sm">
        <div className="flex flex-col gap-3">
          <div className="aspect-video w-full bg-black/90 border border-stroke flex items-center justify-center overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            {!streamRef.current && (
              <div className="absolute flex items-center gap-2 text-white/80 text-sm">
                <Camera className="w-4 h-4" />
                <span>{isStarting ? "Starting camera…" : "Waiting for camera…"}</span>
              </div>
            )}
          </div>
          {error ? (
            <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          ) : (
            <p className="text-xs text-muted">Point the camera at a barcode. It will scan automatically.</p>
          )}
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
