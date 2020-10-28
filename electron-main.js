"use strict";

const { app, BrowserWindow } = require("electron");
const http = require('http');
const path = require("path");

// Keep a global reference of the mainWindowdow object, if you don't, the mainWindowdow will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null;
let subpy = null;

const PY_DIST_FOLDER = "dist-python"; // python distributable folder
const PY_SRC_FOLDER = "."; // path to the python source
const PY_MODULE = "zen-canvas-backend"; // the name of the main module (without extension)

const isRunningInBundle = () => {
  return require("fs").existsSync(path.join(__dirname, PY_DIST_FOLDER));
};

const getPythonScriptPath = () => {
  if (!isRunningInBundle()) {
    return path.join(__dirname, PY_SRC_FOLDER, PY_MODULE + ".py");
  }
  console.log("Zen Canvas running in a bundle");

  if (process.platform === "win32") {
    // On Windows: run ./dist_python/zen-canvas-backend/zen-canvas-backend.exe
    return path.join(
      __dirname,
      PY_DIST_FOLDER,
      PY_MODULE,
      PY_MODULE + ".exe"
    );
  }

  // On other OS: run ./dist_python/zen-canvas-backend/zen-canvas-backend
  return path.join(__dirname, PY_DIST_FOLDER, PY_MODULE, PY_MODULE);
};

const startPythonSubprocess = () => {
  let script = getPythonScriptPath();
  console.log("Executing", script);
  if (isRunningInBundle()) {
    subpy = require("child_process").execFile(script, []);
  } else {
    subpy = require("child_process").spawn("python", [script], {stdio: "inherit"});
  }
  console.log("Spawned PID", subpy.pid);
};

const killPythonSubprocesses = main_pid => {
  const python_script_name = path.basename(getPythonScriptPath());
  let cleanup_completed = false;
  const psTree = require("ps-tree");
  psTree(main_pid, function(err, children) {
    let python_pids = children
      .filter(function(el) {
        // return el.COMMAND === python_script_name;

        // Spawned command in bundle will be run_app or run_app.exe, so we use this heuristic
        return el.COMMAND.indexOf(PY_MODULE) === 0;
      })
      .map(function(p) {
        console.log("killPythonSubprocesses", p);
        return p.PID;
      });
    // kill all the spawned python processes
    python_pids.forEach(function(pid) {
      process.kill(pid);
    });
    subpy = null;
    cleanup_completed = true;
  });
  return new Promise(function(resolve, reject) {
    (function waitForSubProcessCleanup() {
      if (cleanup_completed) return resolve();
      setTimeout(waitForSubProcessCleanup, 30);
    })();
  });

  // Not so easy! PyInstaller bundle spawns children from the top-level process, but doesn't propagate signals to them
  // return new Promise(function(resolve, reject) {
  //   subpy.kill();
  //   return resolve();
  // });
};

const createMainWindow = () => {
  // Create the browser mainWindow
  const splashWindow = new BrowserWindow({
    width: 640,
    height: 451,
    // transparent: true, // transparent header bar
    icon: __dirname + "/icon.png",
    // fullscreen: true,
    // opacity:0.8,
    darkTheme: true,
    frame: false,
    resizeable: true,
    backgroundColor: '#2f363c',
    show: false,
  });

  // Only drawback of opening the image file directly is that it is draggable
  splashWindow.loadFile(__dirname + "/electron-resources/splash.png");
  splashWindow.on("ready-to-show", () => splashWindow.show());

  // Now wait for the backend server start up. Continuously poll the HTTP endpoint until we receive a page.
  // TODO: At some point, we should time out and display an error message
  // TODO: If the child process dies, we should give up and display an error message

  const REQUEST_TIMEOUT_MS = 100;
  const RETRY_INTERVAL_MS = 50;

  const pingServerAndNavigateIfSuccessful = (url) => {
    http.get(url, {timeout: REQUEST_TIMEOUT_MS}, (res) => {
      // const { statusCode } = res;
      // const contentType = res.headers['content-type'];
      //
      // let error;
      // Any 2xx status code signals a successful response but
      // here we're only checking for 200.
      // if (statusCode !== 200) {
      //   error = new Error('Request Failed.\n' + `Status Code: ${statusCode}`);
      // }
      // if (error) {
      //   console.error(error.message);
      //   // Consume response data to free up memory
      //   res.resume();
      //
      //   setTimeout(() => pingServerAndNavigateIfSuccessful(url), 100);
      //   return;
      // }

      // Create the browser mainWindow
      mainWindow = new BrowserWindow({
        width: 1280,
        height: 902,
        // transparent: true, // transparent header bar
        icon: __dirname + "/icon.png",
        // fullscreen: true,
        // opacity:0.8,
        darkTheme: true,
        frame: false,
        resizeable: true,
        backgroundColor: '#2f363c',
        show: false,
      });

      // Load the index page
      mainWindow.loadURL(url);

      mainWindow.on("ready-to-show", () => {
        splashWindow.close();
        mainWindow.show();

        // Open the DevTools.
        //mainWindow.webContents.openDevTools();
      });

      // Emitted when the mainWindow is closed.
      mainWindow.on("closed", function() {
        // Dereference the mainWindow object
        mainWindow = null;
      });
    }).on('error', (e) => {
      console.error(`Got error: ${e.message}`);

      // Retry shortly
      setTimeout(() => pingServerAndNavigateIfSuccessful(url), RETRY_INTERVAL_MS);
    });
  };

  const url = "http://localhost:5000/";
  pingServerAndNavigateIfSuccessful(url);
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", function() {
  // start the backend server
  startPythonSubprocess();
  createMainWindow();
});

// disable menu
app.on("browser-window-created", function(e, window) {
  window.setMenu(null);
});

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    let main_process_pid = process.pid;
    killPythonSubprocesses(main_process_pid).then(() => {
      app.quit();
    });
  }
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (subpy == null) {
    startPythonSubprocess();
  }
  if (win === null) {
    createWindow();
  }
});

app.on("quit", function() {
  // do some additional cleanup
});
