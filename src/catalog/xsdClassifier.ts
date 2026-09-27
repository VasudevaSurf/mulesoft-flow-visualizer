import { XMLParser } from 'fast-xml-parser';
import { ComponentDescriptor, ComponentKind } from '../parser/types';

export interface XsdParseResult {
  namespaceUri: string;
  prefix?: string;
  descriptors: ComponentDescriptor[];
}

/**
 * Determines if an element is a message source based on XSD substitutionGroup or naming patterns.
 */
export function isLikelySourceElement(name: string, substitutionGroup: string = ''): boolean {
  const lowerName = name.toLowerCase();
  const subLower = substitutionGroup.toLowerCase();

  // 1. Official Mule XSD substitution groups
  if (
    subLower.includes('message-source') ||
    subLower.includes('abstract-message-source') ||
    subLower.includes('abstractmessagesource') ||
    subLower.includes('inbound-endpoint') ||
    subLower.includes('abstract-inbound-endpoint')
  ) {
    return true;
  }

  // 2. Comprehensive source naming patterns across Mule connectors (HTTP, JMS, MQ, SAP, Kafka, Salesforce, etc.)
  if (
    lowerName.includes('listener') ||
    lowerName.includes('subscriber') ||
    lowerName.includes('subscribe') ||
    lowerName.includes('consumer') ||
    lowerName.includes('scheduler') ||
    lowerName.includes('trigger') ||
    lowerName.includes('inbound-endpoint') ||
    lowerName === 'poll' ||
    lowerName.startsWith('poll-') ||
    lowerName.endsWith('-poll') ||
    lowerName.startsWith('on-new') ||
    lowerName.startsWith('on-modified') ||
    lowerName.startsWith('on-deleted') ||
    lowerName.startsWith('on-updated') ||
    lowerName.startsWith('on-created') ||
    lowerName.startsWith('on-table-row') ||
    lowerName.startsWith('on-row') ||
    lowerName.startsWith('on-message') ||
    lowerName === 'idoc-listener' ||
    lowerName.endsWith('-idoc-listener') ||
    lowerName.includes('idoc')
  ) {
    return true;
  }

  return false;
}

export class XsdClassifier {
  private static parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
  });

  /**
   * Parses an XSD content string and extracts component descriptors with kinds.
   */
  public static classifyXsd(xsdContent: string, iconId: string): XsdParseResult | null {
    try {
      const parsed = this.parser.parse(xsdContent);
      const schema = parsed['xsd:schema'] || parsed['xs:schema'] || parsed['schema'];
      if (!schema) {
        return null;
      }

      const targetNamespace = schema['@_targetNamespace'] || '';
      if (!targetNamespace) {
        return null;
      }

      const rawElements = schema['xsd:element'] || schema['xs:element'] || schema['element'];
      if (!rawElements) {
        return { namespaceUri: targetNamespace, descriptors: [] };
      }

      const elements = Array.isArray(rawElements) ? rawElements : [rawElements];
      const descriptors: ComponentDescriptor[] = [];

      for (const el of elements) {
        const name = el['@_name'];
        if (!name || typeof name !== 'string') {
          continue;
        }

        const kind = this.classifyElement(name, el, schema);
        const displayName = this.formatDisplayName(name);

        const descriptor: ComponentDescriptor = {
          namespaceUri: targetNamespace,
          localName: name,
          kind,
          displayName,
          iconId,
        };

        if (kind === 'router') {
          descriptor.routeElementNames = ['route', 'when', 'otherwise', 'step'];
        }

        if (kind === 'source') {
          descriptor.subtitleAttribute = name.includes('listener') && (name.includes('http') || !name.includes(':')) ? 'path' : 'config-ref';
        } else if (name.includes('request') || name.includes('send')) {
          descriptor.subtitleAttribute = 'url';
        } else {
          descriptor.subtitleAttribute = 'config-ref';
        }

        descriptors.push(descriptor);
      }

      return {
        namespaceUri: targetNamespace,
        descriptors,
      };
    } catch (e) {
      console.error('Failed to parse XSD:', e);
      return null;
    }
  }

  private static classifyElement(name: string, el: any, schema: any): ComponentKind {
    const lowerName = name.toLowerCase();

    // Global config elements
    if (
      lowerName.endsWith('-config') ||
      lowerName.endsWith('config') ||
      lowerName.endsWith('-connection') ||
      lowerName.endsWith('connection')
    ) {
      return 'global-config';
    }

    const substitutionGroup = el['@_substitutionGroup'] || '';
    if (substitutionGroup.includes('global-definition') || substitutionGroup.includes('abstract-extension-config')) {
      return 'global-config';
    }

    // Source elements
    if (isLikelySourceElement(name, substitutionGroup)) {
      return 'source';
    }

    // Inspect content model / type definition
    const jsonStr = JSON.stringify(el);
    const complexTypeName = el['@_type'];
    let complexTypeJson = '';

    if (complexTypeName) {
      const typeKey = complexTypeName.includes(':') ? complexTypeName.split(':')[1] : complexTypeName;
      const rawTypes = schema['xsd:complexType'] || schema['xs:complexType'] || schema['complexType'];
      if (rawTypes) {
        const types = Array.isArray(rawTypes) ? rawTypes : [rawTypes];
        const match = types.find((t: any) => t['@_name'] === typeKey);
        if (match) {
          complexTypeJson = JSON.stringify(match);
        }
      }
    }

    const combinedStr = jsonStr + complexTypeJson;

    // Check for router: multiple routes or wrapper elements (route, when, otherwise)
    if (
      combinedStr.includes('abstract-message-processor') &&
      (combinedStr.includes('route') || combinedStr.includes('when') || combinedStr.includes('branch'))
    ) {
      return 'router';
    }

    // Check for scope: allows abstract-message-processor child chain
    if (combinedStr.includes('abstract-message-processor') || combinedStr.includes('abstractMessageProcessor')) {
      return 'scope';
    }

    // Default to leaf operation
    return 'operation';
  }

  public static formatDisplayName(localName: string): string {
    return localName
      .replace(/[-_]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .filter(s => s.length > 0)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
