'use client';

import mapboxgl from 'mapbox-gl';
import { useEffect, useRef, useState } from 'react';
import { Resource } from '@/lib/resource';
import ParcelViewer from './ParcelViewer';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface MapProps {
  resources: Resource[];
}

export default function MapWithResources({ resources }: MapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [selected, setSelected] = useState<Resource | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-74.006, 40.7128],
      zoom: 11,
    });

    mapRef.current = map;

    map.on('load', () => {
      const geojson = {
        type: 'FeatureCollection',
        features: resources.map((resource) => ({
          type: 'Feature',
          properties: {
            ...resource.properties,
          },
          geometry: {
            type: 'Point',
            coordinates: [-74.006, 40.7128], // Use real coords later
          },
        })),
      };

      map.addSource('resources', {
        type: 'geojson',
        data: geojson,
      });

      map.addLayer({
        id: 'resource-points',
        type: 'circle',
        source: 'resources',
        paint: {
          'circle-radius': 6,
          'circle-color': '#1E79C8',
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.on('click', 'resource-points', (e) => {
        const feature = e.features?.[0];
        if (!feature) return;

        const props = feature.properties;
        const parsedProps = JSON.parse(JSON.stringify(props));
        setSelected({ properties: parsedProps });
      });

      map.on('mouseenter', 'resource-points', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'resource-points', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    return () => map.remove();
  }, [resources]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      <ParcelViewer
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        parcelData={selected}
      />
    </div>
  );
}
