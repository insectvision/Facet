import {FacetViewController} from './facet-view.controller.js';

const electron = require('electron');

let view;
let canvas;

electron.ipcRenderer.on('update', (event, message) => {
  const data = message.data;
  const saveData = message.saveData;
  if (view) {
    view.update(data, saveData);
  } else {
    view = new FacetViewController(canvas, data, saveData);
  }

});

window.onload = function () {
  canvas = document.getElementById('facet-canvas');
  // paper.install(window);
};