import http from 'http';

const data = JSON.stringify({
    email: 'admin@company.com',
    password: 'admin123'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    let responseData = '';
    res.on('data', (d) => {
        responseData += d;
    });
    res.on('end', () => {
        console.log('Response body:', responseData);
    });
});

req.on('error', (error) => {
    console.error('Request error:', error);
});

req.write(data);
req.end();
