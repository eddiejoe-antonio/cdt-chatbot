import { NextResponse } from 'next/server';

export async function GET() {
  const mockData = [
    {
      properties: {
        name: 'Community Center A',
        address_geocode: '123 Main St, Townville, NC',
        googlemaps_link: 'https://maps.google.com',
        primary_type: ['Education'],
        website: 'communitya.org',
        description: 'A great place to learn.',
        contact_name: 'John Doe',
        contact_email: 'john@example.com',
        contact_phone: '555-1234',
      },
    },
    {
      properties: {
        name: 'Health Clinic B',
        address_geocode: '456 Elm St, Healthtown, NC',
        googlemaps_link: 'https://maps.google.com',
        primary_type: 'Healthcare',
        website: 'healthclinicb.com',
        description: 'Helping you stay healthy.',
        contact_name: 'Jane Smith',
        contact_email: 'jane@example.com',
        contact_phone: '555-5678',
      },
    },
  ];

  return NextResponse.json(mockData);
}
