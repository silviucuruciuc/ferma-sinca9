import QRCode from 'qrcode';

// Nivel de corecție „Q” (~25%): eticheta rămâne lizibilă chiar dacă se murdărește sau se zgârie.
// Fără margine în SVG — marginea albă (quiet zone) o dă layout-ul etichetei.
export async function qrSvg(text) {
  const svg = await QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: 'Q',
    margin: 0,
    color: { dark: '#000000', light: '#ffffff00' },
  });
  return svg.replace('<svg ', '<svg role="img" aria-label="Cod QR" ');
}
