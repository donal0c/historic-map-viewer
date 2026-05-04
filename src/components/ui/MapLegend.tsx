export default function MapLegend() {
  return (
    <div className="map-legend" aria-label="Heritage layer legend">
      <span><i className="dot smr" /> Archaeology</span>
      <span><i className="dot niah" /> Architecture</span>
      <span><i className="dot excavations" /> Excavations</span>
      <span><i className="line zones" /> SMR zones</span>
      <small>NMS · NIAH · Excavations.ie</small>
    </div>
  );
}
