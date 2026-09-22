/** Tipos do domínio — espelho fiel de SPEC-001 §1. */

export type Role = 'PROFESSOR' | 'ADMIN';
export type ReservationStatus = 'ACTIVE' | 'CANCELLED';

/** INV-4: este tipo é o único lugar onde o hash existe; nunca é serializado. */
export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
};

export type PublicUser = Omit<User, 'passwordHash'>;

export type Room = {
  id: string;
  code: string;
  name: string;
  capacity: number;
  building: string;
  active: boolean;
  createdAt: string;
};

export type Reservation = {
  id: string;
  roomId: string;
  userId: string;
  purpose: string;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  createdAt: string;
};

export type ReservationView = Reservation & {
  room: { code: string; name: string };
  user: { name: string };
};
