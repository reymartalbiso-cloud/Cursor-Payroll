
async function testChatApi() {
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Say hello' }]
      })
    });
    
    if (response.ok) {
      console.log('Chat API Response OK - Streaming started');
      // Read the stream
      const reader = response.body.getReader();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += new TextDecoder().decode(value);
      }
      console.log('Final Content:', result);
    } else {
      const data = await response.json();
      console.error('Chat API Error Response:', data);
    }
  } catch (error) {
    console.error('Fetch Error:', error.message);
  }
}

testChatApi();
