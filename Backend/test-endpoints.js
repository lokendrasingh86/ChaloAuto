
const API_URL = 'http://localhost:5000/api';

async function testEndpoints() {
    console.log('Testing Health Endpoint...');
    try {
        const response = await fetch(`${API_URL}/health`); // Reverted to generic endpoint
        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Response:', text);
    } catch (e) {
        console.error('Error connecting to the server:', e.message);
    }
}

testEndpoints();