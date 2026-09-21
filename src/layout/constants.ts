/**
 * src/layout/constants.ts
 *
 * Single exported constants object L for all layout dimensions and tuned pixel values.
 * Defined per Section 6.1 of the specification.
 */

export const L = {
  tile:        { w: 120, h: 92 },          // icon tile incl. label area
  tileIcon:    { size: 44 },
  tileGapX:    28,                         // horizontal gap between siblings in a chain
  laneMinH:    110,                        // minimum height of one horizontal lane

  scopePad:    { top: 34, right: 20, bottom: 20, left: 20 },  // top is larger: header strip
  routerPad:   { top: 34, right: 24, bottom: 20, left: 40 },  // left is larger: bracket gutter
  routeGapY:   16,                         // vertical gap between route lanes
  routeLabelH: 22,

  flowPad:     { top: 40, right: 24, bottom: 24, left: 24 },
  flowHeaderH: 32,
  sourceCompartmentW: 160,
  sourceDividerW: 12,
  errorBandHeaderH: 28,
  flowGapY:    48,                         // vertical gap between stacked flow boxes

  canvasPad:   40,
  bracketRadius: 8,
  laneStrokeW: 1.5,
  emptyPlaceholder: { w: 100, h: 90 },
} as const;

export type LayoutConstants = typeof L;
