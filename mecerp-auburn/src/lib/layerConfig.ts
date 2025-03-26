/* eslint-disable @typescript-eslint/no-explicit-any */

export interface LayerConfig {
    id: string;
    name: string;
    type: 'fill' | 'line' | 'circle' | 'symbol' | 'raster' | 'background' | 'hillshade' | 'heatmap';
    source: {
      id: string;
      type: 'vector' | 'geojson' | 'raster' | 'image';
      url?: string;
      tiles?: string[];
      minzoom?: number;
      maxzoom?: number;
      data?: string | GeoJSON.FeatureCollection | GeoJSON.Feature; // Support GeoJSON object
    };
    'source-layer'?: string;
    paint?: Record<string, any>;
    layout?: Record<string, any>;
    visible: boolean;
    interactive?: boolean;
    fields?: string[];
    legendLabel?: string;
    filter?: any[];
    tooltip?: {
      enabled: boolean;
      fields: Array<{ field: string; label?: string }>;
    };
    ranges?: Array<{ min?: number; color: string; label: string }>;
    fieldLegends?: Record<
      string,
      {
        legendLabel: string;
        ranges: { min: number; color: string; label: string }[];
      }
    >;
  }
  
  
  
  const layersConfig: LayerConfig[] = [
    {
      id: 'parcels',
      name: 'Parcels',
      type: 'fill',
      source: {
        id: 'parcels',
        type: 'vector',
        url: 'mapbox://eddiejoeantonio.0m2em6qu'
      },
      'source-layer': 'input',
      paint: {
        'fill-color': [
          'step',
          ['get', 'total_score'],
          '#FF1010',
          9, '#AA4313',
          12, '#557616',
          15, '#00AA19',
        ],
        'fill-opacity': 0.7,
      },
      legendLabel: 'Total QAP Score', // Add legend label here
      ranges: [ // Define ranges for the legend
        { min: 0, color: '#FF1010', label: '< 9' },
        { min: 9, color: '#AA4313', label: '9 - 12' },
        { min: 12, color: '#557616', label: '12 - 15' },
        { min: 15, color: '#00AA19', label: '≥ 15' },
      ],
      visible: true,
      interactive: true,
      tooltip: {
        enabled: true,
        fields: [
          { field: 'address', label: 'Address' },
          { field: 'total_score', label: 'Total Score' },
          { field: 'zoning_description', label: 'Zoning' },
        ]}
    },
    {
      id: 'zoning-layer',
      name: 'Zoning',
      type: 'fill',
      source: {
        id: 'zoning-source',
        type: 'geojson',
        data: '/geojson/zoning.geojson', // Update with the correct URL
      },
      paint: {
        'fill-color': [
          'match',
          ['get', 'geo_name'],
          'Agriculture', '#ADFF2F',
          'Aviation', '#ADD8E6',
          'Commercial', '#FF0000',
          'Single Family', '#FFFF00',
          'Special', '#FFC0CB',
          'Transit Oriented', '#FFA500',
          'Conditional Overlay', '#DDA0DD',
          'Industrial', '#800080',
          'Mixed Use', '#FF8C00',
          'Multi Family', '#FFD700',
          'Neighborhood Plan', '#D3D3D3',
          'Office', '#0000FF',
          'Planned Unit Development', '#006400',
          '#FFFFFF' // Default color (White) for any unmatched categories
        ],
        'fill-opacity': 0.7,
        // 'fill-outline-color' property has been removed
      },
      legendLabel: 'Simplified Zoning',
      ranges: [
        { color: '#ADFF2F', label: 'Agriculture' },
        { color: '#ADD8E6', label: 'Aviation' },
        { color: '#FF0000', label: 'Commercial' },
        { color: '#FFFF00', label: 'Single Family' },
        { color: '#FFC0CB', label: 'Special' },
        { color: '#FFA500', label: 'Transit Oriented' },
        { color: '#DDA0DD', label: 'Conditional Overlay' },
        { color: '#800080', label: 'Industrial' },
        { color: '#FF8C00', label: 'Mixed Use' },
        { color: '#FFD700', label: 'Multi Family' },
        { color: '#D3D3D3', label: 'Neighborhood Plan' },
        { color: '#0000FF', label: 'Office' },
        { color: '#006400', label: 'Planned Unit Development' },
      ],
      visible: false,
      interactive: false,
    },
    {
      id: 'tif-layer',
      name: 'TIF Districts',
      type: 'fill',
      source: {
        id: 'tif-layer',
        type: 'geojson',
        data: '/geojson/tif_districts.geojson',
      },
      paint: {
        'fill-color': 'teal',
        'fill-opacity': 0.7,
        'fill-outline-color': '#FFF',
      },
      legendLabel: 'TIF Districts',
      ranges: [
        { color: 'teal', label: 'TIF District' },
      ],
      visible: false,
      interactive: false,
    },
    {
      id: 'half-mile-buffer-layer',
      name: 'TIVIA/RRIF Eligibility',
      type: 'fill',
      source: {
        id: 'half-mile-buffer-source',
        type: 'geojson',
        data: '/geojson/half_mile_buffer.geojson',
      },
      paint: {
        'fill-color': 'blue',
        'fill-opacity': 0.5,
        'fill-outline-color': '#FFF',
      },
      legendLabel: '1/2 Mile Buffer',
      ranges: [
        { color: 'blue', label: 'Buffer Area' },
      ],
      visible: false,
      interactive: true,
      tooltip: {
        enabled: true,
        fields: [
          { field: 'geo_name', label: 'Station' },
        ]}
    },
    {
      id: 'austin-dda',
      name: 'DDA Boundary',
      type: 'fill',
      source: {
        id: 'austin-dda-source',
        type: 'geojson',
        data: '/geojson/Austin_TX_DDA_Boundary.geojson',
      },
      paint: {
        'fill-color': 'orange',
        'fill-opacity': 0.5,
        'fill-outline-color': '#FFF',
      },
      legendLabel: 'Difficult Development Area',
      ranges: [
        { color: 'orange', label: 'DDA Boundary' },
      ],
      visible: false,
      interactive: false,
    },
    {
      id: 'austin-qct',
      name: 'Qualified Census Tracts',
      type: 'fill',
      source: {
        id: 'austin-qct-source',
        type: 'geojson',
        data: '/geojson/Austin_TX_QCT_Tracts.geojson',
      },
      paint: {
        'fill-color': 'gold',
        'fill-opacity': 0.5,
        'fill-outline-color': '#FFF',
      },
      legendLabel: 'Qualified Census Tracts',
      ranges: [
        { color: 'gold', label: 'Qualified Census Tracts' },
      ],
      visible: false,
      interactive: false,
    },
    {
      id: 'census-tracts',
      name: 'Census Tracts',
      type: 'fill',
      source: {
        id: 'census-tracts-source',
        type: 'geojson',
        data: '/geojson/Austin_TX_Tracts.geojson',
      },
      fields: ['jobs_5_mile', 'jobs_10_mile', 'median_income_quartile', 'poverty_rate', 'avg_score'],
      fieldLegends: {
        jobs_5_mile: {
          legendLabel: 'Jobs within 5 miles',
          ranges: [
            { min: 0, color: '#eff3ff', label: '< 25,000' },
            { min: 25000, color: '#bdd7e7', label: '25,000 - 50,000' },
            { min: 50000, color: '#6baed6', label: '50,000 - 75,000' },
            { min: 75000, color: '#3182bd', label: '75,000 - 100,000' },
            { min: 100000, color: '#08519c', label: '≥ 100,000' },
          ],
        },
        jobs_10_mile: {
          legendLabel: 'Jobs within 10 miles',
          ranges: [
            { min: 0, color: '#eff3ff', label: '< 150,000' },
            { min: 150000, color: '#bdd7e7', label: '150,000 - 300,000' },
            { min: 300000, color: '#6baed6', label: '300,000 - 450,000' },
            { min: 450000, color: '#3182bd', label: '450,000 - 600,000' },
            { min: 600000, color: '#08519c', label: '≥ 600,000' },
          ],
        },
        median_income_quartile: {
          legendLabel: 'Median Income Quartile',
          ranges: [
            { min: 1, color: '#ce1256', label: 'Quartile 1 (Highest Income)' },
            { min: 2, color: '#df65b0', label: 'Quartile 2' },
            { min: 3, color: '#d7b5d8', label: 'Quartile 3' },
            { min: 4, color: '#f1eef6', label: 'Quartile 4 (Lowest Income)' },
          ], 
        },
        poverty_rate: {
          legendLabel: 'Poverty Rate',
          ranges: [
            { min: 0, color: '#feedde', label: '< 10%' },
            { min: 10, color: '#fdbe85', label: '10% - 20%' },
            { min: 20, color: '#fd8d3c', label: '20% - 30%' },
            { min: 30, color: '#d94701', label: '≥ 30%' },
          ],
        },
        avg_score: {
          legendLabel: 'Average QAP Score',
          ranges: [
            { min: 0, color: '#FF1010', label: 'Less than 10' },
            { min: 10, color: '#AA4313', label: '10-12' },
            { min: 14, color: '#557616', label: '12-14' },
            { min: 15, color: '#00AA19', label: '15 or greater' },
          ],
        },
      },
      paint: {
        'fill-color': '#000000', // Will be updated dynamically
        'fill-opacity': 0.7,
        'fill-outline-color': '#FFF',
      },
      visible: true,
      interactive: true,
      tooltip: {
        enabled: true,
        fields: [
          { field: 'NAME', label: 'Tract Name' },
          { field: 'GEOID', label: 'GEOID' },
          // The selected census field will be added dynamically
        ],
      },
    },
        // ... other layers
      ];
      
      export default layersConfig;