export interface TrajectoryPoint {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: number;
}

export interface TripTrajectoryResponse {
  tripId: string;
  totalDistanceKm: number;
  totalPoints: number;
  simplifiedPoints: number;
  compressionRatioPercent: number;
  polyline: Array<{ latitude: number; longitude: number; timestamp: number }>;
  completedAt: string;
}
