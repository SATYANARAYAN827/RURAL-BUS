import { customType } from 'drizzle-orm/pg-core';

export interface PointLocation {
  latitude: number;
  longitude: number;
}

export interface LineStringTrajectory {
  points: Array<{ latitude: number; longitude: number }>;
}

/**
 * PostGIS Point Geometry (SRID 4326 - WGS 84)
 */
export const postgisPoint = customType<{
  data: PointLocation;
  driverData: string;
}>({
  dataType() {
    return 'geometry(Point, 4326)';
  },
  toDriver(value: PointLocation): string {
    return `SRID=4326;POINT(${value.longitude} ${value.latitude})`;
  },
  fromDriver(value: string | unknown): PointLocation {
    if (typeof value === 'string') {
      const match = value.match(/POINT\s*\(\s*([^ ]+)\s+([^ ]+)\s*\)/i);
      if (match) {
        return {
          longitude: parseFloat(match[1]),
          latitude: parseFloat(match[2]),
        };
      }

      // Parse HexEWKB representation
      if (/^[0-9a-fA-F]+$/.test(value) && value.length >= 42) {
        try {
          const buf = Buffer.from(value, 'hex');
          const isLittleEndian = buf.readUInt8(0) === 1;
          const geomType = isLittleEndian ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
          const hasSrid = (geomType & 0x20000000) !== 0;
          let offset = 5;
          if (hasSrid) offset += 4;

          const lng = isLittleEndian ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset);
          const lat = isLittleEndian ? buf.readDoubleLE(offset + 8) : buf.readDoubleBE(offset + 8);
          return { longitude: lng, latitude: lat };
        } catch {
          // fallback
        }
      }
    }
    return value as PointLocation;
  },
});

/**
 * PostGIS LineString Geometry (SRID 4326 - WGS 84)
 */
export const postgisLineString = customType<{
  data: LineStringTrajectory;
  driverData: string;
}>({
  dataType() {
    return 'geometry(LineString, 4326)';
  },
  toDriver(value: LineStringTrajectory): string {
    const coords = value.points.map((p) => `${p.longitude} ${p.latitude}`).join(', ');
    return `SRID=4326;LINESTRING(${coords})`;
  },
  fromDriver(value: string | unknown): LineStringTrajectory {
    if (typeof value === 'string') {
      const match = value.match(/LINESTRING\s*\((.+)\)/i);
      if (match) {
        const pairs = match[1].split(',').map((pair) => pair.trim().split(/\s+/));
        return {
          points: pairs.map(([lng, lat]) => ({
            longitude: parseFloat(lng),
            latitude: parseFloat(lat),
          })),
        };
      }

      // Parse HexEWKB representation
      if (/^[0-9a-fA-F]+$/.test(value) && value.length >= 18) {
        try {
          const buf = Buffer.from(value, 'hex');
          const isLittleEndian = buf.readUInt8(0) === 1;
          const geomType = isLittleEndian ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
          const hasSrid = (geomType & 0x20000000) !== 0;
          let offset = 5;
          if (hasSrid) offset += 4;

          const numPoints = isLittleEndian ? buf.readUInt32LE(offset) : buf.readUInt32BE(offset);
          offset += 4;
          const points: Array<{ latitude: number; longitude: number }> = [];

          for (let i = 0; i < numPoints; i++) {
            const lng = isLittleEndian ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset);
            const lat = isLittleEndian ? buf.readDoubleLE(offset + 8) : buf.readDoubleBE(offset + 8);
            points.push({ longitude: lng, latitude: lat });
            offset += 16;
          }
          return { points };
        } catch {
          // fallback
        }
      }
    }
    return value as LineStringTrajectory;
  },
});
