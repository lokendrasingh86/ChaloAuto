import { io } from 'socket.io-client';

const URL = 'http://localhost:8000'; // adjust this depending on backend port

export const socket = io(URL, {
  autoConnect: false,
});
