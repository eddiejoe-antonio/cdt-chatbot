'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import layersConfig, { LayerConfig } from '../lib/layerConfig';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface LayerManagerProps {
  onToggleLayer: (layerId: string, visible: boolean) => void;
  selectedCensusField: string | null;
  setSelectedCensusField: (field: string | null) => void;
}


const LayerManager: React.FC<LayerManagerProps> = ({ onToggleLayer }) => {
  const [selectedCensusField, setSelectedCensusField] = useState<string | null>(null);

  // Initially set layer visibility based on the configuration
  const [layerVisibility, setLayerVisibility] = useState(
    layersConfig.reduce((acc, layer) => {
      acc[layer.id] = layer.visible;
      return acc;
    }, {} as Record<string, boolean>)
  );

  // Ensure the visibility of the entire census_tracts layer when fields are selected
  useEffect(() => {
    const censusLayerId = 'census-tracts';
    const isCensusVisible = selectedCensusField !== null;

    if (layerVisibility[censusLayerId] !== isCensusVisible) {
      setLayerVisibility((prevVisibility) => ({
        ...prevVisibility,
        [censusLayerId]: isCensusVisible,
      }));
      onToggleLayer(censusLayerId, isCensusVisible);
    }
  }, [selectedCensusField, layerVisibility, onToggleLayer]);

  // Handle toggling census fields without affecting other layers
  const handleCensusFieldToggle = (field: string) => {
    setSelectedCensusField((prevField) => (prevField === field ? null : field));
    updateLayerPaint('census-tracts', field);
  };

  // Function to update the paint property for census tracts based on the selected field
  const updateLayerPaint = (layerId: string, field: string) => {
    const layer = layersConfig.find((l) => l.id === layerId);
    if (layer && layer.fieldLegends && layer.fieldLegends[field]) {
      const legendConfig = layer.fieldLegends[field];
      const stepExpression: (string | number | any[])[] = ['step', ['get', field]]; // allow mixed array types

      // Build the step expression from the ranges
      const defaultColor = legendConfig.ranges[0].color;
      stepExpression.push(defaultColor);

      legendConfig.ranges.forEach((range, index) => {
        if (index === 0) return; // Skip the first range
        stepExpression.push(range.min);
        stepExpression.push(range.color);
      });

      layer.paint = {
        'fill-color': stepExpression,
        'fill-opacity': 0.7,
        'fill-outline-color': '#FFF',
      };
    }
  };

  const handleToggleLayer = (layerId: string) => {
    const updatedVisibility = !layerVisibility[layerId];
    setLayerVisibility({ ...layerVisibility, [layerId]: updatedVisibility });
    onToggleLayer(layerId, updatedVisibility);
  };

  // Function to generate the legend entries based on fieldLegends or layer legends
  const generateLegendEntries = (layer: LayerConfig, field?: string) => {
    const entries: { color: string; label: string }[] = [];

    if (field && layer.fieldLegends && layer.fieldLegends[field]) {
      const legendConfig = layer.fieldLegends[field];

      // We no longer add the legendLabel to entries since it's used as the card title
      legendConfig.ranges.forEach((range) => {
        entries.push({
          color: range.color,
          label: range.label,
        });
      });
    } else if (layer.ranges) {
      // For layers with ranges defined at the layer level
      // Include the legendLabel in the legend entries if defined
      if (layer.legendLabel) {
        entries.push({ color: '', label: layer.legendLabel });
      }

      layer.ranges.forEach((range) => {
        entries.push({
          color: range.color,
          label: range.label,
        });
      });
    } else {
      const paint = layer.paint as Record<string, any>; // casting to allow dynamic access

      // Handle 'step' expression in fill-color
      if (Array.isArray(paint?.['fill-color']) && paint['fill-color'][0] === 'step') {
        const values = paint['fill-color'];
        const stops = values.slice(3);

        for (let i = 0; i < stops.length; i += 2) {
          const stop = stops[i];
          const color = stops[i + 1];
          entries.push({
            color: color,
            label: `< ${stop}`,
          });
        }
      }

      // Handle 'match' expression in circle-color
      if (Array.isArray(paint?.['circle-color']) && paint['circle-color'][0] === 'match') {
        const values = paint['circle-color'];
        for (let i = 2; i < values.length - 1; i += 2) {
          const matchValue = values[i];
          const outputValue = values[i + 1];
          entries.push({
            label: matchValue,
            color: outputValue,
          });
        }
        // Handle default value
        const defaultValue = values[values.length - 1];
        entries.push({
          label: 'Others',
          color: defaultValue,
        });
      }
    }

    return entries;
  };

  return (
    <div className="p-2 bg-white shadow-md w-full overflow-y-scroll">
      <h3 className="text-base font-bold mb-2">Layer Manager</h3>

      {layersConfig.map((layer) => {
        if (layer.id === 'census-tracts') {
          return layer.fields?.map((field) => {
            const isFieldSelected = selectedCensusField === field;

            // Get the legendLabel to use as the card title
            const legendLabel = layer.fieldLegends && layer.fieldLegends[field]?.legendLabel;

            // Get the dynamically generated legend entries from layer config
            const legendEntries = generateLegendEntries(layer, field);

            return (
              <div key={field} className="mb-2">
                <Card className="rounded-md shadow">
                  <CardHeader className="p-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">
                        {legendLabel || field}
                      </CardTitle>
                      <Switch
                        checked={isFieldSelected}
                        onCheckedChange={() => handleCensusFieldToggle(field)}
                        style={isFieldSelected ? { backgroundColor: '#34D399' } : {}}
                      />
                    </div>
                  </CardHeader>

                  {/* Show the legend dynamically if the field is selected */}
                  {isFieldSelected && legendEntries.length > 0 && (
                    <CardContent className="p-2">
                      <ul>
                        {legendEntries.map((entry, index) => (
                          <li key={index} className="flex items-center mb-1">
                            <span
                              className="inline-block w-3 h-3 mr-1"
                              style={{ backgroundColor: entry.color }}
                            ></span>
                            <span className="text-xs">{entry.label}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  )}
                </Card>
              </div>
            );
          });
        }

        const isVisible = layerVisibility[layer.id];

        // Get the legend entries for the layer
        const legendEntries = generateLegendEntries(layer);

        const switchStyle =
          isVisible && legendEntries.length === 1 && legendEntries[0].color
            ? { backgroundColor: legendEntries[0].color }
            : {};

        return (
          <div key={layer.id} className="mb-2">
            <Card className="rounded-md shadow">
              <CardHeader className="p-2">
                <div className="flex items-center justify-between">
                  {/* Use layer.name as the card title for other layers */}
                  <CardTitle className="text-sm font-semibold">{layer.name}</CardTitle>
                  <Switch
                    checked={isVisible}
                    onCheckedChange={() => handleToggleLayer(layer.id)}
                    style={switchStyle}
                  />
                </div>
              </CardHeader>

              {/* Legend (Only shown if layer is visible and there are legend entries) */}
              {isVisible && legendEntries.length > 0 && (
                <CardContent className="p-2">
                  <ul>
                    {legendEntries.map((entry, index) => (
                      <li key={index} className="flex items-center mb-1">
                        {entry.color ? (
                          <>
                            <span
                              className="inline-block w-3 h-3 mr-1"
                              style={{ backgroundColor: entry.color }}
                            ></span>
                            <span className="text-xs">{entry.label}</span>
                          </>
                        ) : (
                          <span className="text-xs font-bold">{entry.label}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          </div>
        );
      })}
    </div>
  );
};

export default LayerManager;
