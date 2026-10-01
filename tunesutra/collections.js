/* collections.js — TuneSutra's built-in palette collections, as data.
   window.TUNESUTRA_COLLECTIONS = [{ id, name, note, view, palettes: [{ id, name, colors }] }]
   A built-in palette is read-only: opening one loads a copy into the editor,
   and Save stores that copy with the user's own palettes.

   `colors` are in TuneSutra's role order — Base, Secondary, Accent. For a
   garment study that is body, hem, collar (the source lists collar first).
   `view` is the example the editor opens on.

   garment-violet — transcribed (Oct 1, 2026) from a photographed page of a
   colour-scheme book Diego supplied: 12 three-colour garment studies around
   violet, RGB values as printed. The three named ones carry the page's own
   captions, translated. Two values were hard to read in the photo and should
   be checked against the page: violet-01's accent (186-186-186) and
   violet-05's secondary (248-117-157). */
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
];
