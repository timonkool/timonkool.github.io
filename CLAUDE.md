# CLAUDE.md — timonkool.nl

Dit document is de werkinstructie voor Claude Code bij het onderhouden en uitbreiden van timonkool.nl. Lees dit document volledig voor je een taak uitvoert. Sla geen secties over.

---

## 1. Projectoverzicht

**Eigenaar:** Timon Kool  
**Doel:** Persoonlijke portfolio- en landingspagina gericht op potentiële werkgevers en recruiters.  
**Tech stack:** Puur HTML, CSS en JavaScript. Geen frameworks, geen build tools, geen package managers.  
**Hosting:** GitHub Pages, gelinkt aan timonkool.nl via DNS bij TransIP.  
**Branch:** Alles wordt direct naar `main` gepusht. Er zijn geen feature branches.

---

## 2. Mappenstructuur

Houd je strikt aan deze structuur. Maak geen nieuwe mappen aan zonder expliciete goedkeuring.

```
/
├── index.html              # Homepage (landingspagina)
├── CLAUDE.md               # Dit document
├── assets/
│   ├── css/                # Gedeelde stylesheets
│   ├── js/                 # Gedeelde scripts
│   └── images/             # Afbeeldingen en iconen
├── pages/
│   ├── cv.html             # Visuele CV-pagina
│   └── portfolio/          # Losse pagina per portfolio-item
│       └── [item-naam].html
└── docs/                   # Downloadbare bestanden
    └── cv-timon-kool.pdf
```

### Naamgevingsconventie

- Alle bestandsnamen in **lowercase**, woorden gescheiden door koppelteken: `mijn-bestand.html`
- Geen spaties, underscores of hoofdletters in bestandsnamen
- HTML-pagina's beschrijven wat ze tonen: `cv.html`, `handboek-ai-cowork.html`
- Afbeeldingen beschrijven hun inhoud: `profielfoto-timon.jpg`, `screenshot-handboek.png`

---

## 3. Wat je zelfstandig mag doen

De volgende taken voer je uit zonder eerst te vragen:

- Spelfouten en interpunctiefouten corrigeren
- Kleine tekstaanpassingen die aansluiting verbeteren tussen bestaande alinea's
- Bugfixes: kapotte links, ontbrekende sluit-tags, CSS die breekt op een specifieke schermgrootte
- Stijlaanpassingen die direct voortvloeien uit een gevraagde wijziging, zoals een kleur aanpassen nadat een nieuw element is toegevoegd

## 4. Wat je altijd eerst moet voorleggen

Leg de volgende zaken altijd voor met een korte toelichting en wacht op goedkeuring:

- Nieuwe secties of pagina's toevoegen
- Bestaande secties of content verwijderen
- Wijzigingen in de navigatiestructuur
- Grote stijlaanpassingen die meerdere elementen raken
- Nieuwe thema's of onderwerpen introduceren die nog niet op de site staan
- Wijzigingen in de meertalige structuur (data-attributen, taallogica)
- Alles wat de mappenstructuur of naamgevingsconventie doorbreekt

Bij twijfel: voorleggen, niet zelf beslissen.

---

## 5. Veiligheid en privacy

Dit zijn harde regels zonder uitzonderingen:

- **Nooit** een API-sleutel, wachtwoord, token of geheim in de code plaatsen, ook niet tijdelijk of als placeholder
- **Nooit** een e-mailadres of telefoonnummer van Timon direct in de HTML zetten. Contact verloopt via het Formspree-formulier
- **Nooit** persoonsgegevens van derden in de code opnemen
- De Formspree-endpoint (`https://formspree.io/f/xojbeokz`) mag in de code staan, dit is een publiek formulier-endpoint en geen privé sleutel. Vervang hem niet tenzij Timon dit aangeeft.

---

## 6. Visuele stijlgids

De volledige stijlgids staat in `stijlgids_zacht_groen.md`. De kernregels zijn hieronder samengevat. Bij conflict tussen dit document en de stijlgids: volg de stijlgids.

### Kleurpalet

| Variabele | Hex | Gebruik |
|-----------|-----|---------|
| `--sage-deep` | `#6b8068` | Hoofdkleur, knoppen, accenten |
| `--sage-ink` | `#3a4a38` | Koppen, donkere tekst |
| `--cream` | `#faf8f4` | Hoofdachtergrond |
| `--sage` | `#8ba287` | Lichte accenten, lijnen |
| `--sage-soft` | `#c8d4c4` | Borders, decoratie |
| `--sage-mist` | `#eef2ec` | Card-achtergronden |
| `--text` | `#2d352c` | Body-tekst |
| `--muted` | `#6b7268` | Secundaire tekst |

**Regels:**
- Geen andere kleuren introduceren, geen rood, blauw, geel of oranje
- Geen gradiënten
- Groen vlak heeft altijd cream of paper als tekstkleur
- Cream vlak heeft `--sage-ink` als koptekst

### Typografie

- **Hoofdlettertype:** Quicksand (Google Fonts), gewichten 300/400/500/600/700
- **Accent:** Fraunces italic 300, alleen voor lead-citaten
- **Mail-fallback:** `'Trebuchet MS', Verdana, Arial, sans-serif`
- Labels en tags altijd in UPPERCASE met `letter-spacing: 2-3px`
- Geen underlines onder koppen

### Vormgeving

- Border-radius: `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 12px`, `--radius-pill: 999px`
- Schaduw maximaal: `box-shadow: 0 4px 24px rgba(0,0,0,0.06)`
- Lead-tekst: `border-left: 3px solid #6b8068; padding-left: 14px`
- Geen harde drop-shadows, geen scherpe hoeken (`border-radius: 0`)

### Signature kleurwissel-kop

De hero-koptekst gebruikt een clip-path techniek waarbij dezelfde tekst twee keer gerenderd wordt: één keer in cream (zichtbaar op het groene vlak) en één keer in sage-deep (zichtbaar op het cream vlak). De overlappende clip-zone van 4% (48-52%) creëert de zachte overgang.

Verhoudingen bij wijziging van font-size:
- `title-zone height` = font-size
- `margin-top` = -(2/3 × font-size)
- Clip wit: `inset(0 0 48% 0)`
- Clip groen: `inset(52% 0 0 0)`
- Altijd `line-height: 1` op deze kop

---

## 7. Meertaligheid

De site ondersteunt Nederlands en Engels via een taalwissel op dezelfde pagina. Gebruik hiervoor data-attributen.

### Werkwijze

Elke tekst die vertaald moet worden krijgt beide talen als data-attribuut:

```html
<p data-nl="Dit is de Nederlandse tekst." data-en="This is the English text."></p>
```

De actieve taal wordt ingesteld via JavaScript dat alle elementen met `data-nl` en `data-en` bijwerkt op basis van de geselecteerde taal. De taalvoorkeur wordt opgeslagen in `localStorage`.

### Regels

- Voeg nooit alleen een Nederlandse of alleen een Engelse tekst toe. Altijd beide.
- Claude Code vertaalt geen teksten zelfstandig. Nieuwe content wordt aangeleverd door Timon in beide talen, of Timon keurt een vertaalvoorstel goed voor het live gaat.
- De taalwisselknop staat in de navigatie, rechts van de nav-links.

---

## 8. Schrijfstijl

De volledige schrijfstijlinstructie staat in `schrijfstijl_instructie.md`. Onderstaande regels zijn absoluut en gelden voor alle tekst op de site.

### Verboden

- **Nooit de em-dash (—)** gebruiken. Vervang altijd door een komma, puntkomma, dubbele punt, of herschrijf de zin.
- **Nooit een horizontale lijn (`---`)** als scheidingselement in de zichtbare pagina.
- Geen AI-achtige openers zoals "Zeker!", "Absoluut!", "Geweldig!", "Natuurlijk!"
- Geen overdreven beleefdheidsformules of aanloopzinnen
- Geen ellenlange alinea's zonder witruimte

### Toon

- Direct, proactief, transparant
- Zakelijk maar menselijk, nooit houtérig
- Assertief zonder arrogant te zijn
- Korte zinnen, één punt per alinea

---

## 9. Pagina-overzicht en status

| Pagina | Bestand | Status |
|--------|---------|--------|
| Homepage | `index.html` | Live |
| CV (visueel) | `pages/cv.html` | Live |
| CV (download) | `docs/cv-timon-kool.pdf` | Live |
| Handboek AI & Cowork | `pages/portfolio/handboek-ai-cowork.html` | Live |
| Basistraining AI voor stichtingen | `pages/portfolio/basistraining-ai.html` | Live |

Houd dit overzicht actueel bij elke wijziging.

---

## 10. Veelgemaakte fouten om te vermijden

- De kleurwissel-kop breekt als `line-height` niet op `1` staat. Controleer dit altijd.
- De `CNAME`-bestand in de root mag nooit verwijderd of aangepast worden. Dit koppelt het domein.
- Inline styles alleen als tijdelijke oplossing. Structurele stijlen horen in de stylesheet.
- Geen `<form>`-tags met directe e-mailverwijzingen. Altijd via Formspree.
- Bij toevoegen van een nieuw portfolio-item: ook de portfoliokaart op `index.html` bijwerken.
- Bij elke wijziging in `assets/css/saliegroen.css`: werk de versieparameter `?v=JJJJ-MM-DD` bij in **alle** HTML-pagina's die de stylesheet inladen. GitHub Pages serveert met `max-age=600`, dus zonder nieuwe URL combineert de browser nieuwe HTML met een oude stylesheet en valt de opmaak weg. Controleer met `grep -rn "saliegroen.css" --include=*.html .` of je geen pagina mist.

---

## 11. Werkwijze bij een taak

Volg bij elke taak deze volgorde:

1. Lees de taakomschrijving volledig
2. Controleer of de taak onder "zelfstandig uitvoeren" of "voorleggen" valt (secties 3 en 4)
3. Identificeer welke bestanden geraakt worden
4. Voer de wijziging uit conform de stijlgids en naamgevingsconventie
5. Controleer of beide taalversies bijgewerkt zijn
6. Controleer of er geen e-mailadressen, telefoonnummers of API-sleutels in de code zijn terechtgekomen
7. Geef een beknopte samenvatting van wat je hebt gedaan en waarom

---

*Laatste update: mei 2026*
