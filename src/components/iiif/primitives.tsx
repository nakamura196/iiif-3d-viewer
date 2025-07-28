// Custom IIIF primitive components to replace @samvera/clover-iiif/primitives
import React from 'react';

type IIIFLabel = string | string[] | Record<string, string | string[]>;

interface LabelProps {
  label: IIIFLabel;
  as?: string;
  className?: string;
}

export function Label({ label, as = 'span', className = '' }: LabelProps) {
  const Component = as as keyof React.JSX.IntrinsicElements;
  
  if (!label) return null;
  
  // Handle different label formats from IIIF
  let displayText = '';
  
  if (typeof label === 'string') {
    displayText = label;
  } else if (Array.isArray(label)) {
    displayText = label[0] || '';
  } else if (typeof label === 'object') {
    // Handle IIIF internationalized labels
    if (label.ja) {
      displayText = Array.isArray(label.ja) ? label.ja[0] : label.ja;
    } else if (label.en) {
      displayText = Array.isArray(label.en) ? label.en[0] : label.en;
    } else {
      // Get first available language
      const firstKey = Object.keys(label)[0];
      if (firstKey) {
        displayText = Array.isArray(label[firstKey]) ? label[firstKey][0] : label[firstKey];
      }
    }
  }
  
  return React.createElement(Component as any, { className }, displayText);
}

interface SummaryProps {
  summary: IIIFLabel;
  className?: string;
}

export function Summary({ summary, className = '' }: SummaryProps) {
  if (!summary) return null;
  
  let displayText = '';
  
  if (typeof summary === 'string') {
    displayText = summary;
  } else if (Array.isArray(summary)) {
    displayText = summary[0] || '';
  } else if (typeof summary === 'object') {
    // Handle IIIF internationalized summary
    if (summary.ja) {
      displayText = Array.isArray(summary.ja) ? summary.ja[0] : summary.ja;
    } else if (summary.en) {
      displayText = Array.isArray(summary.en) ? summary.en[0] : summary.en;
    } else {
      const firstKey = Object.keys(summary)[0];
      if (firstKey) {
        displayText = Array.isArray(summary[firstKey]) ? summary[firstKey][0] : summary[firstKey];
      }
    }
  }
  
  return <div className={className}>{displayText}</div>;
}

interface MetadataItem {
  label: IIIFLabel;
  value: IIIFLabel;
}

interface MetadataProps {
  metadata: MetadataItem[];
  className?: string;
}

export function Metadata({ metadata, className = '' }: MetadataProps) {
  if (!metadata || !Array.isArray(metadata)) return null;
  
  return (
    <div className={className}>
      {metadata.map((item, index) => (
        <div key={index} className="mb-2">
          <dt className="font-medium text-gray-700 dark:text-gray-300">
            <Label label={item.label} />
          </dt>
          <dd className="text-gray-900 dark:text-gray-100">
            <Label label={item.value} />
          </dd>
        </div>
      ))}
    </div>
  );
}

interface SeeAlsoItem {
  id?: string;
  label?: IIIFLabel;
}

interface SeeAlsoProps {
  seeAlso: (SeeAlsoItem | string)[];
  className?: string;
}

export function SeeAlso({ seeAlso, className = '' }: SeeAlsoProps) {
  if (!seeAlso || !Array.isArray(seeAlso)) return null;
  
  return (
    <div className={className}>
      {seeAlso.map((item, index) => (
        <div key={index} className="mb-1">
          {typeof item === 'object' && item.id ? (
            <a 
              href={item.id} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Label label={item.label || item.id} />
            </a>
          ) : (
            <Label label={typeof item === 'object' && item.label ? item.label : (item as string)} />
          )}
        </div>
      ))}
    </div>
  );
}

// Export types for compatibility
export interface PrimitivesExternalWebResource {
  id: string;
  label?: IIIFLabel;
  type?: string;
}