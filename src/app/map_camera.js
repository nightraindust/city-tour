"use strict";

var CityTour = CityTour || {};

CityTour.MapCamera = function(sceneView, initialTerrain, messageBroker) {
  var PAN_VELOCITY_DECAY = 0.875;
  var ZOOM_VELOCITY_DECAY = 0.85;
  var TILT_ROTATION_VELOCITY_DECAY = 0.85;
  var AZIMUTH_ROTATION_VELOCITY_DECAY = 0.85;
  var MINIMUM_VELOCITY = 0.00001;
  var MINIMUM_HEIGHT_OFF_GROUND = 0.416666666666667;

  var MIN_TILT_ANGLE = -Math.PI / 2;
  var MAX_TILT_ANGLE = -0.1;

  var centerOfAction;
  var zoomProperties;
  var camera = sceneView.camera();
  var terrain = initialTerrain;

  var isVelocityEnabled = false;
  var panVelocityX = 0.0;
  var panVelocityZ = 0.0;
  var zoomVelocity = 0.0;
  var azimuthRotationVelocity = 0.0;
  var tiltRotationVelocity = 0.0;

  camera.position.x = -60;
  camera.position.y = 30;
  camera.position.z = 60;
  camera.lookAt(new THREE.Vector3(0.0, 0.0, 0.0));

  var setCenterOfAction = function(newCenterOfAction) {
    centerOfAction = newCenterOfAction;
    zoomProperties = undefined;

    sceneView.centerOfActionMarkerMesh().position.set(centerOfAction.x, centerOfAction.y, centerOfAction.z);
  };

  var minimumCameraHeightAtCoordinates = function(terrain, cameraX, cameraZ) {
    var terrainHeight = Number.NEGATIVE_INFINITY;

    if (terrain !== undefined) {
      terrainHeight = terrain.heightAtCoordinates(cameraX, cameraZ);
      if (terrainHeight === undefined) {
        terrainHeight = Number.NEGATIVE_INFINITY;
      }
    }

    return terrainHeight + MINIMUM_HEIGHT_OFF_GROUND;
  };

  var pan = function(distanceX, distanceZ) {
    camera.position.x -= distanceX;
    camera.position.z -= distanceZ;
    camera.position.y = Math.max(minimumCameraHeightAtCoordinates(terrain, camera.position.x, camera.position.z), camera.position.y);

    panVelocityX = distanceX;
    panVelocityZ = distanceZ;
  };

  var calculateZoomProperties = function() {
    var cameraToCenterOfActionVector, centerOfActionPercentageOfFullHeight, zoomEndPoint;

    // Vector of camera to intersection with terrain
    cameraToCenterOfActionVector = new THREE.Vector3((camera.position.x - centerOfAction.x),
                                                     (camera.position.y - centerOfAction.y),
                                                     (camera.position.z - centerOfAction.z));

    zoomProperties = {
      cameraToCenterOfActionVector: cameraToCenterOfActionVector,
    };
  };

  var zoomTowardCenterOfAction = function(zoomDistancePercentage) {
    if (zoomProperties === undefined) {
      calculateZoomProperties();
    }

    var distanceToCenterOfAction = CityTour.Math.distanceBetweenPoints3D(camera.position.x, camera.position.y, camera.position.z,
                                                                         centerOfAction.x, centerOfAction.y, centerOfAction.z);
    if (distanceToCenterOfAction <= 2.0 && zoomDistancePercentage > 0.0) {
      return;
    }
    if (distanceToCenterOfAction >= 50.0 && zoomDistancePercentage < 0.0) {
      return;
    }

    var clonedCameraToCenterOfActionVector = zoomProperties.cameraToCenterOfActionVector.clone();
    clonedCameraToCenterOfActionVector.multiplyScalar(zoomDistancePercentage);

    camera.position.x -= clonedCameraToCenterOfActionVector.x;
    camera.position.y -= clonedCameraToCenterOfActionVector.y;
    camera.position.z -= clonedCameraToCenterOfActionVector.z;
    camera.position.y = Math.max(minimumCameraHeightAtCoordinates(terrain, camera.position.x, camera.position.z), camera.position.y);
    zoomProperties.cameraToCenterOfActionVector = zoomProperties.cameraToCenterOfActionVector.clone().multiplyScalar(1.0 - zoomDistancePercentage);

    zoomVelocity = zoomDistancePercentage;
  };

  var rotateAzimuthAroundCenterOfAction = function(azimuthAngleDelta) {
    var distanceCameraToCenterOfAction = CityTour.Math.distanceBetweenPoints(camera.position.x, camera.position.z, centerOfAction.x, centerOfAction.z);
    var originalAngleCameraToCenterOfAction = Math.atan2(-(camera.position.z - centerOfAction.z), camera.position.x - centerOfAction.x);
    var newAngleCameraToCenterOfAction = originalAngleCameraToCenterOfAction + azimuthAngleDelta;

    zoomProperties = undefined;

    camera.position.x = (distanceCameraToCenterOfAction * Math.cos(newAngleCameraToCenterOfAction)) + centerOfAction.x;
    camera.position.z = -(distanceCameraToCenterOfAction * Math.sin(newAngleCameraToCenterOfAction)) + centerOfAction.z;
    camera.rotation.y += azimuthAngleDelta;
    if (camera.rotation.y > Math.PI) {
      camera.rotation.y -= Math.PI * 2;
    }
    else if (camera.rotation.y < -Math.PI) {
      camera.rotation.y += Math.PI * 2;
    }

    var minimumCameraY = minimumCameraHeightAtCoordinates(terrain, camera.position.x, camera.position.z);
    if (camera.position.y < minimumCameraY) {
      camera.position.y = minimumCameraY;
      centerOfAction.y = minimumCameraY;
      setCenterOfAction(centerOfAction);
    }

    azimuthRotationVelocity = azimuthAngleDelta;

    messageBroker.publish("camera.updated", {});
  };

  var tiltCamera = function(tiltAngleDelta) {
    var distanceCameraToCenterOfAction = CityTour.Math.distanceBetweenPoints3D(camera.position.x, camera.position.y, camera.position.z,
                                                                               centerOfAction.x, centerOfAction.y, centerOfAction.z);
    var newTiltAngle = CityTour.Math.clamp(camera.rotation.x + tiltAngleDelta, MIN_TILT_ANGLE, MAX_TILT_ANGLE);

    var hypotenuse = distanceCameraToCenterOfAction;
    var adjacent = Math.cos(newTiltAngle) * hypotenuse;
    var opposite = -Math.sin(newTiltAngle) * hypotenuse;

    var cameraX = (adjacent * Math.sin(camera.rotation.y));
    var cameraY = opposite;
    var cameraZ = (adjacent * Math.cos(-camera.rotation.y));

    zoomProperties = undefined;

    camera.position.x = centerOfAction.x + cameraX;
    camera.position.y = centerOfAction.y + cameraY;
    camera.position.z = centerOfAction.z + cameraZ;
    camera.rotation.x = newTiltAngle;

    tiltRotationVelocity = tiltAngleDelta;

    messageBroker.publish("camera.updated", {});
  };

  var tickVelocity = function(frameCount) {
    var i;

    for (i = 0; i < frameCount; i++) {
      panVelocityX *= PAN_VELOCITY_DECAY;
      panVelocityZ *= PAN_VELOCITY_DECAY;
      zoomVelocity *= ZOOM_VELOCITY_DECAY;
      azimuthRotationVelocity *= AZIMUTH_ROTATION_VELOCITY_DECAY;
      tiltRotationVelocity *= TILT_ROTATION_VELOCITY_DECAY;

      if (Math.abs(panVelocityX) > 0.0 || Math.abs(panVelocityZ) > 0.0) {
        pan(panVelocityX, panVelocityZ);
      }

      if (Math.abs(zoomVelocity) > 0.0) {
        zoomTowardCenterOfAction(zoomVelocity);
      }

      if (Math.abs(azimuthRotationVelocity) > 0.0) {
        rotateAzimuthAroundCenterOfAction(azimuthRotationVelocity);
      }

      if (Math.abs(tiltRotationVelocity) > 0.0) {
        tiltCamera(tiltRotationVelocity);
      }
    }

    if (Math.abs(panVelocityX) < MINIMUM_VELOCITY) {
      panVelocityX = 0.0;
    }
    if (Math.abs(panVelocityZ) < MINIMUM_VELOCITY) {
      panVelocityZ = 0.0;
    }
    if (Math.abs(zoomVelocity) < MINIMUM_VELOCITY) {
      zoomVelocity = 0.0;
    }
    if (Math.abs(azimuthRotationVelocity) < MINIMUM_VELOCITY) {
      azimuthRotationVelocity = 0.0;
    }
    if (Math.abs(tiltRotationVelocity) < MINIMUM_VELOCITY) {
      tiltRotationVelocity = 0.0;
    }

    if (panVelocityX === 0.0 &&
        panVelocityZ === 0.0 &&
        zoomVelocity === 0.0 &&
        azimuthRotationVelocity === 0.0 &&
        tiltRotationVelocity === 0.0) {
      isVelocityEnabled = false;
    }
  };

  var setIsVelocityEnabled = function(newIsVelocityEnabled) {
    isVelocityEnabled = newIsVelocityEnabled;

    if (newIsVelocityEnabled === false) {
      panVelocityX = 0.0;
      panVelocityZ = 0.0;
      zoomVelocity = 0.0;
      azimuthRotationVelocity = 0.0;
      tiltRotationVelocity = 0.0;
    }
  };


  return {
    centerOfAction: function() { return centerOfAction; },
    setCenterOfAction: setCenterOfAction,
    pan: pan,
    rotateAzimuthAroundCenterOfAction: rotateAzimuthAroundCenterOfAction,
    zoomTowardCenterOfAction: zoomTowardCenterOfAction,
    tiltCamera: tiltCamera,
    isVelocityEnabled: function() { return isVelocityEnabled; },
    setIsVelocityEnabled: setIsVelocityEnabled,
    tickVelocity: tickVelocity,
    positionX: function() { return camera.position.x; },
    positionY: function() { return camera.position.y; },
    positionZ: function() { return camera.position.z; },
    azimuthAngle: function() { return camera.rotation.y; },
    tiltAngle: function() { return camera.rotation.x; },
    minTiltAngle: function() { return MIN_TILT_ANGLE; },
    maxTiltAngle: function() { return MAX_TILT_ANGLE; },
    setTerrain: function(newTerrain) { terrain = newTerrain; },
  };
};
