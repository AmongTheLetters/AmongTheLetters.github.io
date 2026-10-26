/*
 * Book fairs and reader and writer events shown on the Calendar page.
 * Every entry was checked against the organiser's official site on Oct 26, 2026.
 * Add an event only once its dates are published by the organiser. Dates are inclusive, YYYY-MM-DD.
 */
export type EventType = "Book fair" | "Festival" | "Reading series" | "Conference" | "Workshop";
export type Audience = "Readers" | "Writers" | "Readers and writers";
export type Cost = "Free" | "Paid" | "Free and paid";
export type Format = "In person" | "Online" | "Hybrid";
export type Region = "Canada" | "United States" | "Mexico" | "Europe";

export type LitEvent = {
  id: string;
  name: string;
  start: string;
  end: string;
  city: string;
  province: string; // province, state or nation
  country: string;
  region: Region;
  type: EventType;
  audience: Audience;
  cost: Cost;
  format: Format;
  url: string;
  note?: string;
};

export const EVENTS: LitEvent[] = [
  { id: "kentucky-book-festival-2026", name: "Kentucky Book Festival", start: "2026-11-07", end: "2026-11-07", city: "Lexington", province: "Kentucky", country: "United States", region: "United States", type: "Festival", audience: "Readers", cost: "Free", format: "In person", url: "https://kybookfestival.org/" },
  { id: "texas-book-festival-2026", name: "Texas Book Festival", start: "2026-11-14", end: "2026-11-15", city: "Austin", province: "Texas", country: "United States", region: "United States", type: "Festival", audience: "Readers", cost: "Free", format: "In person", url: "https://texasbookfestival.org/" },
  { id: "miami-book-fair-2026", name: "Miami Book Fair", start: "2026-11-15", end: "2026-11-22", city: "Miami", province: "Florida", country: "United States", region: "United States", type: "Book fair", audience: "Readers", cost: "Free and paid", format: "In person", url: "https://miamibookfair.com/", note: "Street Fair runs Nov 20 to 22, with free entry on the Friday" },
  { id: "salon-livre-montreal-2026", name: "Salon du livre de Montréal", start: "2026-11-25", end: "2026-11-29", city: "Montréal", province: "Quebec", country: "Canada", region: "Canada", type: "Book fair", audience: "Readers", cost: "Paid", format: "In person", url: "https://www.salondulivredemontreal.com/", note: "Events around the city begin Nov 13" },
  { id: "fil-guadalajara-2026", name: "Feria Internacional del Libro de Guadalajara", start: "2026-11-28", end: "2026-12-06", city: "Guadalajara", province: "Jalisco", country: "Mexico", region: "Mexico", type: "Book fair", audience: "Readers and writers", cost: "Paid", format: "In person", url: "https://www.fil.com.mx/", note: "Some weekday hours are for industry professionals only" },
  { id: "san-miguel-writers-2027", name: "San Miguel Writers' Conference and Literary Festival", start: "2027-02-10", end: "2027-02-14", city: "San Miguel de Allende", province: "Guanajuato", country: "Mexico", region: "Mexico", type: "Conference", audience: "Writers", cost: "Paid", format: "In person", url: "https://sanmiguelwritersconference.org/" },
  { id: "salon-livre-outaouais-2027", name: "Salon du livre de l'Outaouais", start: "2027-02-25", end: "2027-02-28", city: "Gatineau", province: "Quebec", country: "Canada", region: "Canada", type: "Book fair", audience: "Readers", cost: "Paid", format: "In person", url: "https://slo.qc.ca/" },
  { id: "tucson-festival-books-2027", name: "Tucson Festival of Books", start: "2027-03-13", end: "2027-03-14", city: "Tucson", province: "Arizona", country: "United States", region: "United States", type: "Festival", audience: "Readers", cost: "Free", format: "In person", url: "https://tucsonfestivalofbooks.org/" },
  { id: "london-book-fair-2027", name: "The London Book Fair", start: "2027-03-16", end: "2027-03-18", city: "London", province: "England", country: "United Kingdom", region: "Europe", type: "Book fair", audience: "Writers", cost: "Paid", format: "In person", url: "https://www.londonbookfair.co.uk/", note: "A trade fair for publishing professionals and authors" },
  { id: "awp-2027", name: "AWP Conference and Bookfair", start: "2027-03-17", end: "2027-03-20", city: "Chicago", province: "Illinois", country: "United States", region: "United States", type: "Conference", audience: "Writers", cost: "Paid", format: "In person", url: "https://conference.awpwriter.org/" },
  { id: "left-coast-crime-2027", name: "Left Coast Crime", start: "2027-04-01", end: "2027-04-04", city: "Santa Fe", province: "New Mexico", country: "United States", region: "United States", type: "Conference", audience: "Readers and writers", cost: "Paid", format: "In person", url: "https://leftcoastcrime.org/2027/", note: "A convention for mystery readers and writers" },
  { id: "bologna-childrens-2027", name: "Bologna Children's Book Fair", start: "2027-04-05", end: "2027-04-08", city: "Bologna", province: "Emilia-Romagna", country: "Italy", region: "Europe", type: "Book fair", audience: "Writers", cost: "Paid", format: "In person", url: "https://www.bolognachildrensbookfair.com/", note: "A trade fair for children's publishing, authors and illustrators" },
  { id: "silq-2027", name: "Salon international du livre de Québec", start: "2027-04-07", end: "2027-04-11", city: "Québec City", province: "Quebec", country: "Canada", region: "Canada", type: "Book fair", audience: "Readers", cost: "Paid", format: "In person", url: "https://silq.ca/" },
  { id: "malice-domestic-2027", name: "Malice Domestic", start: "2027-04-09", end: "2027-04-11", city: "Bethesda", province: "Maryland", country: "United States", region: "United States", type: "Conference", audience: "Readers and writers", cost: "Paid", format: "In person", url: "https://www.malicedomestic.net/", note: "A convention for readers and writers of traditional mysteries" },
  { id: "blue-metropolis-2027", name: "Blue Metropolis International Literary Festival", start: "2027-04-15", end: "2027-04-18", city: "Montréal", province: "Quebec", country: "Canada", region: "Canada", type: "Festival", audience: "Readers and writers", cost: "Free and paid", format: "Hybrid", url: "https://bluemetropolis.org/festival-2027/", note: "Online programming begins Apr 5" },
  { id: "festival-livre-paris-2027", name: "Festival du Livre de Paris", start: "2027-04-16", end: "2027-04-18", city: "Paris", province: "Île-de-France", country: "France", region: "Europe", type: "Book fair", audience: "Readers", cost: "Free and paid", format: "In person", url: "https://www.festivaldulivredeparis.fr/" },
  { id: "la-times-festival-books-2027", name: "Los Angeles Times Festival of Books", start: "2027-04-17", end: "2027-04-18", city: "Los Angeles", province: "California", country: "United States", region: "United States", type: "Festival", audience: "Readers", cost: "Free", format: "In person", url: "https://latimesbookfestival.com/" },
  { id: "independent-bookstore-day-2027", name: "Independent Bookstore Day", start: "2027-04-24", end: "2027-04-24", city: "Bookstores nationwide", province: "", country: "United States", region: "United States", type: "Festival", audience: "Readers", cost: "Free", format: "In person", url: "https://www.bookweb.org/independent-bookstore-day" },
  { id: "canadian-independent-bookstore-day-2027", name: "Canadian Independent Bookstore Day", start: "2027-04-24", end: "2027-04-24", city: "Bookstores across Canada", province: "", country: "Canada", region: "Canada", type: "Festival", audience: "Readers", cost: "Free", format: "In person", url: "https://www.indiebookstores.ca/cibd/" },
  { id: "fold-2027", name: "Festival of Literary Diversity (The FOLD)", start: "2027-04-25", end: "2027-05-02", city: "Brampton", province: "Ontario", country: "Canada", region: "Canada", type: "Festival", audience: "Readers and writers", cost: "Free and paid", format: "Hybrid", url: "https://thefoldcanada.org/", note: "Online from Apr 25 to 28, in Brampton from Apr 29 to May 2" },
  { id: "thrillerfest-2027", name: "ThrillerFest", start: "2027-04-27", end: "2027-05-01", city: "New York", province: "New York", country: "United States", region: "United States", type: "Conference", audience: "Readers and writers", cost: "Paid", format: "In person", url: "https://thrillerfest.com/" },
  { id: "hay-festival-2027", name: "Hay Festival", start: "2027-05-27", end: "2027-06-06", city: "Hay-on-Wye", province: "Wales", country: "United Kingdom", region: "Europe", type: "Festival", audience: "Readers", cost: "Paid", format: "In person", url: "https://www.hayfestival.com/hay-on-wye/home/" },
  { id: "bouchercon-2027", name: "Bouchercon", start: "2027-09-01", end: "2027-09-05", city: "Washington", province: "District of Columbia", country: "United States", region: "United States", type: "Conference", audience: "Readers and writers", cost: "Paid", format: "In person", url: "https://www.bouchercon2027.com/", note: "The world mystery convention" },
  { id: "frankfurter-buchmesse-2027", name: "Frankfurter Buchmesse", start: "2027-10-06", end: "2027-10-10", city: "Frankfurt", province: "Hesse", country: "Germany", region: "Europe", type: "Book fair", audience: "Readers and writers", cost: "Paid", format: "In person", url: "https://www.buchmesse.de/en", note: "Trade days first, then public days on the weekend" },
];

export const EVENT_TYPES: EventType[] = ["Book fair", "Festival", "Reading series", "Conference", "Workshop"];
export const REGIONS: Region[] = ["Canada", "United States", "Mexico", "Europe"];
export const AUDIENCES: Audience[] = ["Readers", "Writers", "Readers and writers"];
