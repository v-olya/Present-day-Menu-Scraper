import Image from "next/image";
import { getMenuTypeText } from "../helpers/const";
import { MenuType } from "../helpers/types";

interface RestaurantHeaderProps {
  imageSrc: string;
  restaurantName: string;
  menuType: MenuType;
}

export function RestaurantHeader({
  imageSrc,
  restaurantName,
  menuType,
}: RestaurantHeaderProps) {
  if (restaurantName.trim() === "") {
    return null;
  }
  return (
    <div className="w-full flex justify-center my-6">
      <div className="flex items-center">
        <div className="w-24 h-24 shrink-0 bg-gray-100 rounded-md overflow-hidden relative">
          <div
            className="absolute inset-0.5"
            style={{
              backgroundImage: `url(${imageSrc})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(6px)",
              transform: "scale(1.06)",
            }}
          />
          <div className="absolute inset-1 rounded-md">
            <Image
              src={imageSrc}
              alt={restaurantName}
              width={96}
              height={96}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-teal-800 ms-4">
          {restaurantName} &nbsp;&#10087;&nbsp;{" "}
          {getMenuTypeText(menuType || "daily")}
        </h2>
      </div>
    </div>
  );
}
