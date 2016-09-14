"use strict";

var CityTour = CityTour || {};
CityTour.Scene = CityTour.Scene || {};

CityTour.Scene.Builder = function() {
  var sceneBuilder = {};

  sceneBuilder.build = function(terrain, roadNetwork, buildings) {
    var masterStartTime = new Date();

    var scene = new THREE.Scene();

    var terrainStartTime = new Date();
    var terrainMeshes = new CityTour.Scene.TerrainGeometryBuilder().build(terrain, roadNetwork);
    terrainMeshes.forEach(function(terrainMesh) {
      scene.add(terrainMesh);
    });
    var terrainEndTime = new Date();

    var roadStartTime = new Date();
    scene.add(new CityTour.Scene.RoadGeometryBuilder().build(terrain, roadNetwork));
    var roadEndTime = new Date();

    var buildingsStartTime = new Date();
    var buildingMeshes = new CityTour.Scene.BuildingGeometryBuilder().build(buildings);
    buildingMeshes.forEach(function(buildingMesh) {
      scene.add(buildingMesh);
    });
    var buildingsEndTime = new Date();

    var light = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
    light.position.set( 0, 500, 0 );
    scene.add(light);

    var directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(-1, 0.9, 0.9);
    scene.add(directionalLight);

    var masterEndTime = new Date();
    console.log("Time to generate scene geometry: " + (masterEndTime - masterStartTime) + "ms");
    console.log("  Terrain:   " + (terrainEndTime - terrainStartTime) + "ms");
    console.log("  Roads:     " + (roadEndTime - roadStartTime) + "ms");
    console.log("  Buildings: " + (buildingsEndTime - buildingsStartTime) + "ms");

    return scene;
  };

  return sceneBuilder;
};