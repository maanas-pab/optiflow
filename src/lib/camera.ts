/** Camera lifecycle. Video only — never audio. */

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === 'videoinput');
}

export async function startCamera(deviceId?: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera is not supported in this browser. Try a current version of Chrome, Edge, Firefox, or Safari on localhost or HTTPS.');
  }
  return navigator.mediaDevices.getUserMedia({
    video: deviceId ? { deviceId: { exact: deviceId } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false, // video only, never microphone
  });
}

/** Stop every track. Safe to call twice. Tested in camera.test.ts with a mock stream. */
export function stopCamera(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try { track.stop(); } catch { /* already stopped */ }
  }
}

export function cameraErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name ?? '';
  if (name === 'NotAllowedError') return 'Camera permission was denied. Allow camera access in your browser, then try again. You can still use self-report and Reset Studio without a camera.';
  if (name === 'NotFoundError') return 'No camera was found on this device.';
  if (name === 'NotReadableError') return 'The camera is in use by another app. Close that app and try again.';
  if (name === 'OverconstrainedError') return 'That camera could not meet the requested settings. Try another camera.';
  return err instanceof Error ? err.message : 'The camera could not be started.';
}
