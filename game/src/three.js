// Three.js entry: the vendored build is a UMD bundle, so importing it as a
// module leaves the namespace empty and puts the API on globalThis.THREE.
// Load it once for its side effect and re-export that global.
import '../vendor/three.min.js';

export const THREE = globalThis.THREE;
