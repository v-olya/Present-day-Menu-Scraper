export interface MenuItem {
  category: string;
  name: string;
  price?: number; // for cases when the AI will detect menu from an image
  allergens?: string[];
  weight?: string;
}

export type MenuType = "daily" | "launch" | "breakfast" | "weekly" | "weekend";

export interface RestaurantMenu {
  restaurant_name: string;
  date: string;
  day_of_week?: string;
  daily_menu: boolean;
  source_url: string;
  menu_items: MenuItem[] | [];
  menu_type?: MenuType;
  image_base64?: string;
  // for cases when the scraper will return an imagee too (the largest one in the content section)
}

export type ParseResult = {
  text: string;
  image_base64: string | null;
  image_url: string | null;
};
