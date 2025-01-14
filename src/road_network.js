"use strict";

var CityTour = CityTour || {};

CityTour.RoadNetwork = function(terrain) {
  var Intersection = function(x, z, height, surfaceType) {
    var edges = [];

    var addEdge = function(destinationX, destinationZ, edge) {
      var i;

      for(i = 0; i < edges.length; i++) {
        if (edges[i].destinationX === destinationX && edges[i].destinationZ === destinationZ) {
          edges[i].edge = edge;
          return;
        }
      }

      edges.push({ destinationX: destinationX, destinationZ: destinationZ, edge: edge});
    };

    var removeEdge = function(x, z) {
      var i, indexToRemove;

      for (i = 0; i < edges.length; i++) {
        if (edges[i].destinationX === x && edges[i].destinationZ == z) {
          indexToRemove = i;
        }
      }

      if (indexToRemove !== undefined) {
        edges.splice(indexToRemove, 1);
      }
    };

    var hasEdgeTo = function(destinationX, destinationZ, surfaceType) {
      var i;

      for (i = 0; i < edges.length; i++) {
        if (edges[i].destinationX === destinationX && edges[i].destinationZ === destinationZ) {
          if (surfaceType) {
            return edges[i].edge.surfaceType === surfaceType;
          }
          else {
            return true;
          }
        }
      }

      return false;
    };

    var getEdge = function(destinationX, destinationZ) {
      var i;

      for (i = 0; i < edges.length; i++) {
        if (edges[i].destinationX === destinationX && edges[i].destinationZ === destinationZ) {
          return edges[i].edge;
        }
      }

      return undefined;
    };

    return {
      getHeight: function() { return height; },
      getSurfaceType: function() { return surfaceType; },
      addEdge: addEdge,
      removeEdge: removeEdge,
      hasEdgeTo: hasEdgeTo,
      getEdge: getEdge,
      edgesFrom: function() { return edges; },
      edgeCount: function() { return edges.length; },
    };
  };


  var minColumn = Number.POSITIVE_INFINITY, maxColumn = Number.NEGATIVE_INFINITY, minRow = Number.POSITIVE_INFINITY, maxRow = Number.NEGATIVE_INFINITY;
  var intersections = [];
  for (var x = Math.ceil(terrain.minX()); x <= Math.floor(terrain.maxX()); x++) {
    intersections[x] = [];
  }


  var hasIntersection = function(x, z) {
    return intersections[x] !== undefined && intersections[x][z] !== undefined;
  };

  var getIntersectionHeight = function(x, z) {
    if (hasIntersection(x, z)) {
      return intersections[x][z].getHeight();
    }
    else {
      return undefined;
    }
  };

  var getRoadHeight = function(x, z) {
    var xIsExact = Math.floor(x) === x;
    var zIsExact = Math.floor(z) === z;
    var floor, ceil;

    if (xIsExact && zIsExact) {
      return getIntersectionHeight(x, z);
    }
    else if (xIsExact) {
      ceil = getIntersectionHeight(x, Math.ceil(z));
      floor = getIntersectionHeight(x, Math.floor(z));

      if (ceil !== undefined && floor !== undefined) {
        return CityTour.Math.lerp(floor, ceil, z - Math.floor(z));
      }
      else {
        return undefined;
      }
    }
    else if (zIsExact) {
      ceil = getIntersectionHeight(Math.ceil(x), z);
      floor = getIntersectionHeight(Math.floor(x), z);

      if (ceil !== undefined && floor !== undefined) {
        return CityTour.Math.lerp(floor, ceil, x - Math.floor(x));
      }
      else {
        return undefined;
      }
    }

    return undefined;
  };

  var getIntersectionSurfaceType = function(x, z) {
    if (hasIntersection(x, z)) {
      return intersections[x][z].getSurfaceType();
    }
    else {
      return false;
    }
  };

  var addEdge = function(x1, z1, x2, z2, nonTerrainHeight, distance, surfaceType) {
    var intersection1 = intersections[x1][z1];
    var intersection2 = intersections[x2][z2];
    var intersectionHeight, intersectionSurfaceType;
    var edge = { distance: distance, surfaceType: surfaceType };

    if (intersection1 === undefined) {
      intersectionHeight = (terrain.waterHeightAtCoordinates(x1, z1) === 0.0) ? terrain.heightAtCoordinates(x1, z1) : nonTerrainHeight;
      intersectionSurfaceType = (terrain.waterHeightAtCoordinates(x1, z1) === 0.0) ? CityTour.RoadNetwork.TERRAIN_SURFACE : CityTour.RoadNetwork.BRIDGE_SURFACE;
      intersection1 = Intersection(x1, z1, intersectionHeight, intersectionSurfaceType);
      intersections[x1][z1] = intersection1;
    }

    if (intersection2 === undefined) {
      intersectionHeight = (terrain.waterHeightAtCoordinates(x2, z2) === 0.0) ? terrain.heightAtCoordinates(x2, z2) : nonTerrainHeight;
      intersectionSurfaceType = (terrain.waterHeightAtCoordinates(x2, z2) === 0.0) ? CityTour.RoadNetwork.TERRAIN_SURFACE : CityTour.RoadNetwork.BRIDGE_SURFACE;
      intersection2 = Intersection(x2, z2, intersectionHeight, intersectionSurfaceType);
      intersections[x2][z2] = intersection2;
    }

    intersection1.addEdge(x2, z2, edge);
    intersection2.addEdge(x1, z1, edge);

    minColumn = Math.min(minColumn, x1, x2);
    maxColumn = Math.max(maxColumn, x1, x2);
    minRow = Math.min(minRow, z1, z2);
    maxRow = Math.max(maxRow, z1, z2);
  };

  var removeEdge = function(x1, z1, x2, z2) {
    var intersection1 = (intersections[x1] === undefined) ? undefined : intersections[x1][z1];
    var intersection2 = (intersections[x2] === undefined) ? undefined : intersections[x2][z2];

    if (intersection1 !== undefined) {
      intersection1.removeEdge(x2, z2);
      if (intersection1.edgeCount() === 0) {
        intersections[x1][z1] = undefined;
      }
    }
    if (intersection2 !== undefined) {
      intersection2.removeEdge(x1, z1);
      if (intersection2.edgeCount() === 0) {
        intersections[x2][z2] = undefined;
      }
    }
  };

  var hasEdgeBetween = function(x1, z1, x2, z2, surfaceType) {
    var intersection1 = (intersections[x1] === undefined) ? undefined : intersections[x1][z1];
    var intersection2 = (intersections[x2] === undefined) ? undefined : intersections[x2][z2];

    return intersection1 !== undefined &&
           intersection2 !== undefined &&
           intersection1.hasEdgeTo(x2, z2, surfaceType) && intersection2.hasEdgeTo(x1, z1, surfaceType);
  };

  var edgeBetween = function(x1, z1, x2, z2) {
    var intersection1 = (intersections[x1] === undefined) ? undefined : intersections[x1][z1];

    return (intersection1 === undefined) ? undefined : intersection1.getEdge(x2, z2);
  };

  var edgesFrom = function(x, z) {
    var intersection = (intersections[x] === undefined) ? undefined : intersections[x][z];

    return (intersection === undefined) ? undefined : intersection.edgesFrom();
  };


  return {
    hasIntersection: hasIntersection,
    getRoadHeight: getRoadHeight,
    getIntersectionSurfaceType: getIntersectionSurfaceType,
    addEdge: addEdge,
    removeEdge: removeEdge,
    hasEdgeBetween: hasEdgeBetween,
    edgeBetween: edgeBetween,
    edgesFrom: edgesFrom,
    minColumn: function() { return minColumn; },
    maxColumn: function() { return maxColumn; },
    minRow: function() { return minRow; },
    maxRow: function() { return maxRow; },
  };
};

CityTour.RoadNetwork.TERRAIN_SURFACE = 'terrain';
CityTour.RoadNetwork.BRIDGE_SURFACE = 'bridge';
