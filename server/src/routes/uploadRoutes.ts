import { Router } from 'express';
import { env } from '../config/env.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const OQENS_BASE = 'https://auth.oqens.me/api/bucket';
const CDN_BASE = 'https://dl.oqens.me';

// ─── Upload Image via Base64 → OQENS CDN ──────────────
router.post('/upload', async (req: any, res: any) => {
  try {
    const { image, url } = req.body;

    let fileBuffer: Buffer;
    let mimeType = 'image/png';
    let ext = 'png';

    if (image) {
      // Base64 image: data:image/png;base64,...
      const matches = image.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/);
      if (!matches) {
        res.status(400).json({
          error: 'Invalid base64 image. Format: data:image/png;base64,...',
          expected: 'POST JSON body with { "image": "data:image/png;base64,..." }',
        });
        return;
      }
      ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      mimeType = `image/${matches[1]}`;
      fileBuffer = Buffer.from(matches[2], 'base64');
    } else if (url) {
      // Download from URL and re-upload
      const resp = await fetch(url);
      if (!resp.ok) {
        res.status(400).json({ error: `Failed to fetch URL: ${resp.status}` });
        return;
      }
      const arrayBuf = await resp.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuf);
      mimeType = resp.headers.get('content-type') || 'image/png';
      ext = mimeType.split('/')[1] || 'png';
    } else {
      res.status(400).json({
        error: 'Send { "image": "data:image/...;base64,..." } or { "url": "https://..." }',
      });
      return;
    }

    const fileName = `valquiz_${uuidv4().slice(0, 8)}.${ext}`;

    // Upload to OQENS using fetch with FormData
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    formData.append('file', blob, fileName);

    const oqensRes = await fetch(`${OQENS_BASE}/upload`, {
      method: 'POST',
      headers: { 'X-API-Key': env.OQENS_API_KEY },
      body: formData,
    });

    const oqensText = await oqensRes.text();
    if (!oqensRes.ok) {
      console.error('OQENS upload failed:', oqensRes.status, oqensText);
      res.status(502).json({ error: `OQENS upload failed (${oqensRes.status})`, detail: oqensText });
      return;
    }

    let oqensData: any;
    try { oqensData = JSON.parse(oqensText); } catch { oqensData = { key: fileName }; }

    const fileKey = oqensData?.key || oqensData?.file || fileName;
    const cloudId = env.OQENS_CLOUD_ID;

    // Primary: CDN delivery URL. Fallback: download API URL.
    const cdnUrl = cloudId ? `${CDN_BASE}/${cloudId}/${fileKey}` : null;
    const downloadUrl = `${OQENS_BASE.replace('/api/bucket', '')}/api/bucket/download?key=${fileKey}`;

    res.json({
      success: true,
      key: fileKey,
      cdn: cdnUrl,
      download: downloadUrl,
      preview: cdnUrl ? `${cdnUrl}?preview=true` : `${downloadUrl}&preview=true`,
      mimeType,
      size: fileBuffer.length,
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// ─── List Uploaded Files ──────────────────────────────
router.get('/uploads', async (_req: any, res: any) => {
  try {
    const oqensRes = await fetch(`${OQENS_BASE}/list`, {
      headers: { 'X-API-Key': env.OQENS_API_KEY },
    });
    const text = await oqensRes.text();
    if (!oqensRes.ok) {
      res.status(502).json({ error: 'OQENS list failed', detail: text });
      return;
    }
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    res.json({ success: true, files: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
