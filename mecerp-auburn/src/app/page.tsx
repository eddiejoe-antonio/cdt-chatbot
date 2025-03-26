'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import LayerManager from '@/components/LayerManager';
import DataCard from '@/components/DataCard';
import { Resource } from '@/lib/resource';
import Navbar from '@/components/Navbar';
import Image from 'next/image';
import { Button } from '@/components/ui/button'; // ShadCN's button

const MapWithResources = dynamic(() => import('@/components/Map'), { ssr: false });

export default function ResourceCardsPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedCensusField, setSelectedCensusField] = useState<string | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'map' | 'cards'>('map');

  useEffect(() => {
    const fetchResources = async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/utils`);
      const data = await res.json();
      setResources(data);
    };
    fetchResources();
  }, []);

  const handleToggleLayer = (layerId: string, visible: boolean) => {
    setVisibleLayers((prev) => ({
      ...prev,
      [layerId]: visible,
    }));
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Navbar */}
      <Navbar
        logo={
          <Image
            src="/images/hra_logo.png"
            alt="Parcel Map Logo"
            width={40}
            height={50}
          />
        }
      />

      {/* View toggle button below the navbar */}
      <div className="w-full flex justify-center py-3 border-b">
        <Button
          variant="outline"
          onClick={() => setViewMode(viewMode === 'map' ? 'cards' : 'map')}
        >
          {viewMode === 'map' ? 'Switch to Card View' : 'Switch to Map View'}
        </Button>
      </div>

      {/* Main layout */}
      <main className="flex flex-1 overflow-hidden">
        {viewMode === 'map' ? (
          <>
            <div className="w-full md:w-1/4 overflow-y-auto p-2">
              <LayerManager
                onToggleLayer={handleToggleLayer}
                selectedCensusField={selectedCensusField}
                setSelectedCensusField={setSelectedCensusField}
              />
            </div>
            <div className="w-full md:w-3/4 h-[300px] md:h-full">
              <MapWithResources
                resources={resources}
                visibleLayers={visibleLayers}
                selectedCensusField={selectedCensusField}
              />
            </div>
          </>
        ) : (
          <div className="w-full overflow-y-auto p-6">
            <h1 className="text-2xl font-bold mb-6">Available Resources</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {resources.map((r, i) => (
                <DataCard key={i} resource={r} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
