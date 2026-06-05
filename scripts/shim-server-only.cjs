/** Allow tsx scripts to import modules that use `import "server-only"`. */
const Module = require("node:module")
const originalLoad = Module._load
Module._load = function shimServerOnly(request, parent, isMain) {
  if (request === "server-only") {
    return {}
  }
  return originalLoad(request, parent, isMain)
}
