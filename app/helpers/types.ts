export interface MenuItem {
  category: string;
  name: string;
  price?: number; // for cases when the AI will detect menu from an image
  allergens?: string[];
  weight?: string;
}

export type MenuType =
  | "daily"
  | "launch"
  | "breakfast"
  | "weekly"
  | "weekend"
  | "regular"
  | "special";

export interface RestaurantMenu {
  restaurant_name: string;
  date: string;
  day_of_week?: string;
  source_url: string;
  menu_items: MenuItem[] | [];
  menu_type?: MenuType;
  image_base64?: string;
}

export interface DetectedMenu extends RestaurantMenu {
  reason: string | null;
}

export type ParseResult = {
  text: string;
  image_base64: string | null;
  image_url: string | null;
  restaurant: string;
};
