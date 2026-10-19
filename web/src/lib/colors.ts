/** Cor de presença estável para um id (p1..p8 dos tokens). */
const PRESENCE = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
export const colorFor = (id: string) => PRESENCE[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % PRESENCE.length];
