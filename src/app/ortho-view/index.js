const electron = require('electron');
import {OrthoViewController} from './ortho-view.controller.js';

let crossings = null;
let canvas = null;
let controller = null;

window.onload = () => {
  canvas = document.getElementById('ortho-canvas');
  controller = new OrthoViewController(canvas);
};

electron.ipcRenderer.on('update', (event, message) => {
  crossings = message.crossings;
  controller.update(crossings);
});

electron.ipcRenderer.on('export', (event, message) => {
  crossings = message.crossings;
  controller.createExportableImage(crossings);
});
