/**
 * Utility to sanitize modern CSS color formats (oklch, oklab, color-mix)
 * to standard sRGB (rgb/rgba/hex) before html2canvas parsing.
 */

export function toSRGB(c: number): number {
  const abs = Math.abs(c);
  const comp = abs > 0.0031308 ? 1.055 * Math.pow(abs, 1 / 2.4) - 0.055 : 12.92 * abs;
  return Math.min(255, Math.max(0, Math.round(comp * 255)));
}

export function oklabToRgb(L: number, a: number, b: number, alpha: number = 1): string {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  const r = toSRGB(rLin);
  const g = toSRGB(gLin);
  const bVal = toSRGB(bLin);

  const safeAlpha = isNaN(alpha) ? 1 : Math.max(0, Math.min(1, alpha));
  if (safeAlpha < 1) {
    return `rgba(${r}, ${g}, ${bVal}, ${safeAlpha})`;
  }
  return `rgb(${r}, ${g}, ${bVal})`;
}

export function oklchToRgb(L: number, C: number, H: number, alpha: number = 1): string {
  const rad = (H * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  return oklabToRgb(L, a, b, alpha);
}

export function sanitizeCssColors(inputStr: string): string {
  if (!inputStr || typeof inputStr !== 'string') return inputStr;

  let result = inputStr;

  // 1. Replace oklch(...)
  result = result.replace(
    /oklch\(\s*([-\d.%]+|none)\s+([-\d.%]+|none)\s+([-\d.%(?:deg|rad)]+|none)(?:\s*(?:\/|,)\s*([-\d.%]+|none))?\s*\)/gi,
    (_, pL, pC, pH, pA) => {
      try {
        let L = pL === 'none' ? 0 : parseFloat(pL) / (pL.endsWith('%') ? 100 : 1);
        let C = pC === 'none' ? 0 : parseFloat(pC) / (pC.endsWith('%') ? 100 : 1);
        let H = 0;
        if (pH !== 'none') {
          if (pH.endsWith('deg')) H = parseFloat(pH);
          else if (pH.endsWith('rad')) H = (parseFloat(pH) * 180) / Math.PI;
          else H = parseFloat(pH);
        }
        let A = 1;
        if (pA !== undefined && pA !== 'none') {
          A = pA.endsWith('%') ? parseFloat(pA) / 100 : parseFloat(pA);
        }
        return oklchToRgb(L, C, H, A);
      } catch {
        return 'rgb(30, 41, 59)';
      }
    }
  );

  // 2. Replace oklab(...)
  result = result.replace(
    /oklab\(\s*([-\d.%]+|none)\s+([-\d.%]+|none)\s+([-\d.%]+|none)(?:\s*(?:\/|,)\s*([-\d.%]+|none))?\s*\)/gi,
    (_, pL, pa, pb, pA) => {
      try {
        let L = pL === 'none' ? 0 : parseFloat(pL) / (pL.endsWith('%') ? 100 : 1);
        let a = pa === 'none' ? 0 : parseFloat(pa) / (pa.endsWith('%') ? 100 : 1);
        let b = pb === 'none' ? 0 : parseFloat(pb) / (pb.endsWith('%') ? 100 : 1);
        let A = 1;
        if (pA !== undefined && pA !== 'none') {
          A = pA.endsWith('%') ? parseFloat(pA) / 100 : parseFloat(pA);
        }
        return oklabToRgb(L, a, b, A);
      } catch {
        return 'rgb(30, 41, 59)';
      }
    }
  );

  // 3. Replace color-mix(in oklab/oklch, ...)
  // Iteratively resolve color-mix
  let prev = '';
  while (result !== prev && /color-mix\(/i.test(result)) {
    prev = result;
    result = result.replace(
      /color-mix\(\s*in\s+(?:oklab|oklch|srgb|hsl|lab|lch)[^,]+,\s*([^,]+?)(?:\s+[\d.%]+)?\s*,\s*([^)]+?)(?:\s+[\d.%]+)?\s*\)/gi,
      (_, color1) => {
        const trimmed = color1.trim();
        if (trimmed.startsWith('#') || trimmed.startsWith('rgb')) {
          return trimmed;
        }
        if (trimmed === 'transparent') return 'rgba(0,0,0,0)';
        if (trimmed === 'currentColor') return '#0f172a';
        return '#1e293b';
      }
    );
  }

  // 4. Replace color(display-p3 ...) or color(srgb ...)
  result = result.replace(/color\((?:display-p3|srgb|a98-rgb|prophoto-rgb|rec2020)\s+([-\d.%]+)\s+([-\d.%]+)\s+([-\d.%]+)(?:\s*\/\s*([-\d.%]+))?\)/gi, (_, pr, pg, pb, pa) => {
    try {
      const r = Math.round(parseFloat(pr) * (pr.endsWith('%') ? 2.55 : 255));
      const g = Math.round(parseFloat(pg) * (pg.endsWith('%') ? 2.55 : 255));
      const bVal = Math.round(parseFloat(pb) * (pb.endsWith('%') ? 2.55 : 255));
      const aVal = pa !== undefined ? (pa.endsWith('%') ? parseFloat(pa) / 100 : parseFloat(pa)) : 1;
      return aVal < 1 ? `rgba(${r}, ${g}, ${bVal}, ${aVal})` : `rgb(${r}, ${g}, ${bVal})`;
    } catch {
      return 'rgb(30, 41, 59)';
    }
  });

  // 5. Catch-all fallback for any remaining unsupported color functions
  result = result
    .replace(/oklch\([^)]*\)/gi, 'rgb(30, 41, 59)')
    .replace(/oklab\([^)]*\)/gi, 'rgb(30, 41, 59)')
    .replace(/color-mix\([^)]*\)/gi, 'rgb(30, 41, 59)')
    .replace(/light-dark\(([^,]+),[^)]+\)/gi, '$1');

  return result;
}

/**
 * Traverses cloned document and sanitizes all stylesheets, elements, and computed properties.
 */
export function sanitizeClonedDocForPdf(clonedDoc: Document): void {
  // 1. Sanitize all <style> elements
  const styleEls = clonedDoc.querySelectorAll('style');
  styleEls.forEach((style) => {
    if (style.textContent && /oklab|oklch|color-mix|color\(/i.test(style.textContent)) {
      style.textContent = sanitizeCssColors(style.textContent);
    }
  });

  // 2. Sanitize style sheets rules if accessible
  try {
    Array.from(clonedDoc.styleSheets).forEach((sheet) => {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (rules) {
          Array.from(rules).forEach((rule) => {
            if (rule.cssText && /oklab|oklch|color-mix|color\(/i.test(rule.cssText)) {
              const styleRule = rule as CSSStyleRule;
              if (styleRule.style && styleRule.style.cssText) {
                styleRule.style.cssText = sanitizeCssColors(styleRule.style.cssText);
              }
            }
          });
        }
      } catch {
        // Cross-origin stylesheet access might throw
      }
    });
  } catch {
    // Ignore
  }

  // 3. Sanitize inline and computed styles for all elements
  const allEls = clonedDoc.querySelectorAll('*');
  const colorProps = [
    'color',
    'background-color',
    'border-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'outline-color',
    'fill',
    'stroke',
    'box-shadow',
    'text-shadow'
  ];

  allEls.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.style && htmlEl.style.cssText && /oklab|oklch|color-mix|color\(/i.test(htmlEl.style.cssText)) {
      htmlEl.style.cssText = sanitizeCssColors(htmlEl.style.cssText);
    }

    if (clonedDoc.defaultView) {
      try {
        const computed = clonedDoc.defaultView.getComputedStyle(htmlEl);
        colorProps.forEach((prop) => {
          const val = computed.getPropertyValue(prop);
          if (val && /oklab|oklch|color-mix|color\(/i.test(val)) {
            htmlEl.style.setProperty(prop, sanitizeCssColors(val), 'important');
          }
        });
      } catch {
        // Ignore
      }
    }
  });
}
