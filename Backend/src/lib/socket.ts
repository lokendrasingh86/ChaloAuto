import { io } from "../index.ts";
export const emitToUser = (userId: string, event: string, data: any) => {
  io.to(userId).emit(event, data);
};