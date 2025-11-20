import { handwritten } from "../fonts";
import { getAllergenDescriptions } from "../helpers/allergens";
import type { MenuItem } from "../helpers/types";

interface CategoryCardProps {
  category: string;
  items: MenuItem[];
}

export function CategoryCard({ category, items }: CategoryCardProps) {
  return (
    <div className="category-card mb-6">
      <div className="max-h-screen md:max-h-[440px] overflow-y-auto">
        <h3 className="text-xl mb-2 capitalize font-bold">{category}</h3>
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index}>
              <div className="flex justify-between items-start">
                <div>
                  <p
                    className={`${handwritten.className} text-2xl font-bold mb-2`}
                  >
                    {item.name}
                  </p>
                  {item.allergens && item.allergens.length > 0 && (
                    <p className="text-sm text-emerald-800">
                      Alergeny:{" "}
                      {getAllergenDescriptions(item.allergens).join(", ")}
                    </p>
                  )}
                </div>
                <div className="text-right mr-6">
                  <p className="font-medium">{item.price ?? ""} CZK</p>
                  {item.weight && (
                    <p className="text-sm mt-1">Porce: {item.weight ?? ""}</p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
