import { io } from 'socket.io-client';

const API_URL = 'http://localhost:3000/api';
const SOCKET_URL = 'http://localhost:3000'; // Make sure it matches your server port

async function testSystem() {
  console.log('--- 1. Testing API Endpoints ---');
  try {
    const res = await fetch(`http://localhost:3000/health`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.text();
    console.log('✅ API Health Check Successful:', data);
  } catch (error) {
    console.error('❌ API Health Check Failed:', error.message);
  }

  console.log('\n--- 2. Testing Socket.io Connection ---');
  const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

  socket.on('connect', () => {
    console.log(`✅ Socket connected successfully (ID: ${socket.id})`);
    
    // Test a common event if you have one, or just confirm connection
    console.log('Testing driver location update event emission...');
    socket.emit('updateLocation', { driverId: 'test-driver', lat: 28.7, lng: 77.1 });
    
    setTimeout(() => {
        console.log('✅ Socket test complete. Disconnecting...');
        socket.disconnect();
        process.exit(0);
    }, 2000);
  });

  socket.on('connect_error', (err) => {
    console.error('❌ Socket Connection Failed:', err.message);
    process.exit(1);
  });
}

testSystem();
