"use strict";

var CityTour = CityTour || {};

CityTour.VehicleController = function(terrain, roadNetwork, initial, initialTargetSceneX, initialTargetSceneZ) {
  var HALF_PI = Math.PI / 2.0;
  var TWO_PI = Math.PI * 2.0;

  var INITIAL_DESCENT = 'initial_descent';
  var DRIVING_MODE = 'driving';
  var HOVERING_MODE = 'hovering';
  var BIRDSEYE_MODE = 'birdseye';

  var HORIZONTAL_MOTION_DELTA = 0.2;
  var Y_ROTATION_DELTA = 0.03;
  var BIRDSEYE_Y = 150;
  var HOVERING_Y = 15;
  var BIRDSEYE_X_ROTATION = -(Math.PI / 3);
  var BIRDSEYE_X_ROTATION_DELTA = 0.0155140377955;


  var MINIMUM_HEIGHT_OFF_GROUND = 0.5;

  var xPosition = initial.positionX;
  var yPosition = initial.positionY;
  var zPosition = initial.positionZ;
  var xRotation = initial.rotationX;
  var yRotation = initial.rotationY;

  var targetSceneX = initial.positionX;
  var targetYPosition = initial.positionY;
  var targetSceneZ = initial.positionZ;
  var targetXRotation = initial.rotationX;
  var targetYRotation = initial.rotationY;

  var xMotionGenerator;
  var yMotionGenerator;
  var zMotionGenerator;
  var xRotationGenerator;
  var yRotationGenerator;

  var VERTICAL_MODE_DURATION_IN_FRAMES = 2000;
  var framesInCurrentVerticalMode = VERTICAL_MODE_DURATION_IN_FRAMES + 1;
  var verticalMode = INITIAL_DESCENT;

  var navigator;
  var pathFinder = new CityTour.PathFinder(roadNetwork);

  var InitialDescentNavigator = function() {
    return {
      targetMapX: function() { return CityTour.Coordinates.sceneXToMapX(initialTargetSceneX); },
      targetMapZ: function() { return CityTour.Coordinates.sceneZToMapZ(initialTargetSceneZ); },
      nextTarget: function() { },  //no-op
    };
  };


  var determineNextTargetPoint = function() {
    var xPositionDelta;
    var yPositionDelta;
    var zPositionDelta;
    var xRotationDelta;

    var distanceToTarget, framesUntilTarget;
    var oldTargetSceneX = targetSceneX;
    var oldTargetSceneZ = targetSceneZ;
    var angleBetweenStartAndTarget;

    if (verticalMode === BIRDSEYE_MODE) {
      targetYPosition = BIRDSEYE_Y;
      yPositionDelta = 2;
      targetXRotation = BIRDSEYE_X_ROTATION;
      xRotationDelta = BIRDSEYE_X_ROTATION_DELTA;
      navigator = new CityTour.AerialNavigator(roadNetwork, CityTour.Coordinates.sceneXToMapX(targetSceneX), CityTour.Coordinates.sceneZToMapZ(targetSceneZ));
    }
    else if (verticalMode === DRIVING_MODE) {
      targetYPosition = Number.NEGATIVE_INFINITY;
      yPositionDelta = 0.05;
      targetXRotation = 0.0;
      xRotationDelta = BIRDSEYE_X_ROTATION_DELTA;
      navigator = new CityTour.RoadNavigator(roadNetwork, pathFinder, CityTour.Coordinates.sceneXToMapX(targetSceneX), CityTour.Coordinates.sceneZToMapZ(targetSceneZ));
    }
    else if (verticalMode === HOVERING_MODE) {
      targetYPosition = HOVERING_Y;
      yPositionDelta = 2;
      xRotationDelta = BIRDSEYE_X_ROTATION_DELTA;
      targetXRotation = 0.0;
    }
    else if (verticalMode === INITIAL_DESCENT) {
      targetYPosition = BIRDSEYE_Y;
      targetXRotation = BIRDSEYE_X_ROTATION;
      navigator = new InitialDescentNavigator();
    }

    navigator.nextTarget();
    targetSceneX = CityTour.Coordinates.mapXToSceneX(navigator.targetMapX());
    targetSceneZ = CityTour.Coordinates.mapZToSceneZ(navigator.targetMapZ());

    if (verticalMode === INITIAL_DESCENT) {
      distanceToTarget = CityTour.Math.distanceBetweenPoints3D(xPosition, yPosition, zPosition, targetSceneX, targetYPosition, targetSceneZ);
      framesUntilTarget = Math.abs(distanceToTarget / HORIZONTAL_MOTION_DELTA);

      xPositionDelta = Math.abs(targetSceneX - xPosition) / framesUntilTarget;
      yPositionDelta = Math.abs(yPosition - targetYPosition) / framesUntilTarget;
      zPositionDelta = Math.abs(zPosition - targetSceneZ) / framesUntilTarget;
      xRotationDelta = Math.abs(initial.rotationX - targetXRotation) / framesUntilTarget;
    }
    else {
      angleBetweenStartAndTarget = Math.atan2(oldTargetSceneZ - targetSceneZ, targetSceneX - oldTargetSceneX);

      xPositionDelta = Math.abs(HORIZONTAL_MOTION_DELTA * Math.cos(angleBetweenStartAndTarget));
      zPositionDelta = Math.abs(HORIZONTAL_MOTION_DELTA * Math.sin(angleBetweenStartAndTarget));
    }

    determineRotationAngle(oldTargetSceneX, oldTargetSceneZ, targetSceneX, targetSceneZ);

    xRotationGenerator = new CityTour.ClampedLinearMotionGenerator(xRotation, targetXRotation, xRotationDelta);
    yRotationGenerator = new CityTour.ClampedLinearMotionGenerator(yRotation, targetYRotation, Y_ROTATION_DELTA);
    xMotionGenerator = new CityTour.ClampedLinearMotionGenerator(xPosition, targetSceneX, xPositionDelta);
    yMotionGenerator = new CityTour.ClampedLinearMotionGenerator(yPosition, targetYPosition, yPositionDelta);
    zMotionGenerator = new CityTour.ClampedLinearMotionGenerator(zPosition, targetSceneZ, zPositionDelta);
  };

  var determineRotationAngle = function(oldTargetSceneX, oldTargetSceneZ, targetSceneX, targetSceneZ) {
    var oldTargetYRotation = targetYRotation;

    var x = targetSceneX - oldTargetSceneX;
    var z = -(targetSceneZ - oldTargetSceneZ);
    var angle = Math.atan2(z, x);
    if (angle < HALF_PI) {
      angle += TWO_PI;
    }
    var rightHandedAngle = angle - HALF_PI;

    targetYRotation = rightHandedAngle;

    // Prevent turns wider than 180 degrees
    if ((oldTargetYRotation - targetYRotation) > Math.PI) {
      yRotation -= TWO_PI;
    }
    else if ((oldTargetYRotation - targetYRotation) < -Math.PI) {
      yRotation += TWO_PI;
    }
  };

  var isAtTargetPoint = function() {
    return yRotation === targetYRotation &&
           xPosition === targetSceneX &&
           zPosition === targetSceneZ;
  };

  var roadHeightAtCurrentPosition = function() {
    var mapX = CityTour.Coordinates.sceneXToMapX(xPosition);
    var mapZ = CityTour.Coordinates.sceneZToMapZ(zPosition);
    var roadHeight = roadNetwork.getRoadHeight(mapX, mapZ);

    if (roadHeight === undefined) {
      roadHeight = terrain.heightAtCoordinates(mapX, mapZ) || 0.0;
    }

    return roadHeight;
  };

  var tick = function() {
    if (isAtTargetPoint()) {
      if (framesInCurrentVerticalMode >= VERTICAL_MODE_DURATION_IN_FRAMES) {
        if (verticalMode === DRIVING_MODE || verticalMode === INITIAL_DESCENT) {
          verticalMode = BIRDSEYE_MODE;
        }
        else if (verticalMode === HOVERING_MODE) {
          verticalMode = DRIVING_MODE;
        }
        else if (verticalMode === BIRDSEYE_MODE) {
          verticalMode = HOVERING_MODE;
        }

        framesInCurrentVerticalMode = 0;
      }

      determineNextTargetPoint();
    }

    if (yRotation != targetYRotation) {
      yRotation = yRotationGenerator.next();
    }
    else {
      xPosition = xMotionGenerator.next();
      zPosition = zMotionGenerator.next();
    }

    yPosition = Math.max(yMotionGenerator.next(), roadHeightAtCurrentPosition() + MINIMUM_HEIGHT_OFF_GROUND);
    xRotation = xRotationGenerator.next();

    framesInCurrentVerticalMode += 1;
  };


  determineNextTargetPoint();

  return {
    xPosition: function() { return xPosition; },
    yPosition: function() { return yPosition; },
    zPosition: function() { return zPosition; },
    yRotation: function() { return yRotation; },
    xRotation: function() { return xRotation; },
    tick: tick,
  };
};
