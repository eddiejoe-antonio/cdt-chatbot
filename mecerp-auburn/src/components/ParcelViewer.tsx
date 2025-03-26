/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'; // Shadcn Card
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
// import { Progress } from '@/components/ui/progress';
import { Resource } from '@/lib/resource';

interface ParcelViewerProps {
  isOpen: boolean;
  onClose: () => void;
  parcelData: Resource | null;
}

const ParcelViewer: React.FC<ParcelViewerProps> = ({ isOpen, onClose, parcelData }) => {
  if (!parcelData) return null;

  const name = parcelData.properties.name ?? 'N/A';
  const address = parcelData.properties.address_geocode ?? 'N/A';
  const primaryType = Array.isArray(parcelData.properties.primary_type)
    ? parcelData.properties.primary_type.join(', ')
    : parcelData.properties.primary_type ?? 'N/A';
  const website = parcelData.properties.website ?? '';
  const contactName = parcelData.properties.contact_name ?? 'N/A';
  const contactEmail = parcelData.properties.contact_email ?? 'N/A';
  const contactPhone = parcelData.properties.contact_phone ?? 'N/A';
  const description = parcelData.properties.description ?? 'No description provided';

  return (
    <div
      className={`fixed right-0 top-0 h-full w-full md:w-1/3 bg-white shadow-lg transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ zIndex: 9999 }}
    >
      <button
        className="absolute top-2 right-4 text-2xl p-2 rounded-full hover:bg-gray-200 transition"
        onClick={onClose}
      >
        &times;
      </button>

      <div className="mt-10 overflow-y-auto h-[calc(100vh-60px)] p-4">
        {/* Name */}
        <Card className="rounded-lg shadow-lg p-2 mb-4">
          <CardHeader>
            <CardTitle className="text-xl font-bold">{name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">{description}</p>
          </CardContent>
        </Card>

        {/* Website */}
        {website && (
          <Card className="rounded-lg shadow-lg p-2 mb-4">
            <CardHeader>
              <CardTitle className="text-md font-semibold">Website</CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href={website.startsWith('http') ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline break-words"
              >
                {website}
              </a>
            </CardContent>
          </Card>
        )}

        {/* Accordion Details */}
        <Accordion type="single" collapsible className="mb-4 ml-2" defaultValue="basic-info">
          <AccordionItem value="basic-info">
            <AccordionTrigger className="text-md font-semibold">Details</AccordionTrigger>
            <AccordionContent className="text-sm">
              <div className="grid grid-cols-1 gap-2">
                <div><strong>Address:</strong> {address}</div>
                <div><strong>Primary Type:</strong> {primaryType}</div>
                <div><strong>Contact:</strong> {contactName}</div>
                <div><strong>Email:</strong> {contactEmail}</div>
                <div><strong>Phone:</strong> {contactPhone}</div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
};

export default ParcelViewer;
