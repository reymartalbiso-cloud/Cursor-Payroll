
async function testKey() {
  const apiKey = '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';
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-7b-instruct:free',
        messages: [{ role: 'user', content: 'Say hello' }]
      })
    });
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(data, null, 2));
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}
testKey();
