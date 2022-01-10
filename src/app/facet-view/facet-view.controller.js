'use strict';
const { ipcRenderer, shell } = require('electron');
const remote = require('@electron/remote');
import {FacetGrid} from './facet-grid.js';
const paper = require('paper');

class FacetViewController {

  constructor(canvas, data, saveData) {
    this._selected = null;
    paper.setup(canvas);
    this._facetGrid = new FacetGrid(data, saveData);
    this.insertPoint = false;
    this._pointArray = [];
    this._hitColor = new paper.Color(1,0,0);
    this._pointColor = new paper.Color(0,0,0);

    // assign mouse event listeners
    paper.project.view.on('mousedown', event => this._mouseDownHandler(event));
    paper.project.view.on('mouseup', event => this._mouseUpHandler(event));
    paper.project.view.on('mousedrag', event => this._dragHandler(event));
    paper.project.view.on('click', event => this._clickHandler(event));
    // keyboard listener
    window.onkeyup = (e) => {
      if (e.code === 'Escape') { // esc
        // cancel operation
        this._cancelOperations();
      }
    };

    // document.getElementById('facet-canvas').addEventListener('wheel', event => this.wheelScale(event));

    //center origin in view
    const chg = new paper.Point(Math.round(paper.view.center.x), Math.round(paper.view.center.y));
    paper.project.activeLayer.translate(chg);
    this._facetGrid.origX += Math.round(paper.view.center.x);
    this._facetGrid.origY += Math.round(paper.view.center.y);

    ipcRenderer.on('insertData', (event, message) => {
      this.insertPoint = true;
      document.getElementById('facet-canvas').style.cursor = 'pointer';
    });
  }

  _cancelOperations(){
    this.insertPoint = false;
    this._pointArray = [];
    this._selected = null;
    document.body.style.cursor = 'auto';
    ipcRenderer.send('refresh-views');
  }

  // wheelScale(event) {

  //     let delta = (event.wheelDelta) ? -1 / 40 * event.wheelDelta : event.deltaY; // webkit vs moz

  //     let mousePosition = { x: event.clientX, y: event.clientY };
  //     // console.log('wheelScale', event, delta);

  //     let newZoom = paper.project.activeLayer.scaling.y + delta / 100;
  //     let calcZoom = newZoom / paper.project.activeLayer.scaling.y;
  //     if (newZoom >= .1 && newZoom <= 5) {
  //         let oldZoom = paper.project.activeLayer.position;
  //         let p = new paper.Point(mousePosition.x, mousePosition.y);
  //         let beta = paper.project.activeLayer.scaling.y / newZoom;
  //         let pc = p.subtract(oldZoom);
  //         let a = p.subtract(pc.multiply(beta)).subtract(oldZoom);

  //         paper.project.activeLayer.scale(calcZoom, p);
  //     }
  //     event.preventDefault();
  //     paper.project.view.update();
  // }

  update(data, saveData) {
    this._facetGrid.update(data, saveData);
  }

  _mouseDownHandler(event) {
    // select data point
    if (!this.insertPoint) {
      const hit = paper.project.hitTest(event.point, { fill: true, tolerance: 2 });

      if (hit && hit.type === 'fill') {
        this._selected = hit.item;
      }
    }
  }

  _mouseUpHandler(event) {
    // deselect data point
    if (!this.insertPoint) {
      if (this._selected) {
        const updatedValue = this._facetGrid.updatePoint(this._selected.data, event.point);
        // update data
        ipcRenderer.send('update-point', { 'key': this._selected.data.key, 'value': updatedValue });
        this._selected = null;
      }
    }
    document.body.style.cursor = 'auto';
  }

  _dragHandler(event) {
    // move data point
    if (!this.insertPoint) {
      if (this._selected) {
        const chg = new paper.Point(event.delta.x, event.delta.y);
        this._selected.position = this._selected.position.add(chg);
        paper.view.update();
      }
    }

    if (!this._selected) {
      const layer = paper.project.activeLayer;
      if (event.event.button === 0) {
        document.body.style.cursor = 'grabbing';  // '-webkit-grabbing'
        //moves layer
        const chg = new paper.Point(event.delta.x, event.delta.y);
        layer.translate(chg);
        this._facetGrid.origX += event.delta.x;
        this._facetGrid.origY += event.delta.y;

        paper.project.view.update();
      }
    }
  }

  _clickHandler(event) {
    // insert new data point
    if (this.insertPoint) {
      const hit = paper.project.hitTest(event.point, { fill: true, tolerance: 2 });
      if (hit) {
        if (this._pointArray.length < 2) {
          //prevent duplicate selection
          const exists = this._pointArray.filter(value => value.data.key.i === hit.item.data.key.i && value.data.key.j === hit.item.data.key.j);

          if (hit.type === 'fill' && exists.length === 0) {
            // add point to array
            this._pointArray.push(hit.item);
            hit.item.fillColor = this._hitColor;
          }
        } else {
          this._pointArray.forEach(obj => obj.fillColor = this._pointColor);
          this._pointArray = [];
          this._pointArray.push(hit.item);
          hit.item.fillColor = this._hitColor;
        }
      } else {
        const hit = event.point;

        if (hit && this._pointArray.length === 2) {
          const data = remote.getGlobal('data');
          const saveData = remote.getGlobal('saveData');

          // insert point
          const result = this._facetGrid.insertData(event.point, this._pointArray, data, saveData);

          if (result) {
            // update data
            ipcRenderer.send('insert-point', { key: result.point, data: result.data, saveData: saveData });
            this._cancelOperations();
          } else {
            console.warn('not a valid insert point');
            shell.beep();
          }
        } else {
          shell.beep();
        }
      }
    }
  }

}

export {FacetViewController};