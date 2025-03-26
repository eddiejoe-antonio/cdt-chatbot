export interface Resource {
    properties: {
      name: string;
      address_geocode: string;
      googlemaps_link?: string;
      primary_type?: string | string[];
      website?: string;
      description?: string;
      contact_name?: string;
      contact_email?: string;
      contact_phone?: string;
    };
  }
  