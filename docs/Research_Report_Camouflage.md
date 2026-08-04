# Tecniche Algoritmiche di Mimetismo e Camouflage per Arte Generativa
## Dossier per FigJam Board — Studio Rann / Organica

## TL;DR
- Il camouflage algoritmico poggia su un nucleo ristretto di motori matematici riusabili — **reaction-diffusion di Gray-Scott** (macchie/strisce), **rumore Perlin/Simplex multi-ottava (fBm)** (camo militare organico), **diagrammi di Voronoi/Worley** (rottura del contorno) e **neural style transfer di Gatys 2015** — tutti disponibili in librerie open-source mappabili sul vocabolario Organica.
- Il filone artistico-critico (dazzle di **Norman Wilkinson**, 1917; **CV Dazzle / HyperFace / Stealth Wear** di **Adam Harvey**, 2010-2017; **Dazzle Club** di Londra) fornisce a Studio Rann un linguaggio di "disruption visiva" anti-sorveglianza già codificato culturalmente e tecnicamente.
- Per l'output fisico esistono pipeline open-source mature: **Ink/Stitch** e **PEmbroider** (ricamo a densità di stitch variabile), **vpype/vsketch + DrawingBot V3** (plotter hatching), e separazione spot-color via **k-means/median-cut in spazio Lab** — tutte alimentabili direttamente da pattern generativi esportati come raster o SVG.

## Key Findings

1. **I cefalopodi sono il modello biologico di riferimento per un "Flexible Visual System"**: la pelle a tre strati (chromatophores pigmentari neuro-controllati, iridophores strutturali a reflectin, leucophores bianchi) più i papillae texturali è un sistema adattivo in tempo reale — il paradigma ideale per un'identità che si riconfigura sul contesto.
2. **Gray-Scott è il motore unico che genera l'intero spettro Genesis 56-60**: variando solo due parametri (feed *f*, kill *k*) si passa da macchie tipo leopardo a strisce tipo zebra a labirinti tipo cervello di corallo — un singolo algoritmo, infinite varianti contestuali.
3. **Il camo militare digitale (MARPAT/MultiCam) è già arte generativa procedurale**: pixel multi-scala fractal-like e rumore fBm; esistono repository open-source (CAMO di ecsplendid) che lo replicano.
4. **L'asse anti-sorveglianza (Harvey/Dazzle Club) è il ponte naturale con la street art**: camouflage non come occultamento ma come *disruption* del riconoscimento — il tag/drop mark come rottura del contorno percettivo.
5. **La pipeline fisica è risolta**: densità di stitch variabile (Ink/Stitch "color blending"), hatching a campo di flusso (vpype-flow-imager), separazione serigrafica spot via k-means in Lab.

## Details

### 1. PRINCIPI BIOLOGICI DEL CAMOUFLAGE

**Cripsi, mimesi, controshading, disruptive coloration.** La tassonomia classica risale ad Abbott Handerson Thayer, *Concealing-Coloration in the Animal Kingdom* (1909), e a Hugh Cott (*Adaptive Coloration in Animals*, 1940). Thayer formulò il principio del **countershading** (anche "obliterative shading" o "Thayer's Principle"): gli animali sono più scuri sulle superfici più illuminate e più chiari su quelle in ombra, cancellando l'auto-ombreggiatura e appiattendo la forma 3D. Thayer dimostrò il principio nel 1896 davanti all'American Ornithological Union usando modelli/patate dipinti con gradiente invertito. La **disruptive coloration** (chiamata "ruptive" da Thayer) usa invece elementi ad alto contrasto sul bordo del corpo per distruggere la percezione del contorno — la chiave concettuale è che "è il contorno del corpo che permette al ricevente di identificare la presenza di un animale" (Cott 1940). L'**aposematismo** (colorazione di avvertimento, es. salamandre, monarche, skunk) è l'opposto: enfatizza il contorno.

Distinzione operativa fondamentale per Organica:
- **Background matching**: il pattern imita statisticamente lo sfondo.
- **Countershading**: gradiente tonale che annulla il volume.
- **Disruptive patterns**: macchie ad alto contrasto che spezzano la silhouette (il principio del *drop mark* come disruptor).

**Algoritmi biologici dei cefalopodi.** La pelle dei cefalopodi (seppie, polpi, calamari) è il sistema di camouflage dinamico più sofisticato in natura, strutturato in strati:
- **Chromatophores**: organi pigmentari (giallo, rosso, bruno) in tre strati, ognuno un sacculo elastico (cytoelastic sacculus) con granuli di pigmento, espanso/contratto da muscoli innervati direttamente da motoneuroni del cervello → cambio **rapidissimo**. Secondo la review RSC *"From nature's masters of camouflage to engineered optics"* (J. Mater. Chem. C, 2025, DOI:10.1039/D5TC02185E), i cromatofori "can be instantly activated or deactivated within only hundreds of milliseconds" e i cefalopodi "are capable of changing color multiple times within only a few seconds", con espansione del sacculo elastico "up to over 100 times". Octopus cyanea mostra cambi di pattern in fotogrammi a 400 ms di distanza.
- **Iridophores**: cellule riflettenti a colore strutturale; piattaforme ("platelets") della proteina **reflectin** formano riflettori tipo Bragg. Come documenta la stessa review RSC (e il brevetto USPTO 10035175), "reversible phosphorylation of reflectin changes the size and spacing of the lamellae that make up the reflector, dynamically shifting the iridophores' reflectance across the visible spectrum" — il cambio è **lento** (~30 secondi), innescato dall'acetilcolina (ACh) che condensa le reflectine ed espelle acqua, probabilmente controllato da neurormoni più che da innervazione diretta.
- **Leucophores**: strato basale bianco, senza neuroni, diffonde tutte le lunghezze d'onda.
- **Papillae**: deformazioni della pelle a meccanismo idrostatico muscolare (Allen et al. 2013) che cambiano la texture 3D e spezzano il contorno.

Curiosità chiave: i cefalopodi sono quasi tutti **daltonici** (un solo gene opsina), eppure raggiungono color-matching — un paradosso percettivo affascinante per un sistema visivo.

**Pattern di Turing per camouflage.** Alan Turing, "The Chemical Basis of Morphogenesis" (1952), propose che sistemi **reaction-diffusion** activator-inhibitor producano pattern spaziali (Turing patterns). Il modello **Gray-Scott** (Pearson 1993 per la parametrizzazione) usa due morfogeni U e V con equazioni:
- ∂u/∂t = Dᵤ∇²u − uv² + F(1−u)
- ∂v/∂t = Dᵥ∇²v + uv² − (F+k)v

dove F = feed rate, k = kill rate, Dᵤ/Dᵥ = coefficienti di diffusione. Parametri specifici per mimetismo (parametrizzazione di Pearson/Munafo):
- **Macchie / mitosis (leopardo, divisione cellulare)**: f ≈ 0.0367, k ≈ 0.0649 (oppure f=0.034, k=0.064)
- **Cervello di corallo / labirinto**: f ≈ 0.0545–0.055, k ≈ 0.062
- **Strisce (zebra)**: f ≈ 0.032, k ≈ 0.059 (oppure f=0.038, k=0.099)
- **Onde/macchie**: F=0.035, k=0.065 (Pearson 1993)

La finestra di parametri che produce pattern è strettissima — piccolissime variazioni convertono macchie in strisce. **Punto chiave per Genesis 56-60**: un'unica equazione genera leopardo, zebra e pelle-di-polpo solo modulando (f, k). Variare f/k *spazialmente* (gradient di parametri) produce transizioni leopardo→labirinto sulla stessa superficie. La scala del pattern si controlla riscalando i coefficienti di diffusione.

**Motion camouflage.** Strategia in cui il predatore si muove mantenendo un **angolo di rilevamento costante** (constant bearing decreasing range, CBDR) rispetto a un punto di riferimento, così da apparire stazionario alla preda — annullando l'optic flow laterale; l'unico segnale residuo è il "looming" (ingrandimento). Modellata matematicamente per la prima volta da **M. V. Srinivasan e M. Davey (1995)** studiando hoverfly (Eristalis), e osservata nelle libellule (Mizutani et al. 2003, *Hemianax papuensis*). Per Studio Rann: un principio di animazione/motion design — pattern che si muovono senza "sembrare" muoversi.

**Cristalli fotonici nelle ali di farfalla.** Il blu iridescente delle Morpho non è pigmento ma **colore strutturale**: nanostrutture a multistrato (lamellae tipo riflettore di Bragg) sulle scaglie funzionano da cristalli fotonici, riflettendo una banda stretta di lunghezze d'onda (blu ~460 nm in Morpho cypris). Modellabili risolvendo le equazioni di Maxwell con simulatori FDTD. Riferimenti: Kinoshita & Yoshioka, "Physics of structural colors" (Rep. Prog. Phys. 2008); studio su Morpho cypris e Greta oto (Sci. Rep. 2020). Implicazione per Organica: il colore come **fenomeno emergente dalla struttura**, non come fill — coerente con un sistema generativo dove la forma genera il colore.

### 2. ALGORITMI COMPUTAZIONALI DI CAMOUFLAGE

**Texture synthesis classica.**
- **Efros-Leung (1999)**, "Texture Synthesis by Non-parametric Sampling": sintesi pixel-per-pixel da un seed, modello Markov Random Field; per ogni pixel cerca nell'esemplare i vicinati simili e copia il pixel centrale. Lento ma generale. Implementazione di riferimento: people.eecs.berkeley.edu/~efros. Algoritmo greedy che può "scivolare" e generare garbage.
- **Portilla-Simoncelli (2000)**, "A Parametric Texture Model Based on Joint Statistics of Complex Wavelet Coefficients": metodo parametrico iterativo che fa matching delle correlazioni di risposte di filtri wavelet; ottimo per texture a grana fine, può perdere la struttura globale.
- Contesto storico (Princeton COS526): texture stocastiche [Heeger & Bergen '95], [DeBonet '97], [Portilla & Simoncelli '98]; strutturate [Liu '04]; entrambe [Efros & Leung '99, Efros & Freeman '01, Kwatra '05].

**Reaction-diffusion** (vedi sopra, sezione Turing): il motore procedurale centrale.

**Neural texture synthesis: Gatys et al. 2015.** Due paper fondamentali:
- Gatys, Ecker, Bethge, "Texture Synthesis Using Convolutional Neural Networks" (arXiv:1505.07376, NeurIPS 2015): rappresenta la texture tramite **matrici di Gram** (prodotti interni tra canali di feature) calcolate su layer di una VGG-19 pre-addestrata; ottimizza un'immagine di rumore per minimizzare la distanza tra le sue Gram e quelle dell'esemplare.
- Gatys, Ecker, Bethge, "A Neural Algorithm of Artistic Style" (arXiv:1508.06576, 2015) → *style transfer*: aggiunge un content loss al Gram/style loss. Per il camouflage: **trasferire lo "stile" di uno sfondo su una forma** = background matching neurale.
- Miglioramenti: Ulyanov et al. e Johnson et al. (2016) feed-forward veloce; Risser et al. (2017) histogram losses per stabilità (arXiv:1701.08893).

**Procedural camouflage: Perlin/Simplex noise multi-ottava.** Il **fBm (fractal Brownian motion)** — somma di più ottave di noise con ampiezza decrescente e frequenza crescente — è il metodo standard per generare camo woodland/desert/urban. Esempio documentato: il repo **CAMO di ecsplendid** (github.com/ecsplendid/CAMO) genera "MARPAT-style digital camouflage, MultiCam-style organic patterns ... using fractal Brownian motion (fBm) over simplex noise", con doppio strato di noise (primario per la struttura grande, secondario a 2.7× la frequenza per il dettaglio) e quantizzazione del colore in bande discrete; cita il "Dutch NFP fractal method" e il "Project Chameleon algorithm".

**Voronoi-based camouflage.** Diagrammi di Voronoi/Worley (Steven Worley, "A Cellular Texture Basis Function", 1996): celle irregolari che tassellano il piano. Naturalmente presenti nelle macchie della giraffa (cellule che secernono melanina diffondono radialmente). Per il camo: celle irregolari riempite con colori della palette rompono i contorni. Algoritmo di **Lloyd** per Voronoi centroidale (celle ben spaziate); **weighted Voronoi stippling** per densità variabile.

**Adversarial camouflage (AI).** Patches/texture che ingannano sistemi di computer vision:
- Thys, Van Ranst, Goedemé (2019), "Fooling automated surveillance cameras: adversarial patches to attack person detection" — il paper-base sui patch anti-person-detection.
- "Adversarial Patch Camouflage against Aerial Detection" (arXiv:2008.13671): patch contro detector su immagini drone; codice basato sul codebase adversarial-yolo.
- IQT Labs (Adam Van Etten), "The Weaknesses of Adversarial Camouflage in Overhead Imagery" (arXiv:2207.02963), codebase **CAMOLO** (github.com/IQTLabs/camolo): sul dataset VisDrone, con 24 patch sulle classi bus/car/truck/van, trova che i patch sono in media "24% more detectable than the objects the patches were meant to hide. This raises the question of whether such patches truly constitute camouflage."
- FCA (Full-coverage Camouflage Attack, Wang et al. 2022), TACO (Truck Adversarial Camouflage Optimization, arXiv:2410.21443) per texture 3D su veicoli; DAS, "Adversarial Camouflage: Hiding Physical-World Attacks" (Duan et al. 2020).

**Camo militare digitale algoritmico.** MARPAT (Marine Pattern, brevettato USA, sviluppato 2001-2004) e CADPAT canadese: micro-pixel rettangolari multi-scala "fractal-like", basati sulla ricerca di **Timothy O'Neill** (US Army, anni '70). Principio: il pattern fractal (multi-scala) fornisce disruption sia a distanza ravvicinata (texturale) sia a distanza (rottura del contorno). Secondo Wikipedia ("Multi-scale camouflage"), che cita uno studio commissionato dall'US Office of Naval Research, "a target camouflaged with MARPAT takes about 2.5 times longer to detect than older NATO camouflage which worked at only one scale, while recognition... took 20 percent longer" — in pratica circa 2,5 secondi per rilevare MARPAT contro circa 1 secondo per il colore solido/NATO. MultiCam (Crye Precision) usa transizioni di colore organiche regionali. Tecniche: clustering di pixel, decomposizione wavelet, fBm.

**Generazione di pattern animali.** Zebre/leopardi via Gray-Scott (sopra); pelle di polpo via reaction-diffusion + papillae texture; macchie di giraffa via Voronoi; tutti replicabili proceduralmente.

### 3. OPEN SOURCE TOOLS

**p5.js / Processing — reaction-diffusion.**
- **Daniel Shiffman, "Coding Challenge #13: Reaction Diffusion"** (The Coding Train) — implementazione Gray-Scott in p5.js e Processing, repo GitHub con codice sorgente.
- **jasonwebb/reaction-diffusion-playground** (GitHub + GitHub Pages): simulazione interattiva WebGL con shader GLSL, tecnica "ping-pong" tra render target, mappa dello spazio parametri (f/k) navigabile.
- **pmneila/jsexp** (Gray-Scott in JS, pmneila.github.io/jsexp/grayscott) — demo interattiva classica.
- **MStrandh/gray_scott_reaction_diffusion** (Processing).
- **jasonwebb/morphogenesis-resources** — repository-indice fondamentale su digital morphogenesis (reaction-diffusion, space colonization, differential growth, ecc.).

**GLSL shader per camouflage real-time.**
- **amandaghassaei/ReactionDiffusionShader** (WebGL, F=0.0545 K=0.062, con campo vettoriale per diffusione orientata).
- **thebookofshaders.com** (Patricio Gonzalez Vivo) — capitoli 11-13 su noise, cellular noise (Worley), fBm: la risorsa didattica di riferimento per shader procedurali.
- **ashima/webgl-noise** (Stefan Gustavson et al., "Efficient computational noise in GLSL", arXiv:1204.1461) — simplex noise GLSL standard.
- Shadertoy come repository di shader procedurali (mainImage/fragCoord; uniforms iTime/iResolution).

**Python + OpenCV: texture analysis/synthesis.** OpenCV per analisi di texture (GLCM, filtri di Gabor), color quantization (k-means via `cv2.kmeans`), e pipeline di sintesi. Implementazioni di Efros-Leung e Portilla-Simoncelli disponibili (es. IPOL, ipol.im/pub/art/2013/59 con codice di riferimento Efros-Leung).

**Blender procedural nodes.** Shader/geometry nodes con Noise Texture (Perlin), Voronoi Texture, Musgrave/fBm, Wave Texture, ColorRamp per quantizzare in bande di camo — workflow procedurale non distruttivo per texture mimetiche. *(Nota: il workflow standard combina più Noise/Voronoi node con Mix e ColorRamp; da consolidare con la documentazione ufficiale Blender prima dell'adozione.)*

**Repository GitHub rilevanti per camouflage:**
- **ecsplendid/CAMO** — generatore procedurale MARPAT/MultiCam (fBm + simplex), web app + plugin DaVinci Resolve Fusion.
- **lizzthabet/speculative-camouflage** — generatore di pattern camouflage "indossabili" da foto di ambienti, tecniche multi-scala e shape-disruptive, basato su un paper scientifico del 2013; usa Voronoi (riempie ogni cella con gradiente da palette dell'immagine sorgente).
- **IQTLabs/camolo** — adversarial camouflage.
- **jasonwebb/reaction-diffusion-playground**, **morphogenesis-resources**.

### 4. ARTISTI E RIFERIMENTI

**Adam Harvey** (artista/ricercatore, NYU ITP). Tre progetti centrali:
- **CV Dazzle** (2010, tesi di master a NYU ITP): camouflage *dalla computer vision*, non dall'occhio umano. Usa makeup e acconciature ad alto contrasto per rompere i tratti attesi dei profili di face-detection (haarcascades). Dal sito dell'autore (adam.harvey.studio/cvdazzle): "It is the first documented camouflage technique to successfully attack a computer vision algorithm... used to break the widely-used (at the time) Viola-Jones face detection algorithm". L'algoritmo Viola-Jones "gradually become deprecated in security around 2013-2016", quindi i look originali non sono più attivi contro i CNN moderni. Toolkit open-source.
- **HyperFace** (2017, con Hyphen-Labs): prototipo (Version 1) sviluppato per il progetto NeuroSpeculative AfroFeminism di Hyphen-Labs, "debuted at the Sundance Film Festival in 2017" (collaborazione con Ashley Baccus-Clark, Carmen Aguilar y Wedge, Ece Tankal, Nitzan Bartov, JB Rubinovitz). Logica inversa rispetto a CV Dazzle: invece di minimizzare il confidence score del volto vero (figura), offre **false facce** ad alto confidence nello sfondo (ground), sfruttando la preferenza dell'algoritmo per la regione facciale a confidenza più alta. "if a computer vision algorithm is expecting a face, give it what it wants." Il prototipo targetizzava OpenCV frontalface; altri pattern possono colpire CNN o detector HoG/SVM.
- **Stealth Wear** (con Hyphen-Labs): abbigliamento ispirato all'abito islamico, tessuto placcato argento che riflette la radiazione termica per eludere la sorveglianza termica dei droni.

**Dazzle camouflage WWI — Norman Wilkinson.** Lieutenant-commander della Royal Naval Volunteer Reserve e pittore marino, propose nel 1917 di **non nascondere** le navi ma renderle illeggibili: pattern geometrici ad alto contrasto (strisce, zigzag, curve) per distorcere la percezione di rotta, velocità e distanza viste dal periscopio di un U-boat, impedendo la soluzione di tiro del siluro. Prima nave: SS Industry. Secondo Wikipedia ("Dazzle camouflage"), "over 4000 British merchant ships were painted" e "dazzle was also applied to some 400 naval vessels, starting in August 1917"; per la US Navy, i dati di Harold Van Buskirk (1919) indicano "about 1,256 ships were painted in dazzle between 1 March 1918 and the end of the war." Ogni pattern era unico per non rendere riconoscibili le classi. Rivendicazione precedente respinta dello zoologo John Graham Kerr. Efficacia storicamente dibattuta (Behrens "Camoupedia"; Forbes, *Dazzled and Deceived*, 2009). Demo celebre: il modellino mostrato a re Giorgio V che sbagliò la rotta stimata.

**Disruptive coloration nel fashion/streetwear.** La linea dazzle→camo è diventata motivo estetico ricorrente; brand e designer usano il camo sia come mimetismo urbano ("concrete jungle", blotch graffiti-like) sia, in chiave anti-sorveglianza, come pattern che sovraccaricano il riconoscimento facciale (pattern tipo HyperFace stampati su tessuto).

**Artisti generativi con pattern organici.** **Mark J. Stock** (diffusion-limited aggregation, off-lattice DLA per strutture ramificate organiche); la tradizione reaction-diffusion/morphogenesis nel creative coding (Jason Webb); L-systems per crescita vegetale; Boids/flocking (Reynolds 1987). Philip Galanter (self-organized drawing, sistemi complessi).

**Camouflage come linguaggio della street art.** Il **Dazzle Club** (Londra, fondato dopo la lettera del sindaco Khan ad Argent del 2019 sul riconoscimento facciale a King's Cross): collettivo di artiste che usa face-paint anti-riconoscimento (CV Dazzle) e camminate silenziose coreografate per esplorare sorveglianza e spazio pubblico. **Leo Selvaggio** (maschere 3D del proprio volto come "personal surveillance identity prosthetics"). **Zach Blas** (*Facial Weaponization Suite*: maschere che fondono tratti facciali multipli per rompere la biometria). Connessione concettuale per Organica: il **tag/drop mark come disruption visiva**, rottura del contorno percettivo nello spazio urbano — camouflage non come occultamento ma come affermazione di presenza che disturba il sistema di lettura.

### 5. CONNESSIONE ORGANICA / STUDIO RANN

**Pattern camouflage organici come nuove forme Genesis (56-60).** Il sistema Gray-Scott offre una genealogia di forme da un singolo motore: macchie (leopardo) → strisce (zebra) → labirinti (corallo/polpo) modulando (f, k). Ogni "Genesis" può essere definita come un punto/regione nello spazio parametri di Pearson. La pelle del cefalopode — tre strati + papillae — è il modello concettuale di un sistema a strati sovrapposti (pigmento neuro-rapido + struttura lenta + base diffondente + texture).

**Drop mark + camouflage.** Il gesto fondamentale di Organica (il drop mark) si connette ai pattern mimetici via **disruptive coloration**: il drop mark ad alto contrasto è esattamente l'elemento di bordo che, nella teoria di Thayer/Cott, rompe la percezione del contorno. Il drop mark come "macchia disruptive" che, ripetuta proceduralmente (Voronoi seeding, reaction-diffusion spotting), genera un campo mimetico coerente.

**Camouflage come Flexible Visual System.** Il principio cefalopode = identità che si riconfigura sul contesto in tempo reale. Implementazione: un set di motori (Gray-Scott, fBm, Voronoi) parametrizzati che generano pattern adattati al "background" del brief (ambiente, supporto, scala). Background matching neurale (style transfer di Gatys) per adattare lo "stile" del pattern allo sfondo specifico di un'applicazione.

**Branding generativo con camouflage.** Identità contestuale: lo stesso seed genera pattern diversi per contesti diversi (packaging adattivo che cambia densità/colore secondo il prodotto). Il camo militare digitale dimostra che un pattern algoritmico può essere sistematico e riconoscibile pur essendo sempre diverso — esattamente il requisito di un sistema di branding flessibile.

**Output fisici (pipeline open-source verificate).**

*Ricamo a densità di stitch variabile:*
- **Ink/Stitch** (estensione Inkscape open-source, inkstitch.org / github.com/inkstitch/inkstitch): rende gradienti via **"color blending"** con row spacing variabile. "Setting End row spacing parameter allows for a varying row spacing fill ... the row spacing starts at spacing between rows value and ends up at end row spacing value, varying linearly in between." Strumento "Density Map" che codifica a colori la densità (rosso/giallo/verde) per segnalare zone troppo dense. Un pattern Turing in scala di grigi → fill density-mapped.
- **PEmbroider** (libreria Processing, github.com/CreativeInquiry/PEmbroider, di **Golan Levin** / STUDIO for Creative Inquiry, CMU): ricamo generativo via codice, con **algoritmi multipli di hatching** per rendere tono/densità e ottimizzazione del percorso via TSP modificato (`optimize()`). Output .DST/.EXP/.PES/.PEC ecc. *(Nota: PEmbroider è di Golan Levin, non Liza Daly come a volte attribuito; licenza dual GPLv3 + Anti-Capitalist Software License — verificare prima dell'uso commerciale.)*
- **TurtleStitch** (turtlestitch.org, basato su Snap!, di Andrea Mayr-Stalder e Michael Aschauer): il percorso turtle diventa percorso di stitch; ideale per pattern algoritmici a linea continua.

*Serigrafia spot multi-layer:*
- Separazione in spot color via **posterize** (toni piatti, per loghi/grafica solida) o **k-means clustering** (colori rappresentativi, per artwork fotografico/complesso).
- **Reveal** (open-source JS, github.com/electrosaur-labs/reveal): pipeline esplicita Median Cut in Lab → raffinamento centroidi k-means → mapping nearest-neighbor → trapping di produzione. Opera nello spazio L\*a\*b\*. *(Nota: progetto nuovo v1.0.0 (2026), single-developer — promettente ma non ancora standard consolidato.)*
- Industria: Separation Studio, T-Seps, UltraSeps; open-source Scribus (separazioni/spot/ICC). Grounding accademico: Celebi, "Forty years of color quantization" (Artificial Intelligence Review, 2023).

*Plotter hatching:*
- **vpype** (github.com/abey79/vpype, MIT): "Swiss-Army-knife" CLI per vector graphics da plotter; pipeline `linemerge/linesort/linesimplify` per ottimizzare il percorso pen-up.
- **vpype-flow-imager** (github.com/serycjon/vpype-flow-imager): immagini → line-art a **campo di flusso** con streamline equispaziate (algoritmo **Jobard & Lefer**, "Creating evenly-spaced streamlines of arbitrary density"); densità variabile col tono (più scuro = più linee); supporta cross-hatching e separazione CMYK.
- **vsketch** (github.com/abey79/vsketch): framework generativo Processing-like sopra vpype.
- **DrawingBot V3** (github.com/SonarSonic/DrawingBotV3, free open-source): moduli Path Finding (PFM) — Sketch, **Voronoi**, **TSP** (linea continua singola), **LBG** (Linde-Buzo-Gray); "squiggle" = percorso continuo senza pen-lift; densità controllata dall'accumulo di linee nelle zone scure; "Directionality" che forza le linee a seguire i contorni dell'immagine (direzione di minima varianza).
- **AxiDraw / EggBot "Hatch Fill"** (github.com/evil-mad/axidraw, eggbot_hatch.py): riempimento a tratteggio con regola odd/even di intersezione poligono. **StippleGen** (Evil Mad Scientist): weighted Voronoi stippling. **TSP art**: stipple → percorso traveling-salesman.

## Recommendations

**Fase 1 — Prototipazione del motore Genesis (settimane 1-2).** Implementare un singolo notebook/sketch che espone lo spazio parametri Gray-Scott (f, k) con la mappa di Pearson navigabile, partendo da **jasonwebb/reaction-diffusion-playground** (GLSL real-time) o dal Coding Challenge #13 di Shiffman (p5.js, più facile da modificare). Definire Genesis 56-60 come 5 coordinate fisse + regole di gradient spaziale (f/k variabili sullo spazio per transizioni leopardo→labirinto). *Benchmark di passaggio*: capacità di generare on-demand macchie, strisce e labirinti da un unico codice variando solo 2 numeri.

**Fase 2 — Sistema multi-motore + drop mark (settimane 3-4).** Aggiungere un layer fBm (simplex multi-ottava, da ashima/webgl-noise o thebookofshaders cap. 11-13) e un layer Voronoi/Worley (seeding dei drop mark). Architettura a tre strati ispirata al cefalopode: (1) campo strutturale lento = fBm, (2) macchie neuro-rapide = reaction-diffusion seedata sui drop mark, (3) base/leucophore = colore di fondo. *Benchmark*: il drop mark deve funzionare sia come seed del pattern sia come elemento disruptive ad alto contrasto sul bordo.

**Fase 3 — Adattività contestuale (settimane 5-6).** Integrare background matching: estrarre la palette/statistiche di un contesto (foto ambiente, supporto packaging) e pilotare la quantizzazione del colore del pattern, modello **lizzthabet/speculative-camouflage**. Opzionale avanzato: style transfer di Gatys (VGG-19 Gram matrices) per adattare lo "stile" del pattern. *Benchmark*: stesso seed → pattern visivamente coerente ma adattato a 3 contesti diversi.

**Fase 4 — Output fisico (parallelo, dalla settimana 4).** Tre binari paralleli: (a) **ricamo** via Ink/Stitch (esportare il pattern come raster grayscale → density-mapped fill) o PEmbroider per controllo via codice; (b) **plotter** via vpype + vpype-flow-imager (campo di flusso che segue la direzione del pattern) o DrawingBot V3 (Voronoi/TSP); (c) **serigrafia** via separazione k-means/posterize in Lab (Reveal o workflow Scribus/Photoshop), 3-5 spot color. *Benchmark*: un singolo artwork Genesis prodotto in tutti e tre i media mantenendo identità riconoscibile.

**Posizionamento concettuale.** Adottare esplicitamente il frame **anti-sorveglianza/disruption** (Wilkinson → Harvey → Dazzle Club) come narrazione di Organica: il camouflage non come occultamento ma come *linguaggio di rottura del contorno* — il drop mark come tag urbano che disturba il sistema di lettura. Questo collega street art, biomimetica e arte generativa in un'unica tesi.

## Caveats
- **Efficacia ≠ estetica.** Gran parte di questi sistemi (dazzle WWI, adversarial patches, anti-surveillance makeup) hanno efficacia *funzionale* dibattuta o smentita: lo studio IQT Labs trova i patch adversarial il 24% più rilevabili degli oggetti che nascondono; l'efficacia del dazzle WWI non è mai stata provata (il calo delle perdite del 1918 è generalmente attribuito ai convogli, non al dazzle); CV Dazzle rompeva Viola-Jones, deprecato dal ~2013-2016 (i CNN moderni richiedono look aggiornati). Per Studio Rann il valore è **estetico/concettuale**, non di reale evasione — da comunicare onestamente.
- **Parametri Gray-Scott sensibili.** I valori (f, k) citati producono i pattern indicati solo entro tolleranze strette e dipendono da dt, dx e dai coefficienti di diffusione dell'implementazione; vanno ri-tarati per ogni codice. Le fonti concordano su mitosis (~0.0367/0.0649) e corallo (~0.055/0.062) ma le coordinate "strisce" variano tra le fonti.
- **Daltonismo cefalopode** = meccanismo di color-matching ancora non pienamente spiegato scientificamente; usarlo come metafora, non come fatto risolto.
- **Reveal** (serigrafia): tool open-source nuovissimo (v1.0.0, 2026) e non testato su larga scala; per produzione affidarsi a workflow consolidati (Separation Studio/Scribus) e trattare Reveal come sperimentale.
- **Blender procedural camo**: il workflow node-based è standard ma manca una singola fonte/tutorial canonico in questa ricerca — da approfondire con la documentazione ufficiale Blender prima dell'adozione.
- **Adversarial camouflage** opera contro modelli specifici e si trasferisce male tra detector diversi (overfitting al modello target) — non è camouflage universale.
