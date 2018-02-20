import * as d3Array from 'd3-array';
import * as d3Collection from 'd3-collection';
import * as d3Color from 'd3-color';
import * as d3Scale from 'd3-scale';
import * as _ from 'lodash';
import { createSelector } from 'reselect';
import {
  colorAsArray,
  createFlowColorScale,
  DEFAULT_DIMMED_OPACITY,
  getDefaultDimmedColor,
  getDefaultFlowMinColor,
  getDefaultLocationAreaConnectedColor,
  getDefaultLocationAreaHighlightedColor,
  getLocationCircleColors,
  opacityFloatToInteger,
} from './colorUtils';
import { Props } from './FlowMapLayer';
import {
  Flow,
  FlowAccessor,
  isDiffColors,
  Location,
  LocationAccessor,
  LocationCircle,
  LocationCircleType,
  NumberScale,
  RGBA,
} from './types';

export interface InputGetters {
  getLocationId: LocationAccessor<string>;
  getFlowOriginId: FlowAccessor<string>;
  getFlowDestId: FlowAccessor<string>;
  getFlowMagnitude: FlowAccessor<number>;
}

export interface LocationTotals {
  incoming: {
    [key: string]: number;
  };
  outgoing: {
    [key: string]: number;
  };
}

export interface LocationsById {
  [key: string]: Location;
}

export type PropsSelector<T> = (props: Props) => T;

export interface Selectors {
  getLocationsById: PropsSelector<LocationsById>;
  getSortedNonSelfFlows: PropsSelector<Flow[]>;
  getActiveFlows: PropsSelector<Flow[]>;
  getFlowThicknessScale: PropsSelector<NumberScale>;
  getMakeFlowLinesColorGetter: PropsSelector<(dimmed: boolean) => (flow: Flow) => RGBA>;
  getLocationTotalInGetter: PropsSelector<(location: Location) => number>;
  getLocationTotalOutGetter: PropsSelector<(location: Location) => number>;
  getLocationCircles: PropsSelector<LocationCircle[]>;
  getLocationCircleRadiusGetter: PropsSelector<(locCircle: LocationCircle) => number>;
  getLocationCircleColorGetter: PropsSelector<(flow: Flow) => RGBA>;
  getLocationAreaLineColorGetter: PropsSelector<() => RGBA>;
  getLocationAreaFillColorGetter: PropsSelector<(location: Location) => RGBA>;
}

const getColors = (props: Props) => props.colors;
const getLocationFeatures = (props: Props) => props.locations.features;
const getFlows = (props: Props) => props.flows;
const getHighlightedFlow = (props: Props) => props.highlightedFlow;
const getHighlightedLocationId = (props: Props) => props.highlightedLocationId;
const getSelectedLocationIds = (props: Props) => props.selectedLocationIds;
const getVaryFlowColorByMagnitude = (props: Props) => props.varyFlowColorByMagnitude;

export default function createSelectors({
  getLocationId,
  getFlowOriginId,
  getFlowDestId,
  getFlowMagnitude,
}: InputGetters): Selectors {
  const getLocationsById = createSelector(getLocationFeatures, locations =>
    d3Collection
      .nest<Location, Location | undefined>()
      .key(getLocationId)
      .rollup(_.head)
      .object(locations),
  );

  const getFilteredFlows = createSelector(getFlows, getSelectedLocationIds, (flows, selectedLocationIds) => {
    if (selectedLocationIds) {
      return flows.filter(
        flow =>
          _.includes(selectedLocationIds, getFlowOriginId(flow)) ||
          _.includes(selectedLocationIds, getFlowDestId(flow)),
      );
    }

    return flows;
  });

  const getNonSelfFlows = createSelector(getFilteredFlows, flows =>
    flows.filter(flow => getFlowOriginId(flow) !== getFlowDestId(flow)),
  );

  const getSortedNonSelfFlows = createSelector(getNonSelfFlows, flows =>
    _.orderBy(flows, [(f: Flow) => Math.abs(getFlowMagnitude(f)), 'desc']),
  );

  const getActiveFlows = createSelector(
    getSortedNonSelfFlows,
    getHighlightedFlow,
    getHighlightedLocationId,
    getSelectedLocationIds,
    (flows, highlightedFlow, highlightedLocationId, selectedLocationIds) => {
      if (highlightedFlow) {
        return flows.filter(
          flow =>
            getFlowOriginId(flow) === getFlowOriginId(highlightedFlow) &&
            getFlowDestId(flow) === getFlowDestId(highlightedFlow),
        );
      }

      if (highlightedLocationId) {
        return flows.filter(
          flow => getFlowOriginId(flow) === highlightedLocationId || getFlowDestId(flow) === highlightedLocationId,
        );
      }

      if (selectedLocationIds) {
        return flows.filter(
          flow =>
            _.includes(selectedLocationIds, getFlowOriginId(flow)) ||
            _.includes(selectedLocationIds, getFlowDestId(flow)),
        );
      }

      return flows;
    },
  );

  const getFlowMagnitudeExtent = createSelector(getNonSelfFlows, flows => d3Array.extent(flows, getFlowMagnitude));

  const getFlowThicknessScale = createSelector(getFlowMagnitudeExtent, ([minMagnitude, maxMagnitude]) => {
    const scale = d3Scale
      .scaleLinear()
      .range([0.05, 0.5])
      .domain([0, Math.max(Math.abs(minMagnitude || 0), Math.abs(maxMagnitude || 0))]);

    return (magnitude: number) => scale(Math.abs(magnitude));
  });

  const getFlowColorScale = createSelector(
    getColors,
    getFlowMagnitudeExtent,
    getVaryFlowColorByMagnitude,
    (colors, [minMagnitude, maxMagnitude], varyFlowColorByMagnitude) => {
      if (!varyFlowColorByMagnitude) {
        if (isDiffColors(colors)) {
          return (v: number) => (v >= 0 ? colors.positive.flows.max : colors.negative.flows.max);
        }

        return () => colors.flows.max;
      }

      if (isDiffColors(colors)) {
        const posScale = createFlowColorScale(
          [0, maxMagnitude || 0],
          [
            colors.positive.flows.min ? colors.positive.flows.min : getDefaultFlowMinColor(colors.positive.flows.max),
            colors.positive.flows.max,
          ],
        );
        const negScale = createFlowColorScale(
          [minMagnitude || 0, 0],
          [
            colors.negative.flows.max,
            colors.negative.flows.min ? colors.negative.flows.min : getDefaultFlowMinColor(colors.negative.flows.max),
          ],
        );

        return (magnitude: number) => (magnitude >= 0 ? posScale(magnitude) : negScale(magnitude));
      }

      const { max, min } = colors.flows;
      const scale = createFlowColorScale([0, maxMagnitude || 0], [min ? min : getDefaultFlowMinColor(max), max]);
      return (magnitude: number) => scale(magnitude);
    },
  );

  const getMakeFlowLinesColorGetter = createSelector(getColors, getFlowColorScale, (colors, flowColorScale) => {
    return (dimmed: boolean) => (flow: Flow) => {
      if (!dimmed) {
        return colorAsArray(flowColorScale(getFlowMagnitude(flow)));
      }

      const dimmedOpacity = colors.dimmedOpacity || DEFAULT_DIMMED_OPACITY;
      const { l } = d3Color.hcl(flowColorScale(getFlowMagnitude(flow)));
      return [l, l, l, opacityFloatToInteger(dimmedOpacity)] as RGBA;
    };
  });

  const getLocationTotals = createSelector(getLocationFeatures, getFilteredFlows, (locations, flows) =>
    flows.reduce<LocationTotals>(
      (acc, curr) => {
        const originId = getFlowOriginId(curr);
        const destId = getFlowDestId(curr);
        const magnitude = getFlowMagnitude(curr);
        acc.outgoing[originId] = (acc.outgoing[originId] || 0) + magnitude;
        acc.incoming[destId] = (acc.incoming[destId] || 0) + magnitude;
        return acc;
      },
      { incoming: {}, outgoing: {} },
    ),
  );

  const getLocationTotalInGetter = createSelector(getLocationTotals, ({ incoming }) => {
    return (location: Location) => incoming[getLocationId(location)] || 0;
  });

  const getLocationTotalOutGetter = createSelector(getLocationTotals, ({ outgoing }) => {
    return (location: Location) => outgoing[getLocationId(location)] || 0;
  });

  const getLocationCircles = createSelector(getLocationFeatures, locations =>
    _.flatMap(locations, location => [
      {
        location,
        type: LocationCircleType.OUTER,
      },
      {
        location,
        type: LocationCircleType.INNER,
      },
    ]),
  );

  const getLocationMaxAbsTotal = createSelector(
    getLocationFeatures,
    getLocationTotalInGetter,
    getLocationTotalOutGetter,
    (locations, getLocationTotalIn, getLocationTotalOut) => {
      const max = d3Array.max(locations, (location: Location) =>
        Math.max(Math.abs(getLocationTotalIn(location)), Math.abs(getLocationTotalOut(location))),
      );
      return max || 0;
    },
  );

  const getSizeScale = createSelector(getLocationMaxAbsTotal, maxTotal => {
    const scale = d3Scale
      .scalePow()
      .exponent(1 / 2)
      .domain([0, maxTotal])
      .range([0, 15]);

    return (v: number) => scale(Math.abs(v));
  });

  const getLocationCircleRadiusGetter = createSelector(
    getSizeScale,
    getLocationTotalInGetter,
    getLocationTotalOutGetter,
    (sizeScale, getLocationTotalIn, getLocationTotalOut) => {
      return ({ location, type }: LocationCircle) => {
        const getSide = type === LocationCircleType.INNER ? Math.min : Math.max;
        return sizeScale(getSide(getLocationTotalIn(location), getLocationTotalOut(location)));
      };
    },
  );

  const getLocationCircleColorGetter = createSelector(
    getColors,
    getHighlightedFlow,
    getHighlightedLocationId,
    getSelectedLocationIds,
    getLocationTotalInGetter,
    getLocationTotalOutGetter,
    (colors, highlightedFlow, highlightedLocationId, selectedLocationIds, getLocationTotalIn, getLocationTotalOut) => {
      return ({ location, type }: Flow) => {
        const isActive =
          (!highlightedLocationId && !highlightedFlow && !selectedLocationIds) ||
          highlightedLocationId === getLocationId(location) ||
          _.includes(selectedLocationIds, getLocationId(location)) ||
          (highlightedFlow &&
            (getLocationId(location) === getFlowOriginId(highlightedFlow) ||
              getLocationId(location) === getFlowDestId(highlightedFlow)));

        const totalIn = getLocationTotalIn(location);
        const totalOut = getLocationTotalOut(location);
        const isIncoming = type === LocationCircleType.OUTER && Math.abs(totalIn) > Math.abs(totalOut);

        const isPositive = (isIncoming === true && totalIn >= 0) || totalOut >= 0;
        const circleColors = getLocationCircleColors(colors, isPositive);
        if (!isActive) {
          return getDefaultDimmedColor(colors.dimmedOpacity);
        }

        if (type === LocationCircleType.INNER) {
          return colorAsArray(circleColors.inner);
        }

        if (isIncoming === true) {
          return colorAsArray(circleColors.incoming);
        }

        return colorAsArray(circleColors.outgoing);
      };
    },
  );

  const getLocationAreaLineColorGetter = createSelector(getColors, colors => {
    return () => colorAsArray(colors.locationAreas.outline);
  });

  const isLocationConnectedGetter = createSelector(
    getFilteredFlows,
    getHighlightedLocationId,
    getHighlightedFlow,
    getSelectedLocationIds,
    (flows, highlightedLocationId, highlightedFlow, selectedLocationIds) => {
      if (highlightedFlow) {
        return (id: string) => id === getFlowOriginId(highlightedFlow) || id === getFlowDestId(highlightedFlow);
      }

      if (highlightedLocationId) {
        const isRelated = (flow: Flow) => {
          const originId = getFlowOriginId(flow);
          const destId = getFlowDestId(flow);
          return (
            originId === highlightedLocationId ||
            _.includes(selectedLocationIds, originId) ||
            destId === highlightedLocationId ||
            _.includes(selectedLocationIds, destId)
          );
        };

        const locations = new Set();
        for (const flow of flows) {
          if (isRelated(flow)) {
            locations.add(getFlowOriginId(flow));
            locations.add(getFlowDestId(flow));
          }
        }

        return (id: string) => locations.has(id);
      }

      return () => false;
    },
  );

  const getLocationAreaFillColorGetter = createSelector(
    getColors,
    getSelectedLocationIds,
    getHighlightedLocationId,
    isLocationConnectedGetter,
    (colors, selectedLocationIds, highlightedLocationId, isLocationConnected) => {
      return (location: Location) => {
        const locationId = getLocationId(location);
        const { normal, selected, highlighted, connected } = colors.locationAreas;
        if (_.includes(selectedLocationIds, locationId)) {
          return colorAsArray(selected);
        }

        if (locationId === highlightedLocationId) {
          return colorAsArray(highlighted ? highlighted : getDefaultLocationAreaHighlightedColor(selected));
        }

        if (isLocationConnected(locationId) === true) {
          return colorAsArray(connected ? connected : getDefaultLocationAreaConnectedColor(normal));
        }

        return colorAsArray(normal);
      };
    },
  );

  return {
    getLocationsById,
    getSortedNonSelfFlows,
    getActiveFlows,
    getFlowThicknessScale,
    getMakeFlowLinesColorGetter,
    getLocationTotalInGetter,
    getLocationTotalOutGetter,
    getLocationCircles,
    getLocationCircleRadiusGetter,
    getLocationCircleColorGetter,
    getLocationAreaLineColorGetter,
    getLocationAreaFillColorGetter,
  };
}
