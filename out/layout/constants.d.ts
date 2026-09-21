/**
 * src/layout/constants.ts
 *
 * Single exported constants object L for all layout dimensions and tuned pixel values.
 * Defined per Section 6.1 of the specification.
 */
export declare const L: {
    readonly tile: {
        readonly w: 120;
        readonly h: 92;
    };
    readonly tileIcon: {
        readonly size: 44;
    };
    readonly tileGapX: 28;
    readonly laneMinH: 110;
    readonly scopePad: {
        readonly top: 34;
        readonly right: 20;
        readonly bottom: 20;
        readonly left: 20;
    };
    readonly routerPad: {
        readonly top: 34;
        readonly right: 24;
        readonly bottom: 20;
        readonly left: 40;
    };
    readonly routeGapY: 16;
    readonly routeLabelH: 22;
    readonly flowPad: {
        readonly top: 40;
        readonly right: 24;
        readonly bottom: 24;
        readonly left: 24;
    };
    readonly flowHeaderH: 32;
    readonly sourceCompartmentW: 160;
    readonly sourceDividerW: 12;
    readonly errorBandHeaderH: 28;
    readonly flowGapY: 48;
    readonly canvasPad: 40;
    readonly bracketRadius: 8;
    readonly laneStrokeW: 1.5;
    readonly emptyPlaceholder: {
        readonly w: 100;
        readonly h: 90;
    };
};
export type LayoutConstants = typeof L;
//# sourceMappingURL=constants.d.ts.map