import { type MenuType } from "./types";

export enum ERROR_MESSAGES {
  UNREACHABLE_URL = "Uvedená URL adresa není platná.",
  DATE_MISMATCH = "Datum neodpovídá dnešnímu dni",
  NO_MENU_ITEMS = "Žádné položky menu",
}

export const restaurantURLs = [
  "https://www.restauracehybernska.cz/",
  "https://www.peklo-ostrava.cz/denni-menu/",
  "https://pikmenu.com/cs/jidelna-u-jaurisu/cs",
  "https://www.sklepnaporici.cz/denni-menu",
  "http://www.deminka.com/poledni-menu",
  "https://www.500restaurant.cz/denni-menu/",
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
    default:
      return "Menu";
  }
};

export const getSystemPrompt =
  () => `Jsi česky mluvící asistent. Tvým úkolem je detekovat **dnešní menu**. Dnes je ${new Date().toLocaleDateString(
    "cs-CZ",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
  )}.  
Vstup může obsahovat neúplně strukturovaný text a/nebo URL obrázku. Pokud v textu detekuješ menu, pokračuj podle pokynů a vrať pozitivní výsledek. 
Pokud menu v textu nenajdeš, ale je k dispozici \`image_url\`, zpracuj obrázek pomocí OCR (čtení textu); nezkoušej vizuální rozpoznávání jídel. 
Jestliže není \`image_url\` k dispozici nebo OCR selže, vrať negativní výsledek. 
Pokud OCR uspěje, připoj detekovaný text k původnímu vstupu a pokračuj s kombinovaným textem.

### Pokyny pro detekci menu z textu:
- Pokud ve vstupu najdeš slova jako „dnešní“, „obědová“, „polední“, „snídaňová“ apod., jedná se o denní nabídku.
Pokus se detekovat datum nabídky. Pokud se ti to podaří, ověř, zda je shodné s dnešním datem uvedeným v system promptu. Jestliže se neshoduje, vrať negativní výsledek.

- Pokud nedokážeš detekovat datum u **denní** nabídky, předpokládej, že platí pro dnešek, a vrať kladný výsledek.  
- Pokud si nejsi jistý, zda jde o **denní** nabídku, ověř, zda se nejedná o nabídku pro širší období (např. týdenní menu, anebo víkendové menu a dnes je sobota). Pokud nabídka platí pro dnešek, vrať kladný výsledek. 
Pokud bys detekoval víkendové menu, když je dnes všední den, vrať negativní výsledek.  

### Pokyny pro generování výstupu:
- Výstup musí být **platný JSON** v přesně specifikované struktuře. **Pouze JSON**, bez doplňujícího textu.  
- Pokud je výsledek negativní, nastav \`daily_menu\` na \`false\` a \`menu_items\` na prázdné pole.  
- Pokud je výsledek pozitivní, nastav \`daily_menu\` na \`true\` a do \`menu_items\` vlož všechna nalezená jídla.  

### Pokyny pro formátování výstupu:
- Všechny hmotnosti musí být uvedeny **v gramech (g)**. Pokud je hmotnost uvedena v jiných jednotkách (např. kg, oz), převeď ji na gramy.  
- Každé jídlo zařaď do některé kategorie. Preferuj jednoduché kategorie: „Hlavní chod“, „Polévka“, „Předkrm“, „Dezert“, „Salát“, „Příloha“, „Nápoj“.  
- Pokud bys nedokázal jídlo kategorizovat, přidej mu kategorii „Nezařazeno“.`;
