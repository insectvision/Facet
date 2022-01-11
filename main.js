const electron = require('electron');
const { app, BrowserWindow, Menu, dialog, ipcMain, MessageChannelMain } = require('electron');
const fs = require('fs');
const remote = require('@electron/remote/main');
remote.initialize();

const FileManager = require('./src/app/file-manager');
const DataModel = require('./src/app/data-model');

const debug = false; // opens consoles if true

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let angularWindow = null;
let facetWindow = null;
let orthoWindow = null;
let helpWindow = null;

let fileManager = null;
let facetData = null;

let menu = null; // application menu
let dirty = false;
let crossings = null;

// globals can be read directly by windows
global.data = {};
global.saveData = {};
global.psIndex = 1;
global.cols = 4;
global.t = 0;

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
	createMenu();
	app.focus();

	// create filemanager instance
	fileManager = new FileManager();
	// create facet data instance
	facetData = new DataModel();

	// open file dialog
	openFile();

	ipcMain.on('refresh-views', (event, arg) => {
		updateViews();
	});

	ipcMain.on('update-crossings', (event, arg) => {
		crossings = arg;
	});

	// updates point position
	ipcMain.on('update-point', (event, arg) => {
		const i = arg.key.i;
		const j = arg.key.j;

		// add to undo array
		facetData.addUndo(
			JSON.stringify({
				key: arg.key,
				value: global.data[i][j],
				action: 'move'
			})
		);
		//enable undo menu item
		enableUndo();

		facetData.redo = null;

		updatePosition(i, j, arg.value);
		updateViews();
		setDirty(true);
	});

	ipcMain.on('insert-point', (event, arg) => {
		global.data = arg.data;
		global.saveData = arg.saveData;
		// add to undo array
		facetData.addUndo(
			JSON.stringify({
				key: { 'i': arg.key.i, 'j': arg.key.j },
				action: 'insert'
			})
		);

		//enable undo menu item
		enableUndo();
		updateViews();
		setDirty(true);
	});

	// save file after svg data is created
	ipcMain.on('export-svg', (event, arg) => {
		exportSVG(arg.svg, arg.theta0, arg.fi0);
	});

});

function resetUndoRedo() {
	facetData.undo = [];
	facetData.redo = null;
	disableUndo();
	disableRedo();
}

function undo() {
	if (facetData.undo.length) {
		const prevDataObj = JSON.parse(facetData.getUndo());
		const i = prevDataObj.key.i;
		const j = prevDataObj.key.j;

		facetData.redo = JSON.stringify({
			'key': prevDataObj.key,
			'value': global.data[i][j],
			'action': prevDataObj.action
		});

		switch (prevDataObj.action) {
			// move point
			case 'move': {
				updatePosition(i, j, prevDataObj.value);
				break;
			}
			// insert point
			case 'insert': {
				global.data[i][j] = {
					'valid': false,
					'x': 0,
					'y': 0,
					'fake': true
				};
				global.saveData[i][j] = {
					'valid': false,
					'x': 0,
					'y': 0,
					'fake': true
				};
				break;
			}
		}

		if (facetData.undo.length === 0) {
			// disable undo menu item
			disableUndo();
			setDirty(false);
		}

		// enable redo menu item
		enableRedo();
		updateViews();

	} else {
		// disable undo menu item
		disableUndo();
		dialog.showErrorBox('Nothing to Undo.');
	}
}

function redo() {
	if (facetData.redo) {
		// add to undo array

		setDirty(true);

		// parse undo var
		const obj = JSON.parse(facetData.redo);
		const i = obj.key.i;
		const j = obj.key.j;

		facetData.addUndo(
			JSON.stringify({
				'key': obj.key,
				'action': obj.action,
				'value': global.data[i][j],
			})
		);

		// enable undo menu item
		enableUndo();

		switch (obj.action) {
			case 'move': {
				// move point
				updatePosition(i, j, obj.value);
				break;
			}
			case 'insert': {
				// insert point
				global.data[i][j] = obj.value;
				break;
			}
		}
		updateViews();

	} else {
		dialog.showErrorBox('Nothing to Redo.');
	}
	// disable redo menu item
	disableRedo();
	facetData.redo = null;
}

function enableUndo() {
	menu.items[2].submenu.items[0].enabled = true;
}

function disableUndo() {
	menu.items[2].submenu.items[0].enabled = false;
}

function enableRedo() {
	menu.items[2].submenu.items[1].enabled = true;
}

function disableRedo() {
	menu.items[2].submenu.items[1].enabled = false;
}

function updatePosition(i, j, value) {
	global.data[i][j].x = value.x;
	global.data[i][j].y = value.y;
}

function updateViews() {
	angularWindow.webContents.send('update', { 'data': global.data, 'cols': global.cols });
	facetWindow.webContents.send('update', { data: global.data, saveData: global.saveData });
	if(orthoWindow) {
		const message = {
			cols: global.cols,
			data: global.data,
			crossings: crossings
		};
		orthoWindow.webContents.send('update', message);
	}
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	// if (win === null) {
	//   createWindow();
	// }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

function createMenu() {
	const template = [
		{
			label: 'File',
			submenu: [
				{
					label: 'Open',
					click() { openFile(); },
					accelerator: 'CmdOrCtrl+O',
				},
				{
					label: 'Save',
					click() { saveFile(true); },
					enabled: false,
					accelerator: 'CmdOrCtrl+S',
				},
				{
					label: 'Save As',
					click() { saveFile(false); },
					enabled: false,
					accelerator: 'CmdOrCtrl+Shift+S',
				}
			]
		},
		{
			label: 'Edit',
			submenu: [
				{
					label: 'Undo',
					click() { undo(); },
					enabled: false,
					accelerator: 'CmdOrCtrl+Z',
				},
				{
					label: 'Redo',
					click() { redo(); },
					enabled: false,
					accelerator: 'CmdOrCtrl+Shift+Z',
				},
			]
		},
		{
			label: 'Actions',
			submenu: [
				{
					label: 'Reverse Y',
					click() { reverseY(); }
				},
				{ type: 'separator' },
				{
					label: 'Preview Data',
					click() { openPreviewGlobeWindow(); }
				},
				{
					label: 'Export SVG File',
					click() { exportFile(); }
				},
				{ type: 'separator' },
				{
					label: 'Insert Data',
					click() { insertData(); facetWindow.focus(); },
					accelerator: 'CmdOrCtrl+I',
				}
			]
		},
		{
			label: 'Plot Options',
			submenu: [
				{
					label: 'Average Plot',
					click() { setPlotType(1); },
					type: 'radio'
				},
				{
					label: 'X Plot',
					click() { setPlotType(2); },
					type: 'radio'
				},
				{
					label: 'Y Plot',
					click() { setPlotType(3); },
					type: 'radio'
				},
				{
					label: 'Z Plot',
					click() { setPlotType(4); },
					type: 'radio'
				},
				{
					label: 'Eye Parameter',
					click() { setPlotType(5); },
					type: 'radio'
				},
				{
					label: 'Diameter Data',
					click() { setPlotType(6); },
					type: 'radio'
				},
			]
		},
		// {
		// 	label: 'View',
		// 	submenu: [
		// 		{ role: 'reload' },
		// 		{ role: 'forcereload' },
				// { role: 'toggledevtools' },
		// 	]
		// },
		{
			role: 'window',
			submenu: [
				{ role: 'close' },
				{ role: 'minimize' },
				{ type: 'separator' },
				{ role: 'front' }
			]
		},
		{
			role: 'help',
			submenu: [
				{
					label: 'Documentation',
					click() { openHelpWindow(); }
				}
			]
		}
	];

	// if macOS add to menu
	if (process.platform === 'darwin') {
		template.unshift({
			label: app.getName(),
			submenu: [
				{ role: 'about' },
				{ type: 'separator' },
				{ role: 'services', submenu: [] },
				{ type: 'separator' },
				{ role: 'hide' },
				{ role: 'hideothers' },
				{ role: 'unhide' },
				{ type: 'separator' },
				{ role: 'quit' }
			]
		});

	}

	menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);
}

function openFile() {
	dialog.showOpenDialog({ properties: ['openFile', 'openDirectory', 'multiSelections'] }).then(value => {
		if (!value.canceled) {
			const fileNames = value.filePaths;
			if (angularWindow) {
				angularWindow.close();
			}
			if (facetWindow) {
				facetWindow.close();
			}
			if (orthoWindow) {
				orthoWindow.close();
			}
	
			if (fileNames === undefined || fileNames.length < 1) {
				// user cancelled, probably...
				return null;
			}
	
			const fileName = fileNames[0];
	
			fs.readFile(fileName, 'utf8', (err, data) => {
				if (err) {
					dialog.showErrorBox('Open Error', 'An error ocurred opening the file. ' + err.message);
	
				} else {
	
					fileManager.filename = fileName;
					// reset plot save path
					fileManager.exportPath = '';
	
					// read data from a file
					const fileReadResult = fileManager.readData(data);

					global.cols = parseInt(fileReadResult.cols);
					global.t = parseFloat(fileReadResult.t);
	
					// format file data into data modela
					global.data = facetData.create(fileReadResult.data, global.cols);
					global.saveData = JSON.parse(JSON.stringify(global.data));

					if (global.data && typeof global.t === 'number' &&  Number.isInteger(global.cols)){
						// set menu options
						setPlotMenuOptions(global.cols);

						// open windows
						openAngularWindow();
						openFacetWindow();

						// set status as clean
						setDirty(false);
						resetUndoRedo();
						
						// enable saveAs
						menu.items[1].submenu.items[2].enabled = true;
					} else {
						dialog.showErrorBox('An error ocurred opening the file.', `data: ${typeof global.data === 'object'}, t: ${typeof global.t === 'number'}, cols: ${Number.isInteger(global.cols)}`);
					}
				}
			});
		}
	});
}

function setPlotMenuOptions(cols){
	// plot menu items p, d
	if(cols === 5) {
		menu.items[4].submenu.items[4].enabled = true;
		menu.items[4].submenu.items[5].enabled = true;
	}else{
		menu.items[4].submenu.items[4].enabled = false;
		menu.items[4].submenu.items[5].enabled = false;
	}
}

function openHelpWindow() {
	if (helpWindow === null) {
		helpWindow = new BrowserWindow({
			width: 800,
			height: 600,
			title: 'Facet Help'
		});

		helpWindow.loadFile('./src/app/help.html');

		// Open the DevTools.
		if (debug) helpWindow.webContents.openDevTools();

		// Emitted when the window is closed.
		helpWindow.on('closed', () => {
			// Dereference the window object, usually you would store windows
			// in an array if your app supports multi windows, this is the time
			// when you should delete the corresponding element.
			helpWindow = null;
		});
	}
}

function openAngularWindow() {
	angularWindow = new BrowserWindow({
		width: 600,
		height: 600,
		title: 'Angular Space',
		x: 0,
		y: 0,
		webPreferences: {
			// preload: path.join(app.getAppPath(), './src/app/angular-view/preload.js'),
			nodeIntegration: true,
			contextIsolation: false,
			enableRemoteModule: true,
		}
	});
	remote.enable(angularWindow.webContents)

	angularWindow.loadFile('./src/app/angular-view/angular-view.html').then(() => {
		const message = {
			cols: global.cols,
			data: global.data
		};
		// angularWindow.webContents.send('setup', message);
		angularWindow.webContents.send('update', message);
		
	}).catch(err => dialog.showErrorBox('Problem loading angular space.', err.message))

	// Open the DevTools.
	if (debug) angularWindow.webContents.openDevTools();

	// Emitted when the window is closed.
	angularWindow.on('closed', () => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		angularWindow = null;
	});
}

function openFacetWindow() {
	const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;

	facetWindow = new BrowserWindow({
		width: 1024,
		height: 900,
		title: 'Facet Space',
		x: width - 1024,
		y: 0,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			enableRemoteModule: true
		}
	});

	remote.enable(facetWindow.webContents);

	if (debug) facetWindow.webContents.openDevTools();

	facetWindow.loadFile('./src/app/facet-view/facet-view.html').then(() => {
		const message = {
			cols: global.cols,
			data: global.data,
			saveData: global.saveData
		};
		// facetWindow.webContents.send('setup', message);
		facetWindow.webContents.send('update', message);
	})

	// Emitted when the window is closed.
	facetWindow.on('closed', () => {
		facetWindow = null;
	});

}

function exportFile() {
	if(crossings){
		const message = {
			cols: global.cols,
			data: global.data,
			crossings: crossings
		};
		if (!orthoWindow) {
			createOrthoWindow();
			orthoWindow.webContents.on('did-finish-load', () => {
				orthoWindow.webContents.send('export', message);
			});
		} else {
			orthoWindow.webContents.send('export', message);
		}
	}else {
		console.error('no crossings');
		system.beep();
	}


}

function openPreviewGlobeWindow() {
	const message = {
		cols: global.cols,
		data: global.data,
		crossings: crossings
	};

	if (!orthoWindow) {
		createOrthoWindow();
		orthoWindow.webContents.on('did-finish-load', () => {
			orthoWindow.webContents.send('update', message);
		});
	} else {
		orthoWindow.webContents.send('update', message);
	}

}

function createOrthoWindow() {
	orthoWindow = new BrowserWindow({
		width: 800,
		height: 600,
		title: 'Ortho Space',
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			enableRemoteModule: true,
		}
	});

	remote.enable(orthoWindow.webContents);

	if (debug) orthoWindow.webContents.openDevTools();

	orthoWindow.loadFile('./src/app/ortho-view/ortho-view.html');

	orthoWindow.on('closed', () => {
		orthoWindow = null;
	});
}

function saveFile(saveDirectly) {
	if (saveDirectly) {
		const path = fileManager.determinePath();
		if(path) {
			writeFileToDisk(path);
		}else {
			saveAs();
		}
	} else {
		saveAs();
	}

}

async function saveAs() {
	// save with dialog box
	const defaultFilename = fileManager.filename;
	const result = await dialog.showSaveDialog({
		filters: [{name: 'Text Files', extensions: ['txt']}],
		defaultPath: defaultFilename
	})
	if (result.canceled) {
		// cancelled
		console.warn('file not saved');
	} else {
		writeFileToDisk(result.filePath);
	}
}

function writeFileToDisk(fileName) {
	// console.log('writeFileToDisk - fileName', fileName);
	const content = fileManager.saveFile(global.data, global.cols, global.t);
	// fileName is a string that contains the path and filename created in the save file dialog.
	fs.writeFile(fileName, content, (err) => {
		console.error('err', err)
		if (err) {
			dialog.showErrorBox('Save Error', 'An error ocurred creating the file ' + err.message);
		} else {
			dialog.showMessageBox({ type: 'info', message: 'The file has been succesfully saved' });
			fileManager.filename = fileName;
		}
	});
}

async function exportSVG(svgFile, theta0, fi0) {
	let path = '';
	if (fileManager.exportPath) {
		path = fileManager.exportPath;
	} else {
		path = fileManager.filename.substr(0, fileManager.filename.lastIndexOf('.')) || fileManager.filename;
	}

	let plotType = '';
	if ([1, 2, 3, 4, 5, 6].includes(global.psIndex)) {
		switch (global.psIndex) {
			case 1:
				plotType = 'A';
				break;
			case 2:
				plotType = 'X';
				break;
			case 3:
				plotType = 'Y';
				break;
			case 4:
				plotType = 'Z';
				break;
			case 5:
				plotType = 'p';
				break;
			case 6:
				plotType = 'D';
				break;
			default:
				break;
		}
	}
	path += '-' + plotType + ' ' + theta0 + ' ' + fi0 + '.svg';

	const result = await dialog.showSaveDialog({
		filters: [{name: 'Images', extensions: ['svg']}],
		defaultPath: path
	})

	if (result.canceled) {

	} else {
		// fileName is a string that contains the path and filename created in the save file dialog.
		fs.writeFile(result.filePath, svgFile, (err) => {
			if (err) {
				dialog.showErrorBox('Save Error', 'An error ocurred creating the file ' + err.message);
			}
			fileManager.exportPath = result.filePath;
			dialog.showMessageBox({type: 'info', message: 'The file has been succesfully saved'});
		});
	}

}

function reverseY() {
	global.data = facetData.reverseY(global.data);
	updateViews();
}

function insertData() {
	facetWindow.webContents.send('insertData', true);
}

function setPlotType(value) {
	global.psIndex = value;
}

function setDirty(val) {
	dirty = val;
	//enable or disable save menu item
	menu.items[1].submenu.items[1].enabled = val;
}
