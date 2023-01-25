import GPX from 'ol/format/GPX.js';
import Map from 'ol/Map.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import MultiLineString from 'ol/geom/MultiLineString.js';

import VectorSource from 'ol/source/Vector.js';
import View from 'ol/View.js';
import XYZ from 'ol/source/XYZ.js';
import { fromLonLat } from 'ol/proj.js';
import Polyline from 'ol/format/Polyline.js';

import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style.js';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer.js';
import { getVectorContext } from 'ol/render.js';

const key = 'aJq2zBOTAGQFyx8mZumw';
const attributions =
  '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>';

const raster = new TileLayer({
  source: new XYZ({
    attributions: attributions,
    url: 'https://api.maptiler.com/tiles/satellite/{z}/{x}/{y}.jpg?key=' + key,
    maxZoom: 20,
  }),
});

const center = fromLonLat([7.11477, 60.826863]);

const map = new Map({
  target: document.getElementById('map'),
  view: new View({
    center: center,
    zoom: 10,
    minZoom: 2,
    maxZoom: 19,
  }),
  layers: [raster],
});

const animstyles = {
  route: new Style({
    stroke: new Stroke({
      width: 4,
      color: [237, 212, 0, 0.8],
    }),
  }),
  geoMarker: new Style({
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({ color: 'black' }),
      stroke: new Stroke({
        color: 'white',
        width: 2,
      }),
    }),
  }),
};

const gpxstyle = {
  Point: new Style({
    image: new CircleStyle({
      fill: new Fill({
        color: 'rgba(255,255,0,0.4)',
      }),
      radius: 5,
      stroke: new Stroke({
        color: '#ff0',
        width: 1,
      }),
    }),
  }),
  LineString: new Style({
    stroke: new Stroke({
      color: '#f00',
      width: 13,
    }),
  }),
  MultiLineString: new Style({
    stroke: new Stroke({
      color: '#0f0',
      width: 3,
    }),
  }),
};
const gpxVectorSource = new VectorSource({
  url: 'FlamToFinse.gpx',
  format: new GPX(),
});

gpxVectorSource.on('change', function () {
  var features = gpxVectorSource.getFeatures();
  var lines = features.filter((f) => {
    const geometry = f.getGeometry();
    // const geoName = f.getGeometryName(); // It's "geometry"
    return geometry instanceof MultiLineString;
  });
  const geometry = lines[0].getGeometry();
  // const route = new Polyline(lines[0].clone().components);
  // const route = new Polyline({
  //   factor: 1e6,
  // }).readGeometry(lines.map((l) => l.getGeometry()));
  const route = geometry;
  const routeFeature = new Feature({
    type: 'route',
    geometry: route,
  });

  const position = new Point(route.getFirstCoordinate());
  const geoMarker = new Feature({
    type: 'geoMarker',
    geometry: position,
  });

  const routeGeoVectorLayer = new VectorLayer({
    source: new VectorSource({
      features: [routeFeature, geoMarker],
    }),
    style: function (feature) {
      return animstyles[feature.get('type')];
    },
  });

  map.addLayer(routeGeoVectorLayer);
  const speedInput = document.getElementById('speed');
  const startButton = document.getElementById('start-animation');
  let animating = false;
  let distance = 0;
  let lastTime;

  function moveFeature(event) {
    const speed = Number(speedInput.value);
    const time = event.frameState.time;
    const elapsedTime = time - lastTime;
    distance = (distance + (speed * elapsedTime) / 1e6) % 2;
    lastTime = time;

    const linestring = route.getLineString(0);
    const currentCoordinate = linestring.getCoordinateAt(
      distance > 1 ? 2 - distance : distance
    );
    position.setCoordinates(currentCoordinate);
    const vectorContext = getVectorContext(event);
    vectorContext.setStyle(animstyles.geoMarker);
    vectorContext.drawGeometry(position);
    // tell OpenLayers to continue the postrender animation
    map.render();
  }

  function startAnimation() {
    animating = true;
    lastTime = Date.now();
    startButton.textContent = 'Stop Animation';
    routeGeoVectorLayer.on('postrender', moveFeature);
    // hide geoMarker and trigger map render through change event
    geoMarker.setGeometry(null);
  }

  function stopAnimation() {
    animating = false;
    startButton.textContent = 'Start Animation';

    // Keep marker at current animation position
    geoMarker.setGeometry(position);
    routeGeoVectorLayer.un('postrender', moveFeature);
  }

  startButton.addEventListener('click', function () {
    if (animating) {
      stopAnimation();
    } else {
      startAnimation();
    }
  });
});

const gpxVectorLayer = new VectorLayer({
  source: gpxVectorSource,
  style: function (feature) {
    return gpxstyle[feature.getGeometry().getType()];
  },
});

map.addLayer(gpxVectorLayer);

const displayFeatureInfo = function (pixel) {
  const features = [];
  map.forEachFeatureAtPixel(pixel, function (feature) {
    features.push(feature);
  });
  if (features.length > 0) {
    const info = [];
    let i, ii;
    for (i = 0, ii = features.length; i < ii; ++i) {
      info.push(features[i].get('desc'));
    }
    document.getElementById('info').innerHTML = info.join(', ') || '(unknown)';
    map.getTarget().style.cursor = 'pointer';
  } else {
    document.getElementById('info').innerHTML = '&nbsp;';
    map.getTarget().style.cursor = '';
  }
};

map.on('pointermove', function (evt) {
  if (evt.dragging) {
    return;
  }
  const pixel = map.getEventPixel(evt.originalEvent);
  displayFeatureInfo(pixel);
});

map.on('click', function (evt) {
  displayFeatureInfo(evt.pixel);
});
