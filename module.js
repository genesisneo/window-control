const electron = require('electron');
const ffi = require('ffi-napi');

// create foreign function
const user32 = new ffi.Library('user32', {
  'GetForegroundWindow': ['long', []],
  'ShowWindow': ['bool', ['long', 'int']],
  'GetWindowRect': ['bool', ['long', 'pointer']],
  'SetWindowPos': ['bool', ['long', 'long', 'int', 'int', 'int', 'int', 'uint']]
});

// create rectangle from pointer
const pointerToRect = function (rectPointer) {
  const rect = {};
  rect.left = rectPointer.readInt16LE(0);
  rect.top = rectPointer.readInt16LE(4);
  rect.right = rectPointer.readInt16LE(8);
  rect.bottom = rectPointer.readInt16LE(12);
  return rect;
}

// obtain window dimension
const getWindowDimensions = function (handle) {
  const rectPointer = Buffer.alloc(16);
  const getWindowRect = user32.GetWindowRect(handle, rectPointer);
  if (!getWindowRect) return null;
  return pointerToRect(rectPointer);
}

module.exports = function (position) { 
  // electron screens
  const screens = electron.screen;
  const getCursorScreenPoint = screens.getCursorScreenPoint();
  const activeMonitor = screens.getAllDisplays().length > 1
    // get monitor where mouse is active
    ? screens.getDisplayNearestPoint(getCursorScreenPoint)
    // get the primary monitor
    : screens.getPrimaryDisplay();

  // multiply value by current scale factor
  const multiplyByScaleFactor = function (value) {
    return Math.round(value * activeMonitor.scaleFactor);
  };

  // window margin { left: 7, ttop: 0, right: 7, bottom: 7 } + 1px border
  const singleSideMargin = multiplyByScaleFactor(8 - activeMonitor.scaleFactor);
  const bothSideMargin = multiplyByScaleFactor(16 - (activeMonitor.scaleFactor * 2));

  // screenBounds
  const screenBounds = activeMonitor.bounds;
  const screenBoundsX = screenBounds.x * screens.getPrimaryDisplay().scaleFactor;
  const screenBoundsY = screenBounds.y;

  // screenWorkAreaSize
  const screenWorkAreaSize = activeMonitor.workAreaSize;
  const screenWorkAreaSizeWidth = multiplyByScaleFactor(screenWorkAreaSize.width);
  const screenWorkAreaSizeHeight = multiplyByScaleFactor(screenWorkAreaSize.height);

  // computed bounds
  const boundsXDefault = screenBoundsX - singleSideMargin;
  const boundsXMiddle = ((((screenBoundsX + screenWorkAreaSizeWidth) - screenBoundsX) / 2) + screenBoundsX) - singleSideMargin;
  const boundsYDefault = screenBoundsY;
  const boundsYMiddle = ((((screenBoundsY + screenWorkAreaSizeHeight) - screenBoundsY) / 2) + screenBoundsY);
  const boundsWithFull = screenWorkAreaSizeWidth + bothSideMargin;
  const boundsWidthHalf = (screenWorkAreaSizeWidth / 2) + bothSideMargin;
  const boundsHeightFull = screenWorkAreaSizeHeight + singleSideMargin;
  const boundsHeightHalf = (screenWorkAreaSizeHeight / 2) + singleSideMargin;

  // get active window
  const activeWindow = user32.GetForegroundWindow();
  // get and set window dimension
  const activeWindowDimensions = getWindowDimensions(activeWindow);
  // create bounds object
  const bounds = {}

  switch (position) {
    // upper left
    case 'ul':
      bounds.x = boundsXDefault;
      bounds.y = boundsYDefault;
      bounds.w = boundsWidthHalf;
      bounds.h = boundsHeightHalf;
      break;

    // upper half
    case 'uh':
      bounds.x = boundsXDefault;
      bounds.y = boundsYDefault;
      bounds.w = boundsWithFull;
      bounds.h = boundsHeightHalf;
      break;

    // upper right
    case 'ur':
      bounds.x = boundsXMiddle;
      bounds.y = boundsYDefault;
      bounds.w = boundsWidthHalf;
      bounds.h = boundsHeightHalf;
      break;

    // half left
    case 'hl':
      bounds.x = boundsXDefault;
      bounds.y = boundsYDefault;
      bounds.w = boundsWidthHalf;
      bounds.h = boundsHeightFull;
      break;

    // center
    case 'c':
      const currentWidth = activeWindowDimensions.right - activeWindowDimensions.left;
      const currentHeight = activeWindowDimensions.bottom - activeWindowDimensions.top;
      const halfScreenWidth = ((((screenBoundsX + screenWorkAreaSizeWidth) - screenBoundsX) / 2) + screenBoundsX);
      const halfScreenHeight = ((((screenBoundsY + screenWorkAreaSizeHeight) - screenBoundsY) / 2) + screenBoundsY);
      bounds.x = halfScreenWidth - (currentWidth / 2);
      bounds.y = halfScreenHeight - (currentHeight / 2);
      bounds.w = currentWidth;
      bounds.h = currentHeight;
      break;

    // half right
    case 'hr':
      bounds.x = boundsXMiddle;
      bounds.y = boundsYDefault;
      bounds.w = boundsWidthHalf;
      bounds.h = boundsHeightFull;
      break;

    // lower left
    case 'll':
      bounds.x = boundsXDefault;
      bounds.y = boundsYMiddle;
      bounds.w = boundsWidthHalf;
      bounds.h = boundsHeightHalf;
      break;

    // lower half
    case 'lh':
      bounds.x = boundsXDefault;
      bounds.y = boundsYMiddle;
      bounds.w = boundsWithFull;
      bounds.h = boundsHeightHalf;
      break;

    // lower right
    case 'lr':
      bounds.x = boundsXMiddle;
      bounds.y = boundsYMiddle;
      bounds.w = boundsWidthHalf;
      bounds.h = boundsHeightHalf;
      break;

    // fallback
    default:
      console.log(
        '+ Supported Position:\n' +
        '- Upper Left: \t windowControl("ul") \n' +
        '- Upper Half: \t windowControl("uh") \n' +
        '- Upper Right: \t windowControl("ur") \n' +
        '- Half Left: \t windowControl("hl") \n' +
        '- Center: \t\t windowControl("c") \n' +
        '- Half Right: \t windowControl("hr") \n' +
        '- Lower Left: \t windowControl("ll") \n' +
        '- Lower Half: \t windowControl("lh") \n' +
        '- Lower Right: \t windowControl("lr")'
      );
      break;
  }

  // force active window to restore mode
  user32.ShowWindow(activeWindow, 9);
  // set window position based on bounds values
  user32.SetWindowPos(
    activeWindow,
    0,
    bounds.x,
    bounds.y,
    bounds.w,
    bounds.h,
    0x4000 | 0x0020 | 0x0020 | 0x0040
  );
}