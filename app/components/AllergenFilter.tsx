import { getAllergenDescriptions } from "../helpers/allergens";

interface AllergenFilterProps {
  allAllergens: string[];
  selectedAllergens: string[];
  setSelectedAllergens: (allergens: string[]) => void;
}

export function AllergenFilter({
  allAllergens,
  selectedAllergens,
  setSelectedAllergens,
}: AllergenFilterProps) {
  if (allAllergens.length === 0) return null;
  return (
    <div className="mb-6 text-sm">
      <div className="flex flex-wrap justify-center items-baseline gap-x-6 gap-y-4 mb-2">
        <span>Odfiltruj alergeny:</span>
        {allAllergens.map((code) => (
          <label key={code} className="flex items-center">
            <input
              type="checkbox"
              checked={selectedAllergens.includes(code)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedAllergens([...selectedAllergens, code]);
                } else {
                  setSelectedAllergens(
                    selectedAllergens.filter((a) => a !== code)
                  );
                }
              }}
              className="mr-2"
            />
            {getAllergenDescriptions([code])[0]}
          </label>
        ))}
        <button
          type="button"
          onClick={() => setSelectedAllergens([])}
          className="py-1.5 px-3 btn btn-outline font-medium"
        >
          Zrušit vše
        </button>
      </div>
    </div>
  );
}
