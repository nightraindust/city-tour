"use strict";

var CityTour = CityTour || {};

CityTour.VehicleController = function(terrain, roadNetwork, initial, initialTargetX, initialTargetZ) {
  var HALF_PI = Math.PI / 2.0;
  var TWO_PI = Math.PI * 2.0;

  var INITIAL_DESCENT = 'initial_descent';
  var DRIVING_MODE = 'driving';
  var HOVERING_MODE = 'hovering';
  var BIRDSEYE_MODE = 'birdseye';

  var DRIVING_HORIZONTAL_MOTION_DELTA = 0.016666666666667;
  var FLYING_HORIZONTAL_MOTION_DELTA = 0.025;
  var BIRDSEYE_Y = 12.5;
  var HOVERING_Y = 1.25;
  var POSITION_Y_DELTA = 0.166666666666667;
  var HOVER_TO_DRIVING_POSITION_Y_DELTA = 0.004166666666667;
  var BIRDSEYE_X_ROTATION = -(Math.PI / 3);
  var BIRDSEYE_X_ROTATION_DELTA = 0.0155140377955;
  var ROTATION_Y_DELTA = 0.03;

  var MODE_TRANSITIONS = {};
  MODE_TRANSITIONS[INITIAL_DESCENT] = DRIVING_MODE;
  MODE_TRANSITIONS[BIRDSEYE_MODE] = HOVERING_MODE;
  MODE_TRANSITIONS[HOVERING_MODE] = DRIVING_MODE;
  MODE_TRANSITIONS[DRIVING_MODE] = BIRDSEYE_MODE;

  var MINIMUM_HEIGHT_OFF_GROUND = 0.041666666666667;

  var positionX = initial.positionX;
  var positionY = initial.positionY;
  var positionZ = initial.positionZ;
  var rotationX = initial.rotationX;
  var rotationY = initial.rotationY;

  var animations;

  var VERTICAL_MODE_DURATION_IN_FRAMES = 2000;
  var framesInCurrentVerticalMode = VERTICAL_MODE_DURATION_IN_FRAMES + 1;
  var verticalMode = INITIAL_DESCENT;

  var navigator;
  var aerialNavigator;
  var pathFinder = new CityTour.PathFinder(roadNetwork);


  var frameCount = function(start, target, delta) {
    if (delta < 0) {
      console.warn("Animation delta (" + delta + ") less than zero, will never complete!");
    }

    return Math.ceil(Math.abs(target - start) / delta);
  };

  var atan2AngleToViewAngle = function(atan2Angle) {
    if (atan2Angle >= 0) {
      return atan2Angle - HALF_PI;
    }
    else if (atan2Angle < 0) {
      return atan2Angle + TWO_PI;
    }
  };

  var buildIntroAnimations = function(initial, targetPositionX, targetPositionZ) {
    var targetPositionY, targetRotationX, targetRotationY;
    var frameCountPositionX, frameCountPositionY, frameCountPositionZ, frameCountRotationX, frameCountRotationY;
    var positionXGenerator, positionYGenerator, positionZGenerator, rotationXGenerator, rotationYGenerator;
    var distanceToTarget;
    var descentTargetX, descentTargetZ;
    var descentTargetPositionX, descentTargetPositionY, descentTargetPositionZ;
    var drivingTargetX, drivingTargetZ;
    var drivingTargetPositionX, drivingTargetPositionZ, drivingTargetRotationY;
    var diveFrameCount;
    var newAnimations = [];
    var drivingAnimations;

    var angleOfPositionToCityCenter = Math.atan2(-(initial.positionZ - targetPositionZ), initial.positionX - targetPositionX) + Math.PI;
    var viewAngleToCityCenter = atan2AngleToViewAngle(angleOfPositionToCityCenter);

    // Prevent turns wider than 180 degrees
    if ((initial.rotationY - viewAngleToCityCenter) > Math.PI) {
      viewAngleToCityCenter += TWO_PI;
    }
    else if ((initial.rotationY - viewAngleToCityCenter) < -Math.PI) {
      viewAngleToCityCenter -= TWO_PI;
    }

    var positiveViewAngleToCityCenter = viewAngleToCityCenter;
    if (positiveViewAngleToCityCenter < 0) {
      positiveViewAngleToCityCenter += TWO_PI;
    }

    if (positiveViewAngleToCityCenter >= ((7 * Math.PI) / 4) || positiveViewAngleToCityCenter < (Math.PI / 4)) {  // Moving north-ish
      descentTargetX = 0;
      descentTargetZ = -3;
      drivingTargetX = 0;
      drivingTargetZ = -6;
    }
    else if (positiveViewAngleToCityCenter >= (Math.PI / 4) && positiveViewAngleToCityCenter < ((3 * Math.PI) / 4)) {  // Moving west-ish
      descentTargetX = -3;
      descentTargetZ = 0;
      drivingTargetX = -6;
      drivingTargetZ = 0;
    }
    else if (positiveViewAngleToCityCenter >= ((3 * Math.PI) / 4) && positiveViewAngleToCityCenter < ((5 * Math.PI) / 4)) { // Moving south-ish
      descentTargetX = 0;
      descentTargetZ = 3;
      drivingTargetX = 0;
      drivingTargetZ = 6;
    }
    else if (positiveViewAngleToCityCenter >= ((5 * Math.PI) / 4) && positiveViewAngleToCityCenter < ((7 * Math.PI) / 4)) { // Moving east-ish
      descentTargetX = 3;
      descentTargetZ = 0;
      drivingTargetX = 6;
      drivingTargetZ = 0;
    }

    // Prevent attempting to navigate to non-existent road intersection, which will cause things to blow up
    if (!roadNetwork.hasIntersection(descentTargetX, descentTargetZ) || !roadNetwork.hasIntersection(drivingTargetX, drivingTargetZ)) {
      descentTargetX = 0;
      descentTargetZ = 0;
      drivingTargetX = 0;
      drivingTargetZ = 0;
    }


    targetPositionY = BIRDSEYE_Y;
    targetRotationX = -Math.PI / 2;
    targetRotationY = viewAngleToCityCenter;

    distanceToTarget = CityTour.Math.distanceBetweenPoints3D(initial.positionX, initial.positionY, initial.positionZ, targetPositionX, targetPositionY, targetPositionZ);

    frameCountPositionX = Math.ceil(distanceToTarget / DRIVING_HORIZONTAL_MOTION_DELTA);
    frameCountPositionX = CityTour.Math.clamp(frameCountPositionX, 60, 3 * 60);
    frameCountPositionY = frameCountPositionX;
    frameCountPositionZ = frameCountPositionX;
    frameCountRotationX = frameCountPositionX;
    frameCountRotationY = CityTour.Math.clamp(frameCount(initial.rotationY, targetRotationY, 0.008), 60, frameCountPositionX);

    // Move to point above center of the city, looking straight down
    positionXGenerator = new CityTour.MotionGenerator(initial.positionX, targetPositionX, new CityTour.LinearEasing(frameCountPositionX));
    positionYGenerator = new CityTour.MotionGenerator(initial.positionY, targetPositionY, new CityTour.SmoothStepEasing(frameCountPositionY));
    positionZGenerator = new CityTour.MotionGenerator(initial.positionZ, targetPositionZ, new CityTour.LinearEasing(frameCountPositionZ));
    rotationXGenerator = new CityTour.MotionGenerator(initial.rotationX, targetRotationX, new CityTour.SmoothStepEasing(frameCountRotationX, -1.0, 0.0));
    rotationYGenerator = new CityTour.MotionGenerator(initial.rotationY, targetRotationY, new CityTour.SineEasing(frameCountRotationY, 0, HALF_PI));
    newAnimations.push(new CityTour.Animation(positionXGenerator, positionYGenerator, positionZGenerator, rotationXGenerator, rotationYGenerator));

    descentTargetPositionX = targetPositionX + descentTargetX;
    descentTargetPositionZ = targetPositionZ + descentTargetZ;
    descentTargetPositionY = roadNetwork.getRoadHeight(descentTargetPositionX, descentTargetPositionZ);

    drivingTargetPositionX = targetPositionX + drivingTargetX;
    drivingTargetPositionZ = targetPositionZ + drivingTargetZ;
    drivingTargetRotationY = determineAzimuthAngle(targetPositionX, targetPositionZ, targetRotationY, drivingTargetPositionX, drivingTargetPositionZ);

    diveFrameCount = 105;

    // Dive to ground level, and rotate to initial driving X/Y rotation
    newAnimations.push(new CityTour.Animation(new CityTour.MotionGenerator(targetPositionX, descentTargetPositionX, new CityTour.LinearEasing(diveFrameCount)),
                                              new CityTour.MotionGenerator(descentTargetPositionY, targetPositionY, new CityTour.SteepEasing(diveFrameCount, 0.0, 1.0)),
                                              new CityTour.MotionGenerator(targetPositionZ, descentTargetPositionZ, new CityTour.LinearEasing(diveFrameCount)),
                                              new CityTour.MotionGenerator(targetRotationX, 0.0, new CityTour.SineEasing(diveFrameCount, 0.0, HALF_PI)),
                                              new CityTour.MotionGenerator(targetRotationY, drivingTargetRotationY, new CityTour.SineEasing(diveFrameCount, 0.0, HALF_PI))));

    // Drive to target point
    drivingAnimations = buildDrivingAnimations({ positionX: descentTargetPositionX,
                                                 positionY: descentTargetPositionY,
                                                 positionZ: descentTargetPositionZ,
                                                 rotationX: 0.0,
                                                 rotationY: drivingTargetRotationY, },
                                               drivingTargetPositionX,
                                               drivingTargetPositionZ);


    return newAnimations.concat(drivingAnimations);
  };

  var buildBirdsEyeAnimations = function(initial, targetPositionX, targetPositionZ) {
    var targetPositionY, targetRotationX, targetRotationY;
    var frameCountPositionX, frameCountPositionY, frameCountPositionZ, frameCountRotationX, frameCountRotationY;
    var positionXStationaryGenerator, positionYStationaryGenerator, positionZStationaryGenerator, rotationXStationaryGenerator, rotationYStationaryGenerator;
    var positionXGenerator, positionYGenerator, positionZGenerator, rotationXGenerator, rotationYGenerator;
    var newAnimations = [];

    frameCountPositionX = Math.ceil(CityTour.Math.distanceBetweenPoints(initial.positionX, initial.positionZ, targetPositionX, targetPositionZ) / FLYING_HORIZONTAL_MOTION_DELTA);
    frameCountPositionZ = frameCountPositionX;

    targetRotationY = determineAzimuthAngle(initial.positionX, initial.positionZ, initial.rotationY, targetPositionX, targetPositionZ);
    frameCountRotationY = frameCount(initial.rotationY, targetRotationY, ROTATION_Y_DELTA);

    targetPositionY = BIRDSEYE_Y;
    targetRotationX = BIRDSEYE_X_ROTATION;

    frameCountPositionY = frameCount(initial.positionY, targetPositionY, POSITION_Y_DELTA);
    frameCountRotationX = frameCount(initial.rotationX, targetRotationX, BIRDSEYE_X_ROTATION_DELTA);

    positionXStationaryGenerator = new CityTour.StaticMotionGenerator(initial.positionX);
    positionYStationaryGenerator = new CityTour.StaticMotionGenerator(initial.positionY);
    positionZStationaryGenerator = new CityTour.StaticMotionGenerator(initial.positionZ);
    rotationXStationaryGenerator = new CityTour.StaticMotionGenerator(initial.rotationX);
    rotationYStationaryGenerator = new CityTour.StaticMotionGenerator(targetRotationY);

    positionXGenerator = new CityTour.MotionGenerator(initial.positionX, targetPositionX, new CityTour.LinearEasing(frameCountPositionX));
    positionYGenerator = new CityTour.MotionGenerator(initial.positionY, targetPositionY, new CityTour.LinearEasing(frameCountPositionY));
    positionZGenerator = new CityTour.MotionGenerator(initial.positionZ, targetPositionZ, new CityTour.LinearEasing(frameCountPositionZ));
    rotationXGenerator = new CityTour.MotionGenerator(targetRotationX, initial.rotationX, new CityTour.SteepEasing(frameCountRotationX, 0.0, 1.0));
    rotationYGenerator = new CityTour.MotionGenerator(initial.rotationY, targetRotationY, new CityTour.LinearEasing(frameCountRotationY));

    // Y rotation
    newAnimations.push(new CityTour.Animation(positionXStationaryGenerator,
                                              positionYStationaryGenerator,
                                              positionZStationaryGenerator,
                                              rotationXStationaryGenerator,
                                              rotationYGenerator));

    // Rest of the movement
    newAnimations.push(new CityTour.Animation(positionXGenerator,
                                              positionYGenerator,
                                              positionZGenerator,
                                              rotationXGenerator,
                                              rotationYStationaryGenerator));


    return newAnimations;
  };

  var buildHoveringAnimations = function(initial, targetPositionX, targetPositionZ) {
    var targetPositionY, targetRotationX, targetRotationY;
    var frameCountPositionX, frameCountPositionY, frameCountPositionZ, frameCountRotationX, frameCountRotationY;
    var positionXStationaryGenerator, positionYStationaryGenerator, positionZStationaryGenerator, rotationXStationaryGenerator, rotationYStationaryGenerator;
    var positionXGenerator, positionYGenerator, positionZGenerator, rotationXGenerator, rotationYGenerator;
    var newAnimations = [];

    frameCountPositionX = Math.ceil(CityTour.Math.distanceBetweenPoints(initial.positionX, initial.positionZ, targetPositionX, targetPositionZ) / FLYING_HORIZONTAL_MOTION_DELTA);
    frameCountPositionZ = frameCountPositionX;

    targetRotationY = determineAzimuthAngle(initial.positionX, initial.positionZ, initial.rotationY, targetPositionX, targetPositionZ);
    frameCountRotationY = frameCount(initial.rotationY, targetRotationY, ROTATION_Y_DELTA);

    targetPositionY = HOVERING_Y;
    targetRotationX = 0.0;

    frameCountPositionY = frameCount(initial.positionY, targetPositionY, POSITION_Y_DELTA);
    frameCountRotationX = frameCount(initial.rotationX, targetRotationX, BIRDSEYE_X_ROTATION_DELTA);

    positionXStationaryGenerator = new CityTour.StaticMotionGenerator(initial.positionX);
    positionYStationaryGenerator = new CityTour.StaticMotionGenerator(initial.positionY);
    positionZStationaryGenerator = new CityTour.StaticMotionGenerator(initial.positionZ);
    rotationXStationaryGenerator = new CityTour.StaticMotionGenerator(initial.rotationX);
    rotationYStationaryGenerator = new CityTour.StaticMotionGenerator(targetRotationY);

    positionXGenerator = new CityTour.MotionGenerator(initial.positionX, targetPositionX, new CityTour.LinearEasing(frameCountPositionX));
    positionYGenerator = new CityTour.MotionGenerator(initial.positionY, targetPositionY, new CityTour.LinearEasing(frameCountPositionY));
    positionZGenerator = new CityTour.MotionGenerator(initial.positionZ, targetPositionZ, new CityTour.LinearEasing(frameCountPositionZ));
    rotationXGenerator = new CityTour.MotionGenerator(initial.rotationX, targetRotationX, new CityTour.SteepEasing(frameCountRotationX, -1.0, 0));
    rotationYGenerator = new CityTour.MotionGenerator(initial.rotationY, targetRotationY, new CityTour.LinearEasing(frameCountRotationY));

    // Y rotation
    newAnimations.push(new CityTour.Animation(positionXStationaryGenerator,
                                              positionYStationaryGenerator,
                                              positionZStationaryGenerator,
                                              rotationXStationaryGenerator,
                                              rotationYGenerator));

    // Rest of the movement
    newAnimations.push(new CityTour.Animation(positionXGenerator,
                                              positionYGenerator,
                                              positionZGenerator,
                                              rotationXGenerator,
                                              rotationYStationaryGenerator));

    return newAnimations;
  };

  var buildDrivingAnimations = function(initial, targetPositionX, targetPositionZ) {
    var targetPositionY, targetRotationX, targetRotationY;
    var frameCountPositionX, frameCountPositionY, frameCountPositionZ, frameCountRotationX, frameCountRotationY;
    var positionXStationaryGenerator, positionYStationaryGenerator, positionZStationaryGenerator, rotationXStationaryGenerator, rotationYStationaryGenerator;
    var positionXGenerator, positionYGenerator, positionZGenerator, rotationXGenerator, rotationYGenerator;
    var newAnimations = [];

    frameCountPositionX = Math.ceil(CityTour.Math.distanceBetweenPoints(initial.positionX, initial.positionZ, targetPositionX, targetPositionZ) / DRIVING_HORIZONTAL_MOTION_DELTA);
    frameCountPositionZ = frameCountPositionX;

    targetRotationY = determineAzimuthAngle(initial.positionX, initial.positionZ, initial.rotationY, targetPositionX, targetPositionZ);
    frameCountRotationY = frameCount(initial.rotationY, targetRotationY, ROTATION_Y_DELTA);

    targetPositionY = initial.positionY - (HOVER_TO_DRIVING_POSITION_Y_DELTA * frameCountPositionX);
    targetRotationX = 0.0;

    frameCountPositionY = frameCount(initial.positionY, targetPositionY, HOVER_TO_DRIVING_POSITION_Y_DELTA);
    frameCountRotationX = frameCount(initial.rotationX, targetRotationX, BIRDSEYE_X_ROTATION_DELTA);

    positionXStationaryGenerator = new CityTour.StaticMotionGenerator(initial.positionX);
    positionYStationaryGenerator = new CityTour.StaticMotionGenerator(initial.positionY);
    positionZStationaryGenerator = new CityTour.StaticMotionGenerator(initial.positionZ);
    rotationXStationaryGenerator = new CityTour.StaticMotionGenerator(initial.rotationX);
    rotationYStationaryGenerator = new CityTour.StaticMotionGenerator(targetRotationY);

    positionXGenerator = new CityTour.MotionGenerator(initial.positionX, targetPositionX, new CityTour.LinearEasing(frameCountPositionX));
    positionYGenerator = new CityTour.MotionGenerator(initial.positionY, targetPositionY, new CityTour.LinearEasing(frameCountPositionY));
    positionZGenerator = new CityTour.MotionGenerator(initial.positionZ, targetPositionZ, new CityTour.LinearEasing(frameCountPositionZ));
    rotationXGenerator = new CityTour.MotionGenerator(initial.rotationX, targetRotationX, new CityTour.LinearEasing(frameCountRotationX));
    rotationYGenerator = new CityTour.MotionGenerator(initial.rotationY, targetRotationY, new CityTour.LinearEasing(frameCountRotationY));

    // Y rotation
    newAnimations.push(new CityTour.Animation(positionXStationaryGenerator,
                                              positionYStationaryGenerator,
                                              positionZStationaryGenerator,
                                              rotationXStationaryGenerator,
                                              rotationYGenerator));

    // Rest of the movement
    newAnimations.push(new CityTour.Animation(positionXGenerator,
                                              positionYGenerator,
                                              positionZGenerator,
                                              rotationXGenerator,
                                              rotationYStationaryGenerator));

    return newAnimations;
  };

  var buildNextAnimations = function(targetPositionX, targetPositionZ) {
    var initial;

    initial = { positionX: positionX,
                positionY: positionY,
                positionZ: positionZ,
                rotationX: rotationX,
                rotationY: rotationY };

    if (verticalMode === INITIAL_DESCENT) {
      return buildIntroAnimations(initial, targetPositionX, targetPositionZ);
    }
    else if (verticalMode === BIRDSEYE_MODE) {
      return buildBirdsEyeAnimations(initial, targetPositionX, targetPositionZ);
    }
    else if (verticalMode === HOVERING_MODE) {
      return buildHoveringAnimations(initial, targetPositionX, targetPositionZ);
    }
    else if (verticalMode === DRIVING_MODE) {
      return buildDrivingAnimations(initial, targetPositionX, targetPositionZ);
    }

    return [];
  };

  var determineAzimuthAngle = function(oldTargetPositionX, oldTargetPositionZ, oldRotationY, targetPositionX, targetPositionZ) {
    var newTargetYRotation;

    var x = targetPositionX - oldTargetPositionX;
    var z = -(targetPositionZ - oldTargetPositionZ);
    var angle = Math.atan2(z, x);
    if (angle < HALF_PI) {
      angle += TWO_PI;
    }
    var rightHandedAngle = angle - HALF_PI;

    newTargetYRotation = rightHandedAngle;

    // Prevent turns wider than 180 degrees
    if ((oldRotationY - newTargetYRotation) > Math.PI) {
      newTargetYRotation += TWO_PI;
    }
    else if ((oldRotationY - newTargetYRotation) < -Math.PI) {
      newTargetYRotation -= TWO_PI;
    }

    return newTargetYRotation;
  };

  var roadHeightAtCurrentPosition = function() {
    var roadHeight = roadNetwork.getRoadHeight(positionX, positionZ);

    if (roadHeight === undefined) {
      roadHeight = terrain.heightAtCoordinates(positionX, positionZ) || 0.0;
    }

    return roadHeight;
  };

  var tick = function() {
    if (animations[0].finished()) {
      animations.splice(0, 1);

      if (animations.length === 0) {
        if (framesInCurrentVerticalMode >= VERTICAL_MODE_DURATION_IN_FRAMES) {
          verticalMode = MODE_TRANSITIONS[verticalMode];
          framesInCurrentVerticalMode = 0;

          if (verticalMode === BIRDSEYE_MODE || verticalMode === HOVERING_MODE) {
            if (aerialNavigator === undefined) {
              navigator = new CityTour.AerialNavigator(roadNetwork, positionX, positionZ);
              aerialNavigator = navigator;
            }
          }
          else if (verticalMode === DRIVING_MODE) {
            aerialNavigator = undefined;
            navigator = new CityTour.RoadNavigator(roadNetwork, pathFinder,positionX, positionZ);
          }
        }

        navigator.nextTarget();

        animations = buildNextAnimations(navigator.targetX(),
                                         navigator.targetZ());
      }
    }

    animations[0].tick();
    positionX = animations[0].positionX();
    positionY = Math.max(animations[0].positionY(), roadHeightAtCurrentPosition() + MINIMUM_HEIGHT_OFF_GROUND);
    positionZ = animations[0].positionZ();
    rotationX = animations[0].rotationX();
    rotationY = animations[0].rotationY();

    framesInCurrentVerticalMode += 1;
  };


  animations = buildNextAnimations(initialTargetX, initialTargetZ);

  return {
    positionX: function() { return positionX; },
    positionY: function() { return positionY; },
    positionZ: function() { return positionZ; },
    rotationX: function() { return rotationX; },
    rotationY: function() { return rotationY; },
    tick: tick,
  };
};
