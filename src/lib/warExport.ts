/**
 * Captures a DOM element as a PNG image using native browser rendering
 * (SVG foreignObject → Image → Canvas). This avoids html2canvas
 * limitations with modern CSS color formats like Tailwind v4's oklch().
 *
 * Steps:
 * 1. Deep clone the element with all computed styles inlined
 * 2. Serialize to XML (via XMLSerializer) so void elements are self-closing
 * 3. Embed in SVG foreignObject — browser renders natively, supports oklch
 * 4. Load SVG as Image, draw to Canvas, export as PNG
 */
export async function exportElementAsPng(element: HTMLElement, filename: string): Promise<void> {
  // ── 1. Deep clone and inline computed styles ────────────────────────
  function inlineComputedStyles(root: HTMLElement): HTMLElement {
    const clone = root.cloneNode(true) as HTMLElement;
    const originals = [root, ...root.querySelectorAll('*')] as HTMLElement[];
    const clones = [clone, ...clone.querySelectorAll('*')] as HTMLElement[];

    const essentialProps = [
      'display', 'position', 'visibility', 'opacity',
      'width', 'height', 'min-width', 'min-height',
      'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'border', 'border-width', 'border-style', 'border-radius',
      'border-top', 'border-right', 'border-bottom', 'border-left',
      'border-color', 'border-top-color', 'border-right-color',
      'border-bottom-color', 'border-left-color',
      'background', 'background-color', 'background-image',
      'background-size', 'background-position', 'background-repeat',
      'color', 'font', 'font-family', 'font-size', 'font-weight',
      'font-style', 'line-height', 'text-align', 'text-decoration',
      'text-transform', 'letter-spacing', 'white-space',
      'overflow', 'overflow-x', 'overflow-y',
      'flex', 'flex-direction', 'flex-wrap',
      'align-items', 'align-content', 'justify-content',
      'gap', 'row-gap', 'column-gap',
      'box-shadow', 'transform',
      'z-index', 'cursor', 'pointer-events',
    ];

    clones.forEach((el, i) => {
      if (i >= originals.length) return;
      const computed = getComputedStyle(originals[i]);
      essentialProps.forEach((prop) => {
        const val = computed.getPropertyValue(prop);
        if (val && val !== 'none' && val !== 'normal' && val !== 'visible') {
          el.style.setProperty(prop, val);
        }
      });
    });

    return clone;
  }

  const clone = inlineComputedStyles(element);
  clone.style.position = 'fixed';
  clone.style.top = '-9999px';
  clone.style.left = '-9999px';
  clone.style.margin = '0';
  document.body.appendChild(clone);

  const w = Math.max(Math.round(clone.scrollWidth || clone.offsetWidth), 100);
  const h = Math.max(Math.round(clone.scrollHeight || clone.offsetHeight), 100);
  clone.style.width = `${w}px`;
  clone.style.height = `${h}px`;

  // ── 2. Serialize to XML and embed in SVG ────────────────────────────
  const serializer = new XMLSerializer();
  const htmlStr = serializer.serializeToString(clone);
  document.body.removeChild(clone);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
         xmlns:xhtml="http://www.w3.org/1999/xhtml"
         width="${w}" height="${h}">
      <foreignObject width="${w}" height="${h}">
        <xhtml:div xmlns:xhtml="http://www.w3.org/1999/xhtml"
                   style="width:${w}px;height:${h}px;overflow:hidden;background:#0f172a;color-scheme:dark">
          ${htmlStr}
        </xhtml:div>
      </foreignObject>
    </svg>
  `;

  // ── 3. Render to canvas via Image (base64 data URL to avoid tainted canvas) ──
  return new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    // Use base64 data URL to avoid tainted canvas from blob URLs
    const base64 = btoa(unescape(encodeURIComponent(svg)));
    const dataUrl = `data:image/svg+xml;base64,${base64}`;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w * 2;
      canvas.height = h * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);

      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      resolve();
    };
    img.onerror = () => {
      fallbackExport(element, filename, resolve, reject);
    };
    img.src = dataUrl;
  });
}

async function fallbackExport(
  element: HTMLElement, filename: string,
  resolve: () => void, reject: (e: Error) => void,
): Promise<void> {
  try {
    // Try dynamic import of a smaller canvas-based approach
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const rect = element.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;

    // Draw a simple placeholder so users at least get something
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('War Setup Export', canvas.width / 2, canvas.height / 2 - 8);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('(Export failed — please try again or use CSV)', canvas.width / 2, canvas.height / 2 + 16);

    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    resolve();
  } catch {
    reject(new Error('Export failed'));
  }
}
