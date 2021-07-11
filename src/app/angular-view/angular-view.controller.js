const { ipcRenderer } = require('electron');
const { dialog } = require('@electron/remote');
const paper = require('paper');

class AngularViewController {

  constructor(canvas) {
    paper.setup(canvas);
    this._offsetX = 120;
    this._offsetY = 300;
    this._scaleFactor = 3;
  }

  _initIsoPoints() {
    const isoX = {};
    const isoY = {};
    for (let k = 0; k <= 80; k++) { // 80
      isoX[k] = {};
      isoY[k] = {};
      for (let m = -30; m <= 30; m++) {
        isoX[k][m] = this._initIsoPoint();
        isoY[k][m] = this._initIsoPoint();
      }
    }
    return [isoX, isoY];
  }

  _initIsoPoint() {
    return {
      theta: null,
      phi: null,
      diam: null,
      valid: false
    };
  }

  update(data, cols) {
    // clear the View
    this.clear();

    // draw coordinate axis
    // draw axis legend
    this._drawAxis();

    // plot theta-phi grid points
    this._thetaPhiGridPoints(data);

    // Interpolate facet isocurves
    const crossing = this._drawCurves(data, cols);

    // window.electron.updateCrossings(crossing);
    ipcRenderer.send('update-crossings', crossing);
  }

  clear() {
    paper.project.clear();
  }

  _drawAxis() {
    const axisColor = new paper.Color(.6, .45, .08); // goldenrod

    const fstart = new paper.Point(0, this._offsetY);
    const fend = fstart.add(new paper.Point(600,0));
    const fpath = new paper.Path.Line(fstart, fend);
    fpath.strokeColor = axisColor;

    const qstart = new paper.Point(this._offsetX, 0);
    const qend = qstart.add(new paper.Point(0,600));
    const qpath = new paper.Path.Line(qstart, qend);
    qpath.strokeColor = axisColor;

    const phiText = new paper.PointText(new paper.Point(550, 298));
    phiText.justification = 'left';
    phiText.fillColor = axisColor;
    phiText.content = 'Φ';
    phiText.fontSize = 16;

    const thetaText = new paper.PointText(new paper.Point(110, 15));
    thetaText.justification = 'left';
    thetaText.fillColor = axisColor;
    thetaText.content = 'θ';
    thetaText.fontSize = 16;
    // Draw the view now:
    paper.view.update();
  }

  _thetaPhiGridPoints(data) {
    const radius = 1;
    for (let i = -4; i <= 12; i++) {
      for (let j = -9; j <= 9; j++) {
        if (data[i][j].valid) {
          const x = Math.round(this._scaleFactor * data[i][j].phi * 180 / Math.PI + this._offsetX);
          const y = this._offsetY - this._scaleFactor * Math.round(data[i][j].theta * 180 / Math.PI);
          const circle = new paper.Path.Circle(new paper.Point(x, y), radius);
          circle.fillColor = new paper.Color(0,0,0);

        } else {
          // if(data[i][j].x != 0) console.log('not valid point', data[i][j]);
        }
      }
    }
    paper.view.update();
  }

  _drawCurves(data, cols) {
    try {
      const initIsoXY = this._initIsoPoints();
      const isoX = initIsoXY[0];
      const isoY = initIsoXY[1];
      const kNumX = {};
      const kNumY = {};

      for (let m = -30; m <= 30; m++) {
        // Zero the number of segments
        kNumX[m] = -1;
        kNumY[m] = -1;
      }

      for (let m = -30; m <= 30; m++) {
        const target = m * 5;	// target isocurves - every 5 facets
        let k = 0; // No curve sements so far
        for (let i = -4; i <= 11; i++) {
          for (let j = -9; j <= 8; j++) { // Search for vertical hits

            if (data[i][j].valid && data[i][j + 1].valid) {
              if ((data[i][j].x - target) * (data[i][j + 1].x - target) <= 0) {

                // phi
                if (data[i][j + 1].x - data[i][j].x === 0) {
                  // Handle division by zero
                  isoX[k][m].phi = data[i][j].phi;
                } else {
                  isoX[k][m].phi = data[i][j].phi +
                    (data[i][j + 1].phi - data[i][j].phi) *
                    (target - data[i][j].x) /
                    (data[i][j + 1].x - data[i][j].x);
                }
                // theta
                if (data[i][j + 1].x - data[i][j].x === 0) {
                  // Handle division by zero
                  isoX[k][m].theta = data[i][j].theta;
                } else {
                  isoX[k][m].theta = data[i][j].theta +
                    (data[i][j + 1].theta - data[i][j].theta) *
                    (target - data[i][j].x) /
                    (data[i][j + 1].x - data[i][j].x);
                }
                if (cols === 5) {
                  if (data[i][j + 1].x - data[i][j].x === 0) {
                    // Handle division by zero
                    isoX[k][m].diam = data[i][j].diam;
                  } else {
                    isoX[k][m].diam = data[i][j].diam +
                      (data[i][j + 1].diam - data[i][j].diam) *
                      (target - data[i][j].x) /
                      (data[i][j + 1].x - data[i][j].x);
                  }
                }
                isoX[k][m].valid = true;
                k = k + 1;
              }
            }
          }
          // Search for horizontal hits
          for (let l = -9; l <= 9; l++) {
            if (data[i][l].valid && data[i + 1][l].valid) {
              if ((data[i][l].x - target) * (data[i + 1][l].x - target) <= 0) {

                if (data[i][l].x - data[i + 1][l].x === 0) {
                  // Handle division by zero
                  isoX[k][m].theta = data[i][l].theta;
                } else {
                  isoX[k][m].theta = data[i][l].theta +
                    (data[i + 1][l].theta - data[i][l].theta) *
                    (target - data[i][l].x) /
                    (data[i + 1][l].x - data[i][l].x);
                }

                if (data[i + 1][l].x - data[i][l].x === 0) {
                  // Handle division by zero
                  isoX[k][m].phi = data[i][l].phi;
                } else {
                  isoX[k][m].phi = data[i][l].phi +
                    (data[i + 1][l].phi - data[i][l].phi) *
                    (target - data[i][l].x) /
                    (data[i + 1][l].x - data[i][l].x);
                }

                if (cols === 5) {
                  // diam
                  if (data[i + 1][l].x - data[i][l].x === 0) {
                    // Handle division by zero
                    isoX[k][m].diam = data[i][l].diam;
                  } else {
                    isoX[k][m].diam = data[i][l].diam +
                      (data[i + 1][l].diam - data[i][l].diam) *
                      (target - data[i][l].x) /
                      (data[i + 1][l].x - data[i][l].x);
                  }
                }
                isoX[k][m].valid = true;
                k = k + 1;
              }
            }
          }
        }

        kNumX[m] = k - 1;

        // Sort the sequence
        let jSave = null;
        for (let k1 = 0; k1 <= kNumX[m] - 1; k1++) {
          let minDistance = 100;
          for (let j = k1 + 1; j <= kNumX[m]; j++) {
            const distance = Math.sqrt(
              Math.pow((isoX[k1][m].phi - isoX[j][m].phi), 2) +
              Math.pow((isoX[k1][m].theta - isoX[j][m].theta), 2)
            );
            if (distance <= minDistance) {
              minDistance = distance;
              jSave = j;
            }
          }
          const isoTemp = Object.assign({}, isoX[k1 + 1][m]);
          isoX[k1 + 1][m] = Object.assign({}, isoX[jSave][m]);
          isoX[jSave][m] = Object.assign({}, isoTemp);
        }

        // Eliminate doubles
        if (isoX[0][m].valid) {
          let k2 = 0;
          do {
            if (isoX[k2][m].valid && isoX[k2 + 1][m].valid) {
              const distance = Math.sqrt(
                Math.pow((isoX[k2][m].phi - isoX[k2 + 1][m].phi), 2) +
                Math.pow((isoX[k2][m].theta - isoX[k2 + 1][m].theta), 2)
              );
              if (distance < 0.0000001) {
                for (let j = k2 + 1; j <= kNumX[m] - 1; j++) {
                  isoX[j][m] = Object.assign({}, isoX[j + 1][m]);
                }
                isoX[kNumX[m]][m].valid = false;
                kNumX[m] = kNumX[m] - 1;
              } else {
                k2 = k2 + 1;
              }
            } else {
              k2 = k2 + 1;
            }
          } while (k2 < kNumX[m]);
        } // End Eliminate doubles

        // Draw X-curve
        const xPath = new paper.Path();
        xPath.strokeColor = new paper.Color(1,0,0);
        xPath.strokeWidth = 1;
        if (isoX[0][m].valid) {
          xPath.moveTo(new paper.Point(Math.round(this._scaleFactor * isoX[0][m].phi * 180 / Math.PI + this._offsetX), Math.round(this._offsetY - this._scaleFactor * isoX[0][m].theta * 180 / Math.PI)));
          for (let k3 = 1; k3 <= kNumX[m]; k3++) {
            xPath.lineTo(new paper.Point(Math.round(this._scaleFactor * isoX[k3][m].phi * 180 / Math.PI + this._offsetX), Math.round(this._offsetY - this._scaleFactor * isoX[k3][m].theta * 180 / Math.PI)));
          }
        } else {
          // console.warn('isoX[0][m] not valid', isoX[0][m], m);
        }
      }

      // Repeat for Y
      for (let m = -30; m <= 30; m++) {
        const target = m * 5;
        let k = 0;
        // step in phi
        for (let i = -4; i <= 11; i++) {
          for (let j = -9; j <= 8; j++) {
            if (data[i][j].valid && data[i][j + 1].valid) {
              if ((data[i][j].y - target) * (data[i][j + 1].y - target) <= 0) {

                // if (isoY.hasOwnProperty(k)) {
                if (k in isoY) {
                  // phi
                  if (data[i][j + 1].y - data[i][j].y === 0) {
                    isoY[k][m].phi = data[i][j].phi;
                  } else {
                    isoY[k][m].phi = data[i][j].phi +
                      (data[i][j + 1].phi - data[i][j].phi) *
                      (target - data[i][j].y) /
                      (data[i][j + 1].y - data[i][j].y);
                  }
                  // theta
                  if (data[i][j + 1].y - data[i][j].y === 0) {
                    isoY[k][m].theta = data[i][j].theta;
                  } else {
                    isoY[k][m].theta = data[i][j].theta +
                      (data[i][j + 1].theta - data[i][j].theta) *
                      (target - data[i][j].y) /
                      (data[i][j + 1].y - data[i][j].y);
                  }
                  // dia
                  if (cols === 5) {
                    // Handle division by zero
                    if (data[i][j + 1].y - data[i][j].y === 0) {
                      isoY[k][m].diam = data[i][j].diam;
                    } else {
                      isoY[k][m].diam = data[i][j].diam +
                        (data[i][j + 1].diam - data[i][j].diam) *
                        (target - data[i][j].y) /
                        (data[i][j + 1].y - data[i][j].y);
                    }
                  }
                  isoY[k][m].valid = true;

                  k = k + 1;
                }else {
                  console.warn('isoY missing property', 'k', k, 'j', j, 'm', m);
                }
              }
            }
          }
          for (let l = -9; l <= 9; l++) {

            if (data[i][l].valid && data[i + 1][l].valid) {
              if ((data[i][l].y - target) * (data[i + 1][l].y - target) <= 0) {

                // if (isoY.hasOwnProperty(k)) {
                if (k in isoY) {
                  // theta
                  if (data[i + 1][l].y - data[i][l].y === 0) {
                    isoY[k][m].theta = data[i][l].theta;
                  } else {
                    isoY[k][m].theta = data[i][l].theta +
                      (data[i + 1][l].theta - data[i][l].theta) *
                      (target - data[i][l].y) /
                      (data[i + 1][l].y - data[i][l].y);
                  }
                  // phi
                  if (data[i + 1][l].y - data[i][l].y === 0) {
                    isoY[k][m].phi = data[i][l].phi;
                  } else {
                    isoY[k][m].phi = data[i][l].phi +
                      (data[i + 1][l].phi - data[i][l].phi) *
                      (target - data[i][l].y) /
                      (data[i + 1][l].y - data[i][l].y);
                  }
                  // dia
                  if (cols === 5) {
                    if (data[i + 1][l].y - data[i][l].y === 0) {
                      isoY[k][m].diam = data[i][l].diam;
                    } else {
                      isoY[k][m].diam = data[i][l].diam +
                        (data[i + 1][l].diam - data[i][l].diam) *
                        (target - data[i][l].y) /
                        (data[i + 1][l].y - data[i][l].y);
                    }
                  }
                  isoY[k][m].valid = true;
                  k = k + 1;

                } else {
                  console.warn('isoY missing property', 'k', k);
                }
              }
            }
          }
        }

        kNumY[m] = k - 1;

        // Sort the sequence
        let jSave = null;
        for (let kk = 0; kk <= kNumY[m] - 1; kk++) {
          let minDistance = 100;
          for (let j = kk + 1; j <= kNumY[m]; j++) {
            const distance = Math.sqrt(
              Math.pow((isoY[kk][m].phi - isoY[j][m].phi), 2) +
              Math.pow((isoY[kk][m].theta - isoY[j][m].theta), 2));
            if (distance <= minDistance) {
              minDistance = distance;
              jSave = j;
            }
          }
          if (!jSave) console.warn('no jsave', kk, m);
          else {
            // must copy
            const isoTemp = Object.assign({}, isoY[kk + 1][m]); //JSON.parse(JSON.stringify(isoY[kk + 1][m]));

            isoY[kk + 1][m] = Object.assign({}, isoY[jSave][m]); //JSON.parse(JSON.stringify(isoY[jSave][m]));

            isoY[jSave][m] = Object.assign({}, isoTemp);
          }

        }

        // Eliminate doubles
        if (isoY[0][m].valid) {
          let k3 = 0;
          do {
            if (isoY[k3][m].valid && isoY[k3 + 1][m].valid) {
              const distance = Math.sqrt(
                Math.pow((isoY[k3][m].phi - isoY[k3 + 1][m].phi), 2) +
                Math.pow((isoY[k3][m].theta - isoY[k3 + 1][m].theta), 2)
              );
              if (distance < 0.0000001) {
                for (let j = k3 + 1; j <= kNumY[m] - 1; j++) {
                  isoY[j][m] = Object.assign({}, isoY[j + 1][m]);
                }
                isoY[kNumY[m]][m].valid = false;
                kNumY[m] = kNumY[m] - 1;

              } else {
                k3++;
              }
            } else {
              k3++;
            }
          } while (k3 < kNumY[m]);
        }

        // draw
        if (isoY[0][m].valid) {
          let start = new paper.Point(Math.round(this._scaleFactor * isoY[0][m].phi * 180 / Math.PI + this._offsetX),
            Math.round(this._offsetY - this._scaleFactor * isoY[0][m].theta * 180 / Math.PI));
          for (let kk = 1; kk <= kNumY[m]; kk++) {
            const end = new paper.Point(
              Math.round(this._scaleFactor * isoY[kk][m].phi * 180 / Math.PI + this._offsetX),
              Math.round(this._offsetY - this._scaleFactor * isoY[kk][m].theta * 180 / Math.PI));

            const path = new paper.Path.Line(start, end);
            path.strokeColor = new paper.Color(0,0,1); // 'blue'
            path.strokeWidth = 1;

            start = end;
          }
        }
      }

      const crossing = this._getCrossings(isoX, isoY, kNumX, kNumY);

      const foreColor = new paper.Color(0,.4,0);
      for (let mm = -60; mm <= 60; mm++) {
        let firstTime = true;
        // let start;
        const zPath = new paper.Path();
        zPath.strokeColor = foreColor;
        zPath.strokeWidth = 1;
        // Draw the Z isolines
        for (let m1 = 29; m1 >= -30; m1--) {
          for (let m2 = 30; m2 >= -29; m2--) {
            if (crossing[m1][m2].valid && ((m2 + m1) === mm)) {
              const point = new paper.Point(
                Math.round((this._scaleFactor * crossing[m1][m2].phi * 180 / Math.PI + this._offsetX)),
                Math.round(this._offsetY - this._scaleFactor * crossing[m1][m2].theta * 180 / Math.PI)
              );

              if (firstTime) {
                firstTime = false;
                zPath.moveTo(point);

              } else {
                zPath.lineTo(point);
              }

            }
          }
        }
      }

      paper.view.update();

      return crossing;
    } catch (e) {
      console.error(e);
      dialog.showErrorBox('Draw Curves Error', 'Error: An error occured while drawing curves.');
      return null;
    }

  } // End drawCurves

  _getCrossings(isoX, isoY, kNumX, kNumY) {
    const crossing = {};
    // Reset the crossings
    for (let m1 = -30; m1 <= 30; m1++) {
      crossing[m1] = {};
      for (let m2 = -30; m2 <= 30; m2++) {
        crossing[m1][m2] = {
          valid: false,
          area: -1,
          centroid: { 1: null, 2: null },
          theta: null,
          phi: null
        };
      }
    }
    // Search for crossings m1/m2
    for (let m1 = -30; m1 <= 30; m1++) {
      for (let m2 = -30; m2 <= 30; m2++) {
        // Move along the curves
        for (let k1 = 0; k1 <= kNumX[m1] - 1; k1++) {
          for (let k2 = 0; k2 <= kNumY[m2] - 1; k2++) {
            // Valid points?
            if (isoX[k1][m1].valid && isoX[k1 + 1][m1].valid
              && isoY[k2][m2].valid && isoY[k2 + 1][m2].valid) {

              const dtx = isoX[k1 + 1][m1].theta - isoX[k1][m1].theta;
              const dfx = isoX[k1 + 1][m1].phi - isoX[k1][m1].phi;
              const ddx = isoX[k1 + 1][m1].diam - isoX[k1][m1].diam;
              const dty = isoY[k2 + 1][m2].theta - isoY[k2][m2].theta;
              const dfy = isoY[k2 + 1][m2].phi - isoY[k2][m2].phi;

              const determinant = dty * dfx - dtx * dfy;

              // The lines cross
              if (Math.abs(determinant) > 0.000001) {
                const dt = isoY[k2][m2].theta - isoX[k1][m1].theta;
                const df = isoY[k2][m2].phi - isoX[k1][m1].phi;
                const tt = (dty * df - dfy * dt) / determinant; // Compute
                const uu = (dtx * df - dfx * dt) / determinant; // parameters

                // Check that crossing is within limits
                if ((tt >= 0) && (tt <= 1) && (uu >= 0) && (uu <= 1)) {
                  crossing[m1][m2].phi = isoX[k1][m1].phi + dfx * tt;
                  crossing[m1][m2].theta = isoX[k1][m1].theta + dtx * tt;
                  crossing[m1][m2].diam = isoX[k1][m1].diam + ddx * tt;
                  crossing[m1][m2].valid = true;
                }
              }
            }
          }
        }
      }
    }
    return crossing;
  } // _getCrossings

}

export {AngularViewController};
