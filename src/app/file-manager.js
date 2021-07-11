'use strict';

class FileManager {

  constructor() {
    this.filename = '';
  }

  readData(data) {
    // create array of lines from linebreaks
    const re = /[\r\n]/i;
    const lines = data.split(re);
    let cols = 4; // default

    // verify file data
    const title = lines.shift();

    if (title.includes('Facet Data')) {
      if (title.includes('5') || title.includes(5)) {
        cols = 5;
      } else {
        cols = 4;
        // disable some menu items
      }
      const t = lines.shift();

      // translate data into arrays and numbers
      const facetDataArray = [];
      let end = false;
      for (const line of lines) {
        if (!end) {
          if (line.includes('END')) {
            end = true;
          } else {
            // split on all types of space or tab
            const items = line.trim().split(/\s+/g).map(Number);
            if (items.length === cols) {
              facetDataArray.push(items);
            } else {
              console.warn('array length of this line not correct', items);
            }
          }
        }
      }

      return {
        data: facetDataArray,
        cols: cols,
        t: t
      };

    } else {
      // file data invalid
      throw Error('input data invalid');
    }
  }

  saveFile(data, cols, t) {
    let str = 'Facet Data ';
    if (cols === 5) {
      str = str.concat('5\n');
    }

    str = str.concat(t + '\n');

    for (let i = -4; i <= 12; i++) {
      for (let j = -9; j <= 9; j++) {
        if (data[i][j].valid) {
          const jj = j * 10;
          const ii = i * 10;
          const x = data[i][j].x.toFixed(2);
          const y = data[i][j].y.toFixed(2);

          if (cols === 5) {
            const diam = data[i][j].diam.toFixed(2);
            str = str.concat(jj + '\t' + ii + '\t' + x + '\t' + y + '\t' + diam + '\n');
          } else if (cols === 4) {
            str = str.concat(jj + '\t' + ii + '\t' + x + '\t' + y + '\n');
          } else {
            throw Error('Incompatible column size.');
          }
        }
      }
    }

    str = str.concat('END');

    return str;
  }

  determinePath() {
    try {
      const currentPathArray = this.filename.split('/');
      const fileName = currentPathArray.pop();

      if (currentPathArray.length && fileName) {
        let newFileName = '';
        const re = /(?:_)(\d+)(?=.)?/; // regex increment number
        const incrementMatchArray = fileName.match(re);

        if (incrementMatchArray) {
          let increment = parseInt(incrementMatchArray[1]); // parseInt(oldIncrement.substr(1)); // remove _
          increment++;
          newFileName = fileName.replace(incrementMatchArray[1], increment);
          return currentPathArray.join('/') + '/' + newFileName;  // new path

        } else {
          // no increment found
          const tempNameArray = fileName.split('.');
          if (tempNameArray.length === 2) {
            tempNameArray[0] += '_1';
            newFileName = tempNameArray.join('.');
            return currentPathArray.join('/') + '/' + newFileName;  // new path

          } else if (tempNameArray.length === 1) {
            // no file extension found
            newFileName = tempNameArray[0] + '_1.txt';
            return currentPathArray.join('/') + '/' + newFileName;  // new path
          } else {
            return false;
          }
        }
      } else {
        return false;
      }
    } catch (e) {
      return false;
    }
  }

}

module.exports = FileManager;
