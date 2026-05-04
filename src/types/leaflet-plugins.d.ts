import "leaflet";

// leaflet-side-by-side
declare module "leaflet" {
  namespace control {
    function sideBySide(
      leftLayers: L.TileLayer | L.TileLayer[],
      rightLayers: L.TileLayer | L.TileLayer[]
    ): L.Control;
  }
}

// leaflet.sync patches L.Map.prototype
declare module "leaflet" {
  interface Map {
    sync(other: Map, options?: { noInitialSync?: boolean }): this;
    unsync(other: Map): this;
    isSynced(): boolean;
  }
}

declare module "leaflet-side-by-side" {
  export {};
}

declare module "leaflet.sync" {
  export {};
}
