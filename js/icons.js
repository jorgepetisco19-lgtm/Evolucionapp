// Iconos de línea (SVG en línea). Heredan el color del texto.
const svg = (inner, size = 24) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const ICONS = {
  home: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  body: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M7.5 10a4.5 4.5 0 0 1 9 0M12 10l2.2-2.4"/>'),
  photos: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  food: svg('<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 3c-2.2 1.8-3 4.6-3 8h3v10"/>'),
  sport: svg('<path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 20),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 20),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 18),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>', 18),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>', 20),
  compare: svg('<rect x="3" y="4" width="8" height="16" rx="2"/><rect x="13" y="4" width="8" height="16" rx="2"/>', 20),
  google:
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.4z"/><path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A11.5 11.5 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.6 14.7a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.5 11.5 0 0 0 1.8 7.3l3.8 3C6.5 6.8 9 4.8 12 4.8z"/></svg>',
};

export const LOGO = `<svg viewBox="282 48 446 446" width="48" height="48" aria-hidden="true">
  <g fill="none" stroke-width="22" stroke-linecap="butt">
    <path d="M478 73 A193 193 0 0 0 338 362" stroke="#1e88ff"/>
    <path d="M524 73 A193 193 0 0 1 684 224" stroke="#ffb300"/>
    <path d="M692 255 A193 193 0 0 1 636 398" stroke="#43a047"/>
  </g>
  <circle cx="503" cy="160" r="33" fill="var(--logo-ink,#4a5163)"/>
  <polygon points="383,173 505,235 617,173 508,288" fill="var(--logo-ink,#3a4254)" stroke="var(--logo-ink,#3a4254)" stroke-width="6" stroke-linejoin="round"/>
  <path d="M385 372 Q405 362 425 366 L425 440 Q405 432 392 418 Q384 396 385 372Z" fill="#1e88ff"/>
  <path d="M445 336 Q465 326 487 332 L487 458 Q465 462 445 450Z" fill="#43a047"/>
  <path d="M506 296 Q528 284 550 290 L550 456 Q528 462 506 458Z" fill="#ffb300"/>
  <path d="M572 244 Q594 232 617 238 L617 432 Q594 444 572 448Z" fill="#ff7a1a"/>
</svg>`;
