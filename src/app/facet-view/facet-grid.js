const { shell } = require('electron');
const paper = require('paper');

const c60 = Math.cos(60 * Math.PI / 180);
const s60 = Math.sin(60 * Math.PI / 180);

class FacetGrid {

  constructor(data, saveData) {
    this.origX = 0; // Math.round(paper.view.center.x); // (windRect.right - windRect.left) / 2;
    this.origY = 0; //Math.round(paper.view.center.y); // (windRect.bottom - windRect.top) / 2;

    // this.dirty = false;

    this.drawFacetGrid(data, saveData);
  }

  update(data, saveData) {
    this.drawFacetGrid(data, saveData);

  }

  updatePoint(dataObj, mousePosition) {
    // Get the facet position
    const yp = (mousePosition.y - this.origY) / 6 / s60;
    const xp = (mousePosition.x - this.origX) / 6 - (yp * c60);

    // this.dirty = true;			//{The window has been changed}

    dataObj.value.x = xp;
    dataObj.value.y = yp;

    return dataObj.value;
  }

  _facetGrid(d, color) {
    // Draw the X grid
    for (let i = -4; i <= 12; i++) {
      let first = false;
      let start;

      for (let j = 9; j >= -9; j--) {
        const dataValue = d[i][j];
        if (dataValue.valid) {
          const xx = 6 * (dataValue.x + dataValue.y * c60) + this.origX;
          const yy = 6 * dataValue.y * s60 + this.origY;

          const endPoint = new paper.Point(Math.round(xx), Math.round(yy));
          if (first && start) {
            const path = new paper.Path.Line(start, endPoint);
            path.strokeColor = color;
            path.strokeWidth = 1;
          }

          start = endPoint;
          first = true;
        } else {
          first = false;	// Lift the pen at the end of a line
        }
      }
    }
    // Draw the Y grid
    for (let j = 9; j >= -9; j--) {
      // Put the pen down at the first point
      let first = false;
      let start;

      for (let i = -4; i <= 12; i++) {
        const dataValue = d[i][j];
        if (dataValue.valid) {
          const xx = 6 * (dataValue.x + dataValue.y * c60) + this.origX;
          const yy = 6 * dataValue.y * s60 + this.origY;

          const endPoint = new paper.Point(Math.round(xx), Math.round(yy));
          if (first && start) {
            const path = new paper.Path.Line(start, endPoint);
            path.strokeColor = color;
            path.strokeWidth = 1;
          }
          start = endPoint;
          first = true;
        }
        else {
          first = false;
        }
      }
    }
    // FacetGrid
  }

  _drawAxis() {
    // Draw coordinate axes
    const axisColor = new paper.Color(.6, .45, .08); // goldenrod
    // no idea what these magic numbers are
    const startX = new paper.Point(this.origX - 500, this.origY);
    const pathX = new paper.Path.Line(startX, startX.add([910, 0]));
    pathX.strokeColor = axisColor;

    const startY = new paper.Point(this.origX-80, this.origY);

    const pathY = new paper.Path.Line(startY, startY.add([231, 400]));
    pathY.strokeColor = axisColor;

    const startYY = new paper.Point(this.origX-80, this.origY);

    const pathYY = new paper.Path.Line(startYY, startYY.add([-231, -400]));
    pathYY.strokeColor = axisColor;

    // Axis notation
    const origXText = new paper.PointText(new paper.Point(this.origX + 400, this.origY - 5));
    origXText.justification = 'left';
    origXText.fillColor = axisColor;
    origXText.content = 'X';
    origXText.fontSize = 16;

    const origYText = new paper.PointText(new paper.Point(125 + this.origX, 350 + this.origY));
    origYText.justification = 'left';
    origYText.fillColor = axisColor;
    origYText.content = 'Y';
    origYText.fontSize = 16;
  }

  drawFacetGrid(data, saveData) {
    paper.project.activeLayer.removeChildren();

    this._drawAxis();

    // Draw the facet blobs
    for (let j = 9; j >= -9; j--) {
      for (let i = -4; i <= 12; i++) {
        const value = data[i][j];
        if (value.valid) {
          //	Convert to screen coordinates
          const xx = Math.round(6 * (value.x + value.y * c60) + this.origX);
          const yy = Math.round(6 * value.y * s60 + this.origY);

          const rectangle = new paper.Rectangle(new paper.Point(xx - 3, yy - 3), new paper.Point(xx + 3, yy + 3));
          const rectPath = new paper.Path.Rectangle(rectangle);
          rectPath.data.key = { 'i': i, 'j': j };
          rectPath.data.value = value;
          if (value.fake) {
            // Mark the facet with a blob
            rectPath.strokeColor = new paper.Color(0,0,0);
            rectPath.strokeWidth = 1;
            rectPath.fillColor = new paper.Color(1,1,1);

          } else {
            // Mark the facet with a blob
            rectPath.fillColor = new paper.Color(0,0,0);
          }
        }
      }
    }
    this._facetGrid(saveData, new paper.Color(0,.4,0));
    this._facetGrid(data, new paper.Color(0,0,0));			// Draw modified grid in black
  }

  insertData(insertPoint, dataArray, data, saveData) {
    try {
      if (Math.abs(dataArray[0].data.key.i - dataArray[1].data.key.i) > 1) {
        // error notify points invalid
        shell.beep();
        return false;
      }
      const iNumber = [dataArray[0].data.key.i, dataArray[1].data.key.i];
      const jNumber = [dataArray[0].data.key.j, dataArray[1].data.key.j];

      let i0;
      let j0;

      if (iNumber[0] !== iNumber[1]) {
        if (Math.abs(iNumber[0] - iNumber[1]) > 1) {
          shell.beep();
          return false;
        }
        i0 = 2 * iNumber[1] - iNumber[0];
        j0 = jNumber[0];
      }

      if (jNumber[0] !== jNumber[1]) {
        if (Math.abs(jNumber[0] - jNumber[1]) > 1) {
          shell.beep();
          return false;
        }
        j0 = 2 * jNumber[1] - jNumber[0];
        i0 = iNumber[0];
      }

      // Check that indices are within range
      if ((i0 > 12) || (i0 < -4)) {
        shell.beep();
        return false;
      }

      if ((j0 < -9) || (j0 > 9)) {
        shell.beep();
        return false;
      }

      // Check that the facet is not already occupied
      if (data[i0][j0].valid) {
        shell.beep();
        return false;
      }

      const yp = (insertPoint.y - this.origY) / 6.0 / s60;
      const xp = (insertPoint.x - this.origX) / 6.0 - yp * c60;

      // Redraw the new position
      data[i0][j0].x = xp;			// Update the data
      data[i0][j0].y = yp;
      data[i0][j0].valid = true;
      data[i0][j0].diam = data[iNumber[1]][jNumber[1]].diam;
      data[i0][j0].theta = j0 * 10 * Math.PI / 180;
      data[i0][j0].phi = i0 * 10 * Math.PI / 180;

      saveData[i0][j0].x = data[i0][j0].x;
      saveData[i0][j0].y = data[i0][j0].y;
      saveData[i0][j0].valid = data[i0][j0].valid;
      saveData[i0][j0].diam = data[i0][j0].diam;
      saveData[i0][j0].theta = data[i0][j0].theta;
      saveData[i0][j0].phi = data[i0][j0].phi;

      document.getElementById('facet-canvas').style.cursor = 'auto';

      return { 'data': data, 'saveData': saveData, 'point': { 'i': i0, 'j': j0 } };

    } catch (e) {
      console.error(e);
      return false;
    }
  }
}

export {FacetGrid};
