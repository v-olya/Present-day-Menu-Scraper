import { type MenuType } from "./types";

export enum ERROR_MESSAGES {
  UNREACHABLE_URL = "Uvedená URL adresa není platná",
  NAVIGATION_FAILED = "Nepodařilo se načíst cílovou stránku",
  EXTRACTION_FAILED = "Nepodařilo se extrahovat obsah stránky",
  CACHED_DATE_MISMATCH = "Datum neodpovídá dnešnímu dni",
  NO_MENU_ITEMS = "Žádné položky menu",
  FAILED_PROCESS_MENU_AI = "Nepodařilo se zpracovat menu pomocí AI",
  AI_SCHEMA_VALIDATION_FAILED = "AI výstup neodpovídá očekávanému formátu",
  AI_RESPONSE_NOT_JSON = "AI odpověď není validní JSON",
  FAILED_EXTRACT_MENU = "Nepodařilo se extrahovat menu z obsahu",
  UNKNOWN_ERROR = "Neznámá chyba",
  UNEXPECTED_ERROR = "Došlo k neočekávané chybě. Zkuste to znovu nebo vraťte se zpět",
}

export enum REASON {
  DATE_MISMATCH = "Detekováno denní nabídku, ale datum neodpovídá dnešnímu dni",
  RANGE_MISMATCH = "Detekované rozmezí neobsahuje dnešní datum",
  MULTIPLE_OFFERS_NO_MATCH = "Detekováno více nabídek, ale žádná neodpovídá dnešnímu dni",
  MULTIPLE_INTERVALS_NO_MATCH = "Detekováno více časových rozmezí, ale žádné neobsahuje dnešní datum",
}

export const restaurantURLs = [
  "https://www.restauracehybernska.cz/", // menu on homepage
  "https://www.peklo-ostrava.cz/denni-menu/", // non-existent
  "https://www.restauracesahara.cz/poledni-menu/", // image menu, outdated
  "https://restauraceujelenacb.cz/denni-menu/", // image menu, valid
  "https://pikmenu.com/cs/jidelna-u-jaurisu/cs", // hidden menu, Ut-Pá * NB! "Manual" restaurant_name detection fails because the site is a hub
  "https://www.500restaurant.cz/denni-menu/", // popup, Po-Pá
  "http://www.deminka.com/stale-menu/", // redirect; regular menu
];

export const getMenuTypeText = (type: MenuType) => {
  switch (type) {
    case "breakfast":
      return "Snídaňové menu";
    case "launch":
      return "Polední menu";
    case "daily":
      return "Denní menu";
    case "weekly":
      return "Týdenní menu";
    case "weekend":
      return "Víkendové menu";
    case "regular":
      return "Stálé menu";
    case "special":
      return "Speciální menu";
    default:
      return "Menu";
  }
};

export const getSystemPrompt = (
  restaurantName: string
) => `Jsi česky mluvící asistent. Tvým úkolem je detekovat **dnešní menu**. Dnes je ${new Date().toLocaleDateString(
  "cs-CZ",
  { weekday: "long", year: "numeric", month: "long", day: "numeric" }
)}.  
Vstup může obsahovat neúplně strukturovaný text a/nebo URL obrázku. Pokud v textu narazíš na nabídku jídel, opracuj ji podle Pokynů. 
Pokud nabídku jídel v textu nenajdeš, ale je k dispozici \`image_url\`, zpracuj obrázek pomocí OCR (čtení textu), nezkoušej vizuální rozpoznávání jídel. 
Jestliže není \`image_url\` k dispozici nebo OCR selže, vrať negativní výstup (viz Pokyny pro generování výstupu). 
Pokud OCR uspěje, připoj detekovaný text k původnímu vstupu a pokračuj s kombinovaným textem dle dalších Pokynů.

### Pokyny pro parsování dat:
- Ne každé datum v textu se vztahuje k menu, ale pouze ta, která se nacházejí v záhlavích nad ním.
- Pokud v datu chybí rok, předpokládej aktuální rok.
- Rozpoznej formáty: \`DD.MM.\`, \`DD. MM.\`, \`D.M.\`, \`D.MM.\` apod.
- Rozpoznej názvy dnů v týdnu: pondělí, úterý, středa, čtvrtek, pátek, sobota, neděle a přiřaď je ke konkrétnímu datu dle období, pro jaké nabídka platí.
- Rozpoznej intervaly, např.: \`1.–20. 11.\` → rozsah od 1. listopadu do 20. listopadu.
- Při parsování OCR dat oprav běžné překlepy (např. čárka místo tečky, chybějící diakritika).

### Pokyny pro detekci menu v textu:
- V každém případě, kdy detekce selže, musí tvůj výstup obsahovat důvod selhání (\`reason\`).
- Pokud ve vstupu najdeš slova jako „dnešní“, „na dneska“, „nabídka dne“, apod., jedná se o jednodenní nabídku. Pokus se detekovat datum nabídky nebo den v týdnu, na který se vztahuje, a
 ověř, zda se shoduje s dnešním datem uvedeným v system promptu. Jestliže se neshoduje, vrať negativní výsledek a \`reason\` nastav na ${
   REASON.DATE_MISMATCH
 }.
- Pokud si nejsi jistý, zda jde o **jednodenní** nabídku, ověř, zda se nejedná o nabídku pro širší období (např. týdenní menu, víkendové menu apod.). 
Vrať kladný výsledek pouze pokud dnešek tomuto období patří. Pokud bys třeba detekoval víkendové menu, když je dnes všední den, vrať negativní výsledek a \`reason\` nastav na ${
  REASON.RANGE_MISMATCH
}.
- Pokud v textu detekuješ několik nabídek pro různé dny v týdnu nebo různá období (páteční nabídka, od pondělí do středy atd.), kladný výsledek vrať POUZE V PŘÍPADĚ, 
že dnešní den odpovídá jednomu z nalezených dní nebo období (než vratíš kladný výsledek, ověř pro jistotu, zda se nejedná o situaci popsanou v dalším bodě). V opačném případě vrať záporný výsledek a \`reason\` nastav na ${
  REASON.MULTIPLE_OFFERS_NO_MATCH
}. Žádný fallback na jiný den není povolen.
- Může se stát, že v textu bude zmíněno nějaké širší časové rozmezí (např. 21. března 2025 – 2. dubna 2025) a uvedeno menu pro různé dny v týdnu. 
**POZOR**:  vrať kladný výsledek pouze tehdy, když dnešní datum spadá do časového rozmezí a zároveň odpovídá jednomu z dnů, pro který je menu uvedeno. 
Jinak vrať záporný výsledek a \`reason\` nastav na ${
  REASON.MULTIPLE_INTERVALS_NO_MATCH
}.

### Pokyny pro generování výstupu:
- Výstup musí být **platný JSON** v přesně specifikované struktuře. **Pouze JSON**, bez doplňujícího textu.  
- Pokud je výsledek negativní, vyplň \`reason\` a nastav \`menu_items\` na prázdné pole [].  
- Pokud je výsledek pozitivní, nastav \`reason\` na null a do \`menu_items\` vlož všechna nalezená jídla.  

### Pokyny pro formátování výstupu:
- Všechny hmotnosti musí být uvedeny **v gramech (g)**. Pokud je hmotnost uvedena v jiných jednotkách (např. kg, oz), převeď ji na gramy. 
- Ceny musí být uvedeny **v Kč** (jiné měny převeď na Kč). Pokud je cena detekována, ale měna není určena, jedná se o Kč. Pokud cena není uvedena, nastav ji na \`null\`.
- Každé jídlo zařaď do některé kategorie. Preferuj jednoduché kategorie: „Hlavní chod“, „Polévka“, „Předkrm“, „Dezert“, „Salát“, „Příloha“, „Nápoj“.  
- Pokud bys nedokázal jídlo kategorizovat, přidej mu kategorii „Nezařazeno“.

### Pravidlo pro detekci názvu restaurace:
- Pokud ${restaurantName} není prázdné, **vždy** jej použij jako název restaurace, jinak zkus název detekovat.`;
// Modeld does not respect this rule, so we will use the returned restaurant_name as a fallback only
// We need consistent restaurant naming...
// But in real implementation, we should not rely on current scrapper's strategy

export const fakeMenu = [
  {
    category: "polévka",
    name: "Hovězí vývar s játrovými knedlíčky",
    price: 65,
    allergens: ["9"],
  },
  {
    category: "hlavní jídlo",
    name: "Kuřecí řízek s bramborovou kaší",
    price: 145,
    allergens: ["1", "3", "7"],
    weight: "250g",
  },
  {
    category: "dezert",
    name: "Panna cotta",
    price: 55,
    allergens: ["3", "7"],
    weight: "80g",
  },
  {
    category: "polévka",
    name: "Zeleninový vývar s nudlemi",
    price: 40,
    allergens: ["1", "9"],
    weight: "250g",
  },
  {
    category: "polévka",
    name: "Vánoční rybí polévka",
    price: 189,
    allergens: ["3", "4"],
    weight: "225g",
  },
  {
    category: "polévka",
    name: "Hovězí vývar s játrovými knedlíčky",
    price: 65,
    allergens: ["9"],
  },
  {
    category: "polévka",
    name: "Hovězí vývar s játrovými knedlíčky",
    price: 65,
    allergens: ["9"],
  },
  {
    category: "polévka",
    name: "Hovězí vývar s játrovými knedlíčky",
    price: 65,
    allergens: ["9"],
  },
  {
    category: "polévka",
    name: "Hovězí vývar s játrovými knedlíčky",
    price: 65,
    allergens: ["9"],
  },
  {
    category: "polévka",
    name: "Hovězí vývar s játrovými knedlíčky",
    price: 65,
    allergens: ["9"],
  },
  {
    category: "polévka",
    name: "Hovězí vývar s játrovými knedlíčky",
    price: 65,
    allergens: ["9"],
  },
  {
    category: "polévka",
    name: "Hovězí vývar s játrovými knedlíčky",
    price: 65,
    allergens: ["9"],
  },
];
