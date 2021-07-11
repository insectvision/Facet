import {AngularViewController} from './angular-view.controller.js';
const electron = require('electron');

let view;

electron.ipcRenderer.on('update', (event, message) => {
  const data = message.data;
  const cols = message.cols;
  view.update(data, cols);
});

window.onload = function () {
  const canvas = document.getElementById('angular-canvas');
  // paper.install(window);
  view = new AngularViewController(canvas);
};
