// Vite resolves `?url` imports to the served/hashed asset URL. Declared here
// because @geolibre/plugins does not pull in vite/client's ambient module
// types; only this one asset is imported that way.
//
// The worker is imported for its URL, never for its exports: `pdfjs-dist`
// creates a `Worker` from `GlobalWorkerOptions.workerSrc`, and pointing that at
// the emitted asset keeps the worker on the app's own origin (see
// `configurePdfWorker` in `plugins/geopdf/geopdf-render.ts`).
declare module "pdfjs-dist/build/pdf.worker.min.mjs?url" {
  const url: string;
  export default url;
}
