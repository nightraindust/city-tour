"use strict";

var CityTour = CityTour || {};

CityTour.Coordinates = (function() {
  var coordinates = {};

  coordinates.mapXToSceneX = function(mapX) {
    return mapX * CityTour.Config.BLOCK_AND_STREET_WIDTH;
  };

  coordinates.mapZToSceneZ = function(mapZ) {
    return mapZ * CityTour.Config.BLOCK_AND_STREET_DEPTH;
  };

  coordinates.sceneXToMapX = function(sceneX) {
    return sceneX / CityTour.Config.BLOCK_AND_STREET_WIDTH;
  };

  coordinates.sceneZToMapZ = function(sceneZ) {
    return sceneZ / CityTour.Config.BLOCK_AND_STREET_DEPTH;
  };

  return coordinates;
})();

CityTour.City = function(container) {
  var renderer, scene, camera, timer, animationManager;

  var detectWebGL = function() {
    if (!window.WebGLRenderingContext) {
      return false;
    }

    // Adapted from https://github.com/Modernizr/Modernizr/blob/master/feature-detects/webgl-extensions.js
    var canvas = document.createElement('canvas');
    var webgl_context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (webgl_context === null) {
      return false;
    }

    return true;
  };

  var generateWorldData = function() {
    var GENERATE_BUILDINGS = true;

    var combinedStartTime = new Date();

    var terrainStartTime = new Date();
    var terrain = CityTour.TerrainGenerator.generate(CityTour.Config.TERRAIN_COLUMNS, CityTour.Config.TERRAIN_ROWS);
    var terrainEndTime = new Date();

    var centerX = 0, centerZ = 0;
    while(terrain.materialAtCoordinates(centerX, centerZ) != CityTour.Terrain.LAND) {
      centerZ -= 1;
    }

    var roadStartTime = new Date();
    var roadNetwork = CityTour.RoadNetworkGenerator.generate(terrain, centerX, centerZ);
    var roadEndTime = new Date();

    var zonedBlocksStartTime = new Date();
    var zonedBlocks = (GENERATE_BUILDINGS) ? CityTour.ZonedBlockGenerator.generate(terrain, roadNetwork, centerX, centerZ) : false;
    var zonedBlocksEndTime = new Date();
    var buildingsStartTime = new Date();
    var buildings = (GENERATE_BUILDINGS) ? CityTour.BuildingsGenerator.generate(terrain, zonedBlocks) : false;
    var buildingsEndTime = new Date();

    var combinedEndTime = new Date();

    console.log("Time to generate world data: " + (combinedEndTime - combinedStartTime) + "ms");
    console.log("  Terrain:      " + (terrainEndTime - terrainStartTime) + "ms");
    console.log("  Road Network: " + (roadEndTime - roadStartTime) + "ms");
    console.log("  Lots:         " + (zonedBlocksEndTime - zonedBlocksStartTime) + "ms");
    console.log("  Buildings:    " + (buildingsEndTime - buildingsStartTime) + "ms");

    return {
      terrain: terrain,
      roadNetwork: roadNetwork,
      buildings: buildings,
      centerX: centerX,
      centerZ: centerZ,
    };
  };

  var init = function(onComplete) {
    var SKY_COLOR = 0x66ccff;

    if (!detectWebGL()) {
      document.getElementById("loading-message").innerText = "This page is not compatible with your browser, because it requires WebGL.";
      return;
    }

    var masterStartTime = new Date();
    var masterEndTime;

    // Generate abstract terrain, road network, building representations
    var worldData = generateWorldData();

    var sceneBuilder = new CityTour.Scene.Builder();
    scene = sceneBuilder.build(worldData.terrain, worldData.roadNetwork, worldData.buildings);

    var cameraPoleGeometry = new THREE.BoxGeometry(1, 1, 1);
    var cameraPoleMaterial = new THREE.MeshLambertMaterial({ color: new THREE.Color(1.0, 0.0, 1.0), });
    var cameraPole = new THREE.Mesh(cameraPoleGeometry, cameraPoleMaterial);

    // Build camera
    var VIEW_ANGLE = 45, DEFAULT_ASPECT = 1.0, NEAR = 0.1, FAR = 10000;
    camera = new THREE.PerspectiveCamera(VIEW_ANGLE, DEFAULT_ASPECT, NEAR, FAR);
    camera.lookAt(scene.position);

    cameraPole.add(camera);
    scene.add(cameraPole);

    // Build renderer
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1)
    renderer.setClearColor(SKY_COLOR, 1); 

    timer = new CityTour.Timer();
    animationManager = new CityTour.AnimationManager(worldData.terrain, worldData.roadNetwork, cameraPole, camera);
    timer.onTick = function(frameCount) {
      animationManager.tick(frameCount);
      renderer.render(scene, camera);
    }
    animationManager.init(worldData.centerX, worldData.centerZ);

    resize();

    animationManager.tick(1);
    renderer.render(scene, camera);
    container.appendChild(renderer.domElement);

    timer.start();
    masterEndTime = new Date();
    console.log("Time to generate world+scene: " + (masterEndTime - masterStartTime) + "ms");

    onComplete();
  };

  var resize = function() {
    var width = container.clientWidth;
    var height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);

    renderer.render(scene, camera);
  };

  var togglePause = function() {
    timer.togglePause();
  };

  var toggleDebug = function() {
    animationManager.toggleDebug();
  }

  var city = {};

  city.init = init;
  city.resize = resize;
  city.togglePause = togglePause;
  city.toggleDebug = toggleDebug;

  return city;
};
