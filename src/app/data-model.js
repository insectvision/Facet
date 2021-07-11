'use strict';

class DataModel {

  constructor() {
    this.undo = [];
    this.redo = null;
  }

  create(facetDataArray, cols) {
    const data = this._initDataContainer();
    for (const value of facetDataArray) {
      const j = value[0] / 10;
      const i = value[1] / 10;
      const xx = value[2];
      const yy = value[3];
      const dd = (cols === 5) ? value[4] : null;

      data[i][j] = {
        'x': xx,
        'y': yy,
        'diam': dd,
        'valid': true,
        'fake': false,
        'theta': null,
        'phi': null
      };
    }

    return this._generateData(data);
  }

  addUndo(value) {
    // add new value
    this.undo.push(value);
    // limit length of undo array
    if (this.undo.length > 20) {
      this.undo.shift();
    }
  }

  getUndo() {
    return this.undo.pop();
  }

  _initDataContainer() {
    const dataContainer = {};

    for (let i = -4; i <= 12; i++) {
      dataContainer[i] = {};
      for (let j = -9; j <= 9; j++) {
        dataContainer[i][j] = {
          'valid': false,
          'x': null,
          'y': null,
          'fake': true,
          'theta': null,
          'phi': null
        };
      }
    }
    return dataContainer;
  }

  _generateData(dataContainer) {
    // Scale theta and fi
    for (let i = -4; i <= 12; i++) {
      for (let j = -9; j <= 9; j++) {
        try {
          if (dataContainer[i][j].valid) {
            dataContainer[i][j].theta = j * 10 * Math.PI / 180;
            dataContainer[i][j].phi = i * 10 * Math.PI / 180;
          } else {
            // console.log('value not valid', value, key);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    // backup the original data
    return dataContainer;
  }

  reverseY(data) {
    for (let i = -4; i <= 9; i++) {
      for (let j = -9; j <= 9; j++) {
        if (data[i][j].valid) {
          data[i][j].y = -1 * data[i][j].y;
        }
      }
    }
    return data;
  }

}

module.exports = DataModel;
