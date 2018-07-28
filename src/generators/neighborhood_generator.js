"use strict";

var CityTour = CityTour || {};

CityTour.NeighborhoodGenerator = (function() {
  var MIN_DISTANCE_BETWEEN_NEIGHBORHOODS = 10;

  // The size of the square that is used to calculate the terrain flatness
  // around a given point. Each value should be an odd number.
  var NEIGHBORHOOD_CENTER_WIDTH = 9;
  var NEIGHBORHOOD_CENTER_DEPTH = 9;
  var FLATNESS_WINDOW_WIDTH_MARGIN = (NEIGHBORHOOD_CENTER_WIDTH - 1) / 2;
  var FLATNESS_WINDOW_DEPTH_MARGIN = (NEIGHBORHOOD_CENTER_DEPTH - 1) / 2;

  var calculateScores = function(terrain) {
    var scores = [];
    var score;
    var x, z;

    var minX = terrain.minMapX() + FLATNESS_WINDOW_WIDTH_MARGIN;
    var maxX = terrain.maxMapX() - FLATNESS_WINDOW_WIDTH_MARGIN;
    var minZ = terrain.minMapZ() + FLATNESS_WINDOW_DEPTH_MARGIN;
    var maxZ = terrain.maxMapZ() - FLATNESS_WINDOW_DEPTH_MARGIN;

    for (x = minX; x <= maxX; x++) {
      scores[x] = [];

      for (z = minZ; z <= maxZ; z++) {
        score = { flatness: Number.POSITIVE_INFINITY, centrality: Math.abs(x) + Math.abs(z) };
        if (terrain.waterHeightAtCoordinates(x, z) === 0.0) {
          score.flatness = averageHeightDifferenceAroundPoint(terrain, x, z);
        }

        scores[x][z] = score;
      }
    }

    return scores;
  };

  var averageHeightDifferenceAroundPoint = function(terrain, centerX, centerZ) {
    var centerHeight = terrain.landHeightAtCoordinates(centerX, centerZ);
    var pointCount = 0;
    var totalHeightDeltas = 0.0;
    var minX = Math.max(terrain.minMapX(), centerX - FLATNESS_WINDOW_WIDTH_MARGIN);
    var maxX = Math.min(terrain.maxMapX(), centerX + FLATNESS_WINDOW_WIDTH_MARGIN);
    var minZ = Math.max(terrain.minMapZ(), centerZ - FLATNESS_WINDOW_DEPTH_MARGIN);
    var maxZ = Math.min(terrain.maxMapZ(), centerZ + FLATNESS_WINDOW_DEPTH_MARGIN);
    var x, z;

    for (x = minX; x <= maxX; x++) {
      for (z = minZ; z <= maxZ; z++) {
        totalHeightDeltas += Math.abs(centerHeight - terrain.landHeightAtCoordinates(x, z));
        pointCount += 1;
      }
    }

    return totalHeightDeltas / pointCount;
  };

  var closestNeighborhoodDistance = function(neighborhoods, x, z) {
    var minDistanceToNeighborhood = Number.POSITIVE_INFINITY;
    var distanceToClosestNeighborhood;
    var i;

    if (neighborhoods.length === 0) {
      return 0;
    }

    for (i = 0; i < neighborhoods.length; i++) {
      distanceToClosestNeighborhood = CityTour.Math.distanceBetweenPoints(x, z, neighborhoods[i].centerX, neighborhoods[i].centerZ);
      if (distanceToClosestNeighborhood < minDistanceToNeighborhood) {
        minDistanceToNeighborhood = distanceToClosestNeighborhood;
      }
    }

    return minDistanceToNeighborhood;
  };

  var bestNeighborhoodSite = function(terrain, scores, neighborhoods) {
    var bestSiteCoordinates = { x: terrain.minMapX(), z: terrain.minMapZ() };
    var bestSiteScore = Number.POSITIVE_INFINITY;
    var score, scoreComponents;
    var distanceToClosestNeighborhood;
    var x, z;

    var minX = terrain.minMapX() + FLATNESS_WINDOW_WIDTH_MARGIN;
    var maxX = terrain.maxMapX() - FLATNESS_WINDOW_WIDTH_MARGIN;
    var minZ = terrain.minMapZ() + FLATNESS_WINDOW_DEPTH_MARGIN;
    var maxZ = terrain.maxMapZ() - FLATNESS_WINDOW_DEPTH_MARGIN;

    for (x = minX; x < maxX; x++) {
      for (z = minZ; z < maxZ; z++) {
        scoreComponents = scores[x][z];

        distanceToClosestNeighborhood = closestNeighborhoodDistance(neighborhoods, x, z);
        if (distanceToClosestNeighborhood < MIN_DISTANCE_BETWEEN_NEIGHBORHOODS) {
          distanceToClosestNeighborhood = 1000;
        }

        score = scoreComponents.centrality + (scoreComponents.flatness * 10) + distanceToClosestNeighborhood;

        if (score < bestSiteScore) {
          bestSiteScore = score;
          bestSiteCoordinates.x = x;
          bestSiteCoordinates.z = z;
        }
      }
    }

    return bestSiteCoordinates;
  };

  var generate = function(terrain, count) {
    var scores = calculateScores(terrain);
    var neighborhoods = [];
    var neighborhoodCenter;
    var i;

    for (i = 0; i < count; i++) {
      neighborhoodCenter = bestNeighborhoodSite(terrain, scores, neighborhoods);
      neighborhoods.push({ centerX: neighborhoodCenter.x, centerZ: neighborhoodCenter.z });
    }

    return neighborhoods;
  };

  return {
    generate: generate,
  };
})();
