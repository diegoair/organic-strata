/* collections.js — TuneSutra's built-in palette collections, as data.
   window.TUNESUTRA_COLLECTIONS = [{ id, name, note, view, palettes: [{ id, name, colors }] }]
   A built-in palette is read-only: opening one loads a copy into the editor,
   and Save stores that copy with the user's own palettes.

   `colors` are in TuneSutra's role order — Base, Secondary, Accent, Accent 2.
   For a garment study that is body, hem, collar, trim (the source lists the
   collar first; a three-colour study has no trim colour of its own).
   `view` is the example the editor opens on.

   garment-violet — transcribed (Oct 1, 2026) from a photographed page of a
   colour-scheme book Diego supplied: 12 three-colour garment studies around
   violet, RGB values as printed. The three named ones carry the page's own
   captions, translated. Two values were hard to read in the photo and should
   be checked against the page: violet-01's accent (186-186-186) and
   violet-05's secondary (248-117-157).

   garment-green — same book, a second photographed page (Oct 1, 2026): 12
   four-colour studies around green. To check against the page: green-04's
   body (read as 116-139-116) and trim (read as 179-204-236; the last number
   was unclear — 236 matches the swatch and the printed CMYK 35-15-0-0). */
window.TUNESUTRA_COLLECTIONS = [
  {
    id: 'garment-violet',
    name: 'Garment studies — violet',
    note: 'Twelve three-colour studies. Body, hem, collar.',
    view: 'garment',
    palettes: [
      { id: 'violet-01', name: 'Violet 01', colors: ['#000000', '#5f238d', '#bababa'] },
      { id: 'violet-02', name: 'Violet 02', colors: ['#6a3387', '#b189c1', '#fbaec1'] },
      { id: 'violet-03', name: 'Violet 03', colors: ['#cfb3d7', '#797b83', '#b189c1'] },
      { id: 'violet-04', name: 'Violet 04', colors: ['#a6b5b7', '#ead8e3', '#bfe6c8'] },
      { id: 'violet-05', name: 'Violet 05', colors: ['#ead8e3', '#f8759d', '#cfb3d7'] },
      { id: 'violet-06', name: 'Violet 06', colors: ['#fba79d', '#cfb3d7', '#f9dfe2'] },
      { id: 'violet-07', name: 'Violet 07', colors: ['#ead8e3', '#ccece8', '#fffab8'] },
      { id: 'violet-08', name: 'Violet 08', colors: ['#ca8290', '#ead8e3', '#cfb3d7'] },
      { id: 'violet-09', name: 'Violet 09', colors: ['#f2f2f2', '#cfb3d7', '#a6b5b7'] },
      { id: 'stimulating', name: 'Stimulating', colors: ['#5f238d', '#74c476', '#d40039'] },
      { id: 'luxurious', name: 'Luxurious', colors: ['#5f238d', '#000000', '#ff7f00'] },
      { id: 'graceful', name: 'Graceful', colors: ['#ca8290', '#6a3387', '#ead8e3'] },
    ],
  },
  {
    id: 'garment-green',
    name: 'Garment studies — green',
    note: 'Twelve four-colour studies. Body, hem, collar, trim.',
    view: 'garment',
    palettes: [
      { id: 'green-01', name: 'Green 01', colors: ['#119352', '#0e3915', '#c0e6b8', '#99c197'] },
      { id: 'green-02', name: 'Green 02', colors: ['#74c476', '#fff200', '#ffffff', '#addb5d'] },
      { id: 'green-03', name: 'Green 03', colors: ['#73b81d', '#e31a2a', '#fff200', '#67c3b7'] },
      { id: 'green-04', name: 'Green 04', colors: ['#748b74', '#c0e6b8', '#90c19c', '#b3ccec'] },
      { id: 'green-05', name: 'Green 05', colors: ['#c0e6b8', '#dedede', '#f9dfe2', '#fff27c'] },
      { id: 'green-06', name: 'Green 06', colors: ['#c0e6b8', '#ffffff', '#8cc919', '#333333'] },
      { id: 'green-07', name: 'Green 07', colors: ['#c0e6b8', '#333333', '#fff23f', '#dedede'] },
      { id: 'green-08', name: 'Green 08', colors: ['#bfa90b', '#c0e6b8', '#e6f5a4', '#d0c28e'] },
      { id: 'green-09', name: 'Green 09', colors: ['#c0e6b8', '#fdd9cd', '#fbaec1', '#cfb3d7'] },
      { id: 'lively', name: 'Lively', colors: ['#119352', '#ff7f00', '#d40039', '#fff23f'] },
      { id: 'dynamic', name: 'Dynamic', colors: ['#000000', '#119352', '#fff200', '#e5000d'] },
      { id: 'youth', name: 'Youth', colors: ['#349c53', '#395999', '#fff27c', '#ffffff'] },
    ],
  },
];
