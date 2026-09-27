"use client";
import { Camera, CameraOff, LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
// Note: html5-qrcode ships no separate stylesheet (its package only exports
// dist/html5-qrcode.min.js) — it injects the video element and its own
// overlay elements directly into the DOM. The visual overrides for that
// overlay live in globals.css, scoped with attribute selectors (see the
// "Dialogs, scanner and print preview" section) since this component's
// root id is generated per-mount via useId() below.
type Props = { onDetected: (code: string) => void };
export function CameraScanner({ onDetected }: Props) {
  const id = `barcode-reader-${useId().replace(/:/g, "")}`;
  const callbackRef = useRef(onDetected);
  const detectedRef = useRef(false);
  const [status, setStatus] = useState<"starting" | "ready" | "error">("starting");
  const [error, setError] = useState("");
  callbackRef.current = onDetected;
  useEffect(() => {
    let disposed = false;
    let scanner: import("html5-qrcode").Html5Qrcode | undefined;
    const stop = async () => {
      if (!scanner) return;
      try { await scanner.stop(); } catch { /* Scanner may not have started yet. */ }
      try { scanner.clear(); } catch { /* Element may already be gone. */ }
    };
    void (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (disposed) return;
        scanner = new Html5Qrcode(id, { formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128], verbose: false });
        const scanConfig = { fps: 10, qrbox: { width: 260, height: 125 }, aspectRatio: 1.7777 };
        const onCode = (code: string) => {
          if (detectedRef.current) return;
          detectedRef.current = true;
          callbackRef.current(code.trim());
        };
        const onFrame = () => { /* No code in this frame. */ };
        try {
          // Preferred path: the rear ("environment") camera, which is what
          // staff use on a phone.
          await scanner.start({ facingMode: "environment" }, scanConfig, onCode, onFrame);
        } catch {
          if (disposed) return;
          // Some devices (most laptops, some Android webviews) have no
          // camera labeled "environment" and reject that constraint
          // outright. Fall back to whatever camera the device does have
          // rather than dead-ending in the "Camera unavailable" error —
          // this is what makes scanning usable during desktop testing too,
          // not only on a phone in the field.
          await scanner.start({ facingMode: "user" }, scanConfig, onCode, onFrame);
        }
        if (disposed) { await stop(); return; }
        setStatus("ready");
      } catch {
        if (!disposed) {
          setStatus("error");
          setError("Camera unavailable. Allow camera access or enter the barcode manually below.");
        }
      }
    })();
    return () => { disposed = true; void stop(); };
  }, [id]);
  return (
    <div className="camera-container">
      <div id={id} className="camera-reader" />
      {status === "starting" && <div className="camera-message"><LoaderCircle size={23} className="spin" /><span>Starting your camera...</span></div>}
      {status === "error" && <div className="camera-message camera-error"><CameraOff size={28} /><span>{error}</span></div>}
      {status === "ready" && <div className="camera-ready"><Camera size={14} /> Point your camera at the barcode</div>}
    </div>
  );
}
