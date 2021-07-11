const { ipcRenderer } = require('electron');
const { dialog, getGlobal } = require('@electron/remote');
const paper = require('paper');

class OrthoViewController {
  constructor(canvas) {
    paper.setup(canvas);
    this.canvas = canvas;

    this.theta0 = 0; // Rotation angles in ortho window
    this.fi0 = 0; // Rotation angles in ortho window
    this.r = 270; // Radius of preview globe
    this.globeColor = new paper.Color(.5); //'rgba(180,180,180,1)';
    this.crossings = null;

    this.visibleColor = new paper.Color(0,.4,0);
    this.hiddenColor = new paper.Color(1,0,0);

    paper.project.view.on('keydown', (event) => {
      if (this.crossings) {
        switch (event.key) {
          case 'right':
            this.fi0 = this.fi0 - 10;
            break;
          case 'left':
            this.fi0 = this.fi0 + 10;
            break;
          case 'up':
            this.theta0 = this.theta0 + 10;
            break;
          case 'down':
            this.theta0 = this.theta0 - 10;
            break;
        }
        if (this.fi0 > 180) { this.fi0 = this.fi0 - 360; }
        if (this.theta0 > 90) { this.theta0 = 90; }
        if (this.theta0 < -90) { this.theta0 = -90; }
        this.update(this.crossings);
      }
    });
  }

  update(crossings) {
    if(crossings) {
      paper.project.clear();
      this._drawLatitudes(0);
      this._drawLongitudes(0);
      this._triangles(crossings);
      paper.view.update();
      this.crossings = crossings;
      paper.project.activeLayer.position = new paper.Point(this.canvas.width / 4, this.canvas.height / 4);
    } else {
      dialog.showErrorBox('Crossings Error', 'Error: No crossing data was created. Cannot create Orthographic View.');
    }
  }

  createExportableImage(crossings) {
    paper.project.clear();
    // Draw outline of globe

    // Complete the globe
    this._drawLatitudes(1);
    this._drawLongitudes(1);
    this._makeFile(1, crossings);
    paper.view.update();
    // Plot the data
    const svgFile = paper.project.exportSVG({ asString: true, bounds: 'content' });

    // center layer
    paper.project.activeLayer.position = new paper.Point(this.canvas.width / 4, this.canvas.height / 4);

    ipcRenderer.send('export-svg', { svg: svgFile, theta0: this.theta0, fi0: this.fi0 });

  }

  _drawLatitudes(s) {
    let penUp = false;
    let penUpSave;
    let lineWidth = 1;

    for (let j = -8; j <= 8; j++) {
      penUpSave = true;

      // Set line width
      lineWidth = (j === 0) ? 1 : 0.25;
      const path = new paper.Path();
      path.strokeColor = this.globeColor;
      path.strokeWidth = lineWidth;

      for (let i = 0; i <= 360; i++) {
        let x = this.r * Math.cos(j * 10 * Math.PI / 180) * Math.cos(i * Math.PI / 180);
        const y = this.r * Math.cos(j * 10 * Math.PI / 180) * Math.sin(i * Math.PI / 180);
        let z = -this.r * Math.sin(j * 10 * Math.PI / 180);

        const rotateResult = this._RotateY(x, z, this.theta0);
        x = rotateResult.x;
        z = rotateResult.z;

        penUp = x < 0;

        if (penUpSave || penUp) {
          path.moveTo(new paper.Point(y, -z));
        } else {
          path.lineTo(new paper.Point(y, -z));
        }

        penUpSave = penUp;

      }

      if (s === 1) {
        // WriteLn(outfile, 'stroke');
      }
    }
  }


  _drawLongitudes(s) {
    const circle = new paper.Shape.Circle(new paper.Point(0, 0), this.r);
    circle.strokeColor = new paper.Color(0,0,0);

    let penUp = true;
    let penUpSave;
    let lineWidth = 1;

    for (let i = 0; i <= 36; i++) {
      penUpSave = true;
      // set line widths
      if ((i === 36 - Math.trunc(this.fi0 / 10)) || (i === 9 - Math.trunc(this.fi0 / 10))
				|| (i === 18 - Math.trunc(this.fi0 / 10)) || (i === 27 - Math.trunc(this.fi0 / 10))) {
        lineWidth = 1;
      } else {
        lineWidth = .25;
      }

      // new path
      const myPath = new paper.Path();
      myPath.strokeColor = this.globeColor;
      myPath.strokeWidth = lineWidth;
      for (let j = -90; j <= 90; j++) {

        let x = this.r * Math.cos(j * Math.PI / 180) * Math.cos(i * 10 * Math.PI / 180);
        const y = this.r * Math.cos(j * Math.PI / 180) * Math.sin(i * 10 * Math.PI / 180);
        let z = -this.r * Math.sin(j * Math.PI / 180);

        const rotate = this._RotateY(x, z, this.theta0);
        x = rotate.x;
        z = rotate.z;

        penUp = x < 0;

        if (penUpSave && !penUp) {
          myPath.moveTo(new paper.Point(y, -z));
        }
        if (!penUpSave && !penUp) {
          myPath.lineTo(new paper.Point(y, -z));
        }
        penUpSave = penUp;
      }

      if (s === 1) {
        // WriteLn(outfile, 'stroke');
      }
    }
    // {Screen drawing, add sighting blob}
    if (s === 0) {
      const text = new paper.PointText(new paper.Point(-this.r - 15, this.r + 15));
      text.fillColor = new paper.Color(0,0,0);
      text.content = `${this.theta0} ${this.fi0}`;
    }



  }

  _triangles(crossing) {
    const t = getGlobal('t');
    // GetCrossings;
    let color = this.visibleColor;  // The colour of visible stuff is green

    for (let m1 = -30; m1 <= 29; m1++) {
      // Draw X lines
      let firstTime = true;
      let currentPoint;
      for (let m2 = -29; m2 <= 30; m2++) {
        if (crossing[m1][m2].valid) {

          const rc = this._rotateCentroids(crossing[m1][m2].theta, crossing[m1][m2].phi, t);

          const rCrossing = {
            'theta': rc.thetaOut,
            'phi': rc.fiOut
          };

          let x = this.r * Math.cos(rCrossing.theta)
						* Math.cos(rCrossing.phi - this.fi0 * Math.PI / 180);

          const y = this.r * Math.cos(rCrossing.theta)
						* Math.sin(rCrossing.phi - this.fi0 * Math.PI / 180);

          let z = -this.r * Math.sin(rCrossing.theta); // negative because coord system diff than postscript

          const rotate = this._RotateY(x, z, this.theta0);
          x = rotate.x;
          z = rotate.z;

          if (x < 0) {
            color = this.hiddenColor; // red
          } else {
            color = this.visibleColor; // green
          }
          if (firstTime) {
            currentPoint = new paper.Point(Math.round(y), Math.round(z));
            firstTime = false;
          }
          else if(currentPoint) {
            const nextPoint = new paper.Point(Math.round(y), Math.round(z));
            const path = new paper.Path.Line(currentPoint, nextPoint);
            path.strokeColor = color;
            currentPoint = nextPoint;
          } else {
            console.error('No current point');
            dialog.showErrorBox('Crossings Error', 'Error: Missing current point. Cannot create Orthographic View.');
          }
        }
      }
    }

    // Draw Y lines
    for (let m2 = -30; m2 <= 29; m2++) {
      let firstTime = true;
      let currentPoint;
      for (let m1 = -29; m1 <= 30; m1++) {

        if (crossing[m1][m2].valid) {
          const rc = this._rotateCentroids(crossing[m1][m2].theta, crossing[m1][m2].phi, t);
          const rCrossing = {
            'theta': rc.thetaOut,
            'phi': rc.fiOut
          };

          let x = this.r * Math.cos(rCrossing.theta)
						* Math.cos(rCrossing.phi - this.fi0 * Math.PI / 180);

          const y = this.r * Math.cos(rCrossing.theta)
						* Math.sin(rCrossing.phi - this.fi0 * Math.PI / 180);

          let z = -this.r * Math.sin(rCrossing.theta); // negative because coord system diff than postscript

          const rotate = this._RotateY(x, z, this.theta0);
          x = rotate.x;
          z = rotate.z;
          if (x < 0) {
            color = this.hiddenColor;
          } else {
            color = this.visibleColor;
          }
          if (firstTime) {
            currentPoint = new paper.Point(Math.round(y), Math.round(z));
            firstTime = false;
          } else if (currentPoint) {
            const nextPoint = new paper.Point(Math.round(y), Math.round(z));
            const path = new paper.Path.Line(currentPoint, nextPoint);
            path.strokeColor = color;
            currentPoint = nextPoint;
          } else {
            console.error('No current point');
            dialog.showErrorBox('Crossings Error', 'Error: Missing current point. Cannot create Orthographic View.');
          }

        }
      }
    }
    // Draw Z lines
    for (let mm = -60; mm <= 60; mm++) {
      let currentPoint;
      let firstTime = true;
      for (let m1 = 29; m1 >= -30; m1--) {
        for (let m2 = 30; m2 >= -29; m2--) {
          if (crossing[m1][m2].valid && (m2 + m1 === mm)) {
            const rc = this._rotateCentroids(crossing[m1][m2].theta, crossing[m1][m2].phi, t);
            const rCrossing = {
              'theta': rc.thetaOut,
              'phi': rc.fiOut
            };

            let x = this.r * Math.cos(rCrossing.theta)
							* Math.cos(rCrossing.phi - this.fi0 * Math.PI / 180);

            const y = this.r * Math.cos(rCrossing.theta)
							* Math.sin(rCrossing.phi - this.fi0 * Math.PI / 180);

            let z = -this.r * Math.sin(rCrossing.theta); // negative because coord system diff than postscript

            const rotate = this._RotateY(x, z, this.theta0);
            x = rotate.x;
            z = rotate.z;
            if (x < 0) {
              color = this.hiddenColor;  // red
            } else {
              color = this.visibleColor;  // green
            }
            if (firstTime) {
              currentPoint = new paper.Point(Math.round(y), Math.round(z));
              firstTime = false;
            }
            else if (currentPoint) {
              const nextPoint = new paper.Point(Math.round(y), Math.round(z));
              const path = new paper.Path.Line(currentPoint, nextPoint);
              path.strokeColor = color;
              currentPoint = nextPoint;
            } else {
              console.error('No current point');
              dialog.showErrorBox('Crossings Error', 'Error: Missing current point. Cannot create Orthographic View.');
            }
          }
        }
      }
    }
  }

  _RotateY(x, z, angle) {
    const c = Math.cos(angle * Math.PI / 180);
    const s = Math.sin(angle * Math.PI / 180);
    const slask = x * c + z * s;
    const zz = -x * s + z * c;
    const xx = slask;
    return { 'z': zz, 'x': xx };
  }

  _rotateCentroids(thetaIn, fiIn, t) {
    let thetaOut = Math.cos(fiIn) * Math.cos(thetaIn) * Math.sin(t * Math.PI / 180) +
			Math.sin(thetaIn) * Math.cos(t * Math.PI / 180);
    thetaOut = Math.atan(thetaOut / Math.sqrt(1 - Math.pow(thetaOut, 2))); // {i = phi, j = theta}

    const sf = Math.sin(fiIn) * Math.cos(thetaIn) / Math.cos(thetaOut);
    const cf = (Math.cos(fiIn) * Math.cos(thetaIn) * Math.cos(t * Math.PI / 180) -
			Math.sin(thetaIn) * Math.sin(t * Math.PI / 180)) / Math.cos(thetaOut);

    let fiOut = Math.atan(sf / cf);

    if (cf < 0) {
      fiOut = Math.PI + fiOut;
    }

    if (fiOut > Math.PI) {
      fiOut = fiOut - 2 * Math.PI;
    }

    return {
      'thetaOut': thetaOut,
      'fiOut': fiOut
    };
  } // RotateCentroids

  _makeFile(s, initialCrossing) {
    const r = this.r;

    // Prepare the data
    const crossing = this._computeIOAngle(initialCrossing);

    const psIndex = getGlobal('psIndex');
    for (let m1 = -30; m1 <= 29; m1++) {
      for (let m2 = -29; m2 <= 30; m2++) {
        if (crossing[m1][m2].valid && (crossing[m1][m2].area >= 0)) {

          let x = r * Math.cos(crossing[m1][m2].centroid[1]) * Math.cos(crossing[m1][m2].centroid[2] - this.fi0 * Math.PI / 180);

          const y = r * Math.cos(crossing[m1][m2].centroid[1]) * Math.sin(crossing[m1][m2].centroid[2] - this.fi0 * Math.PI / 180);

          let z = r * Math.sin(crossing[m1][m2].centroid[1]);

          const rotate = this._RotateY(x, z, this.theta0);
          x = rotate.x;
          z = rotate.z;

          if (x > 0) {
            if (s > 0) {
              const circle = new paper.Path.Circle(
                new paper.Point(y, -z), 1);
              circle.fillColor = this.visibleColor;  // green

              let inStr = '';
              if ([1, 2, 3, 4, 5, 6].includes(psIndex)) {
                switch (psIndex) {
                  case 1:
                    // A (Average)
                    inStr = (crossing[m1][m2].ioAngle).toFixed(2);
                    break;
                  case 2:
                    // X
                    inStr = ((crossing[m1][m2].dfx * 180 / Math.PI / 5)).toFixed(2);
                    break;
                  case 3:
                    // Y
                    inStr = (crossing[m1][m2].dfy * 180 / Math.PI / 5).toFixed(2);
                    break;
                  case 4:
                    // Z
                    inStr = (crossing[m1][m2].dfz * 180 / Math.PI / 5).toFixed(2);
                    break;
                  case 5:
                    // p
                    inStr = (crossing[m1][m2].cdiam * crossing[m1][m2].ioAngle * Math.PI / 180).toFixed(3);
                    break;
                  case 6:
                    // D
                    inStr = Math.round(crossing[m1][m2].cdiam);
                    break;
                  default:
                    break;
                }

                const offset = 4;
                const text = new paper.PointText(new paper.Point(y - offset, -z + offset));
                text.content = '(' + inStr.toString() + ')';
                text.fontSize = 7;
              }
            }
          }
        } else {
          // console.log('invalid');
        }
      }


    }
  } // end _makeFile

  _computeIOAngle(crossing) {
    const t = getGlobal('t');

    for (let m1 = -30; m1 <= 29; m1++) {
      for (let m2 = -30; m2 <= 29; m2++) {
        // Use a tetragon of valid adjacent crossings
        if (crossing[m1][m2].valid && crossing[m1 + 1][m2].valid &&
					crossing[m1][m2 + 1].valid && crossing[m1 + 1][m2 + 1].valid) {

          const z1 = {};
          const z2 = {};
          const z3 = {};
          const z4 = {};

          // The corners
          z1[1] = crossing[m1][m2].theta;
          z1[2] = crossing[m1][m2].phi;

          z2[1] = crossing[m1 + 1][m2].theta;
          z2[2] = crossing[m1 + 1][m2].phi;

          z3[1] = crossing[m1 + 1][m2 + 1].theta;
          z3[2] = crossing[m1 + 1][m2 + 1].phi;

          z4[1] = crossing[m1][m2 + 1].theta;
          z4[2] = crossing[m1][m2 + 1].phi;

          // The diameters
          const dd1 = crossing[m1][m2].diam;
          const dd2 = crossing[m1 + 1][m2].diam;
          const dd3 = crossing[m1 + 1][m2 + 1].diam;
          const dd4 = crossing[m1][m2 + 1].diam;

          // The area
          crossing[m1][m2].area = this._area(z1, z2, z3, z4);

          // The centriod
          crossing[m1][m2].centroid[1] =
						(z1[1] + z2[1] + z3[1] + z4[1]) / 4;
          crossing[m1][m2].centroid[2] =
						(z1[2] + z2[2] + z3[2] + z4[2]) / 4;
          crossing[m1][m2].cdiam = (dd1 + dd2 + dd3 + dd4) / 4;

          const del = 25 / crossing[m1][m2].area / Math.cos(crossing[m1][m2].centroid[1]);

          // The io angle
          crossing[m1][m2].ioAngle = Math.sqrt(2 / del / Math.sqrt(3)) * 180 / Math.PI;

          // dfx, dfy, dfz
          crossing[m1][m2].dfx = Math.sqrt(
            Math.pow((z1[1] - z2[1]), 2) +
						Math.pow((z1[2] - z2[2]) * Math.cos(crossing[m1][m2].centroid[1]), 2));
          crossing[m1][m2].dfy = Math.sqrt(
            Math.pow(z1[1] - z4[1], 2) +
						Math.pow((z1[2] - z4[2]) * Math.cos(crossing[m1][m2].centroid[1]), 2));
						
          crossing[m1][m2].dfz = Math.sqrt(
            Math.pow(z2[1] - z4[1], 2) +
						Math.pow((z2[2] - z4[2]) * Math.cos(crossing[m1][m2].centroid[1]), 2));

          // All computed stuff is now rotation independent
          // Rotate the stuff into place
          const rc = this._rotateCentroids(crossing[m1][m2].centroid[1], crossing[m1][m2].centroid[2], t);
          crossing[m1][m2].centroid[1] = rc.thetaOut;
          crossing[m1][m2].centroid[2] = rc.fiOut;
        }
      }
    }
    return crossing;

  }

  _area(z1, z2, z3, z4) {
    // Computes area of an arbitrary tetragon, as the sum of two triangles, the area of which
    // are computed by Heron's formula. The input is the four corner points

    let d1 = Math.sqrt(Math.pow((z1[1] - z2[1]), 2) + Math.pow((z1[2] - z2[2]), 2));
    let d2 = Math.sqrt(Math.pow((z2[1] - z3[1]), 2) + Math.pow((z2[2] - z3[2]), 2));
    let d3 = Math.sqrt(Math.pow((z3[1] - z1[1]), 2) + Math.pow((z3[2] - z1[2]), 2));

    let s = (d1 + d2 + d3) / 2;
    const a = Math.sqrt(s * (s - d1) * (s - d2) * (s - d3));		// Heron's formula!

    d1 = Math.sqrt(Math.pow((z3[1] - z4[1]), 2) + Math.pow((z3[2] - z4[2]), 2));
    d2 = Math.sqrt(Math.pow((z4[1] - z1[1]), 2) + Math.pow((z4[2] - z1[2]), 2));
    d3 = Math.sqrt(Math.pow((z1[1] - z3[1]), 2) + Math.pow((z1[2] - z3[2]), 2));

    s = (d1 + d2 + d3) / 2;

    return a + Math.sqrt(s * (s - d1) * (s - d2) * (s - d3));	// Add the areas;

  }

}

export {OrthoViewController};
