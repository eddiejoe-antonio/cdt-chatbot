'use client';

import dynamic from 'next/dynamic';
import { Resource } from '@/lib/resource';

const MapWithResources = dynamic(() => import('@/components/Map'), { ssr: false });

export default function MapWrapper({ resources }: { resources: Resource[] }) {
  return <MapWithResources resources={resources} />;
}
