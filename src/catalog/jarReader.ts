import * as fs from 'fs';
import JSZip from 'jszip';
import { ComponentDescriptor } from '../parser/types';
import { XsdClassifier } from './xsdClassifier';
import { IconStore } from './iconStore';

export interface JarExtensionMetadata {
  groupId: string;
  artifactId: string;
  version: string;
  name?: string;
  namespaceUri?: string;
  iconId: string;
  descriptors: ComponentDescriptor[];
}

export class JarReader {
  /**
   * Reads a mule-plugin jar file and extracts its XSD descriptors, icon, and artifact metadata.
   */
  public static async readJar(
    jarPath: string,
    groupId: string,
    artifactId: string,
    version: string
  ): Promise<JarExtensionMetadata | null> {
    if (!fs.existsSync(jarPath)) {
      return null;
    }

    try {
      const buffer = fs.readFileSync(jarPath);
      const zip = await JSZip.loadAsync(buffer);
      const iconId = `${groupId}:${artifactId}`;

      // 1. Read mule-artifact.json if present
      let extensionDisplayName = artifactId;
      const artifactJsonFile = zip.file('META-INF/mule-artifact/mule-artifact.json');
      if (artifactJsonFile) {
        try {
          const jsonStr = await artifactJsonFile.async('string');
          const parsed = JSON.parse(jsonStr);
          if (parsed.name) {
            extensionDisplayName = parsed.name;
          }
        } catch {
          // Ignore json parse error
        }
      }

      // 2. Read connector icon (META-INF/mule-artifact/icon.svg, icon/icon.svg, etc.)
      let foundIcon = false;
      const iconFile =
        zip.file('META-INF/mule-artifact/icon.svg') ||
        zip.file('icon/icon.svg') ||
        zip.file('icon.svg') ||
        zip.file('META-INF/icon.svg');

      if (iconFile) {
        try {
          const rawSvg = await iconFile.async('string');
          IconStore.sanitizeSvg(rawSvg, iconId);
          foundIcon = true;
        } catch (e) {
          console.warn(`Failed reading icon from ${jarPath}:`, e);
        }
      }

      // If no icon found, search for any .svg in the jar
      if (!foundIcon) {
        const svgEntries = zip.file(/\.svg$/i);
        const bestSvg = svgEntries.find((f) => f.name.toLowerCase().includes('icon')) || svgEntries[0];
        if (bestSvg) {
          try {
            const rawSvg = await bestSvg.async('string');
            IconStore.sanitizeSvg(rawSvg, iconId);
            foundIcon = true;
          } catch {
            // Ignore
          }
        }
      }

      // Fall back to generic connector or unknown icon if none present in jar
      if (!foundIcon) {
        // We will fallback to core:generic-operation icon at render time if needed
      }

      // 3. Find and parse XSD files in META-INF/
      const xsdFiles = zip.file(/META-INF\/.*\.xsd$/i);
      const allDescriptors: ComponentDescriptor[] = [];
      let detectedNamespaceUri: string | undefined;

      for (const xsdZipEntry of xsdFiles) {
        try {
          const xsdContent = await xsdZipEntry.async('string');
          const result = XsdClassifier.classifyXsd(xsdContent, iconId);
          if (result && result.descriptors.length > 0) {
            detectedNamespaceUri = result.namespaceUri;
            allDescriptors.push(...result.descriptors);
          }
        } catch (e) {
          console.warn(`Failed parsing XSD ${xsdZipEntry.name} in ${jarPath}:`, e);
        }
      }

      return {
        groupId,
        artifactId,
        version,
        name: extensionDisplayName,
        namespaceUri: detectedNamespaceUri,
        iconId,
        descriptors: allDescriptors,
      };
    } catch (e) {
      console.error(`Failed to read jar ${jarPath}:`, e);
      return null;
    }
  }
}
