import { MapPinIcon, BookmarkIcon, LinkIcon } from '@heroicons/react/24/outline';
import { Resource } from '../lib/resource';

interface DataCardProps {
  resource: Resource;
}

export default function DataCard({ resource }: DataCardProps) {
  const formatType = (type: string | string[]) => {
    return Array.isArray(type) ? type.join(', ') : type;
  };

  const formatWebsite = (url?: string | null) => {
    if (!url) return '';
    return url.startsWith('http') ? url : `https://${url}`;
  };

  return (
    <div className='flex flex-col border-b border-[#3B75A9] p-4 transition-all'>
      <h2 className='font-bold text-md'>{resource.properties.name}</h2>

      <div className='flex items-center text-sm py-2 text-[#0E3052]'>
        <MapPinIcon className='h-5 w-5 mr-2' />
        <a
          href={resource.properties.googlemaps_link}
          target='_blank'
          rel='noopener noreferrer'
          className='hover:text-[#1E79C8]'
        >
          {resource.properties.address_geocode}
        </a>
      </div>

      <div className='flex items-center text-sm py-2 text-[#0E3052]'>
        <BookmarkIcon className='h-5 w-5 mr-2' />
        <span>{formatType(resource.properties.primary_type ?? '')}</span>
      </div>

      <div className='flex items-center text-sm py-2 text-[#0E3052]'>
        <LinkIcon className='h-5 w-5 mr-2' />
        {resource.properties.website && (
          <a
            href={formatWebsite(resource.properties.website)}
            target='_blank'
            rel='noopener noreferrer'
            className='hover:text-[#1E79C8]'
          >
            {resource.properties.website}
          </a>
        )}
      </div>
    </div>
  );
}
