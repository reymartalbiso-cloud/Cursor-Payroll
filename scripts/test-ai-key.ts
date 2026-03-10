
async function testOpenRouter() {
  const apiKey = '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';
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'minimax/minimax-m2.5',
        messages: [{ role: 'user', content: 'Say hello' }]
      })
    });
    
    const data = await response.json();
    if (response.ok) {
      console.log('OpenRouter Response:', data.choices[0].message.content);
    } else {
      console.error('OpenRouter Error:', data);
    }
  } catch (error: any) {
    console.error('Fetch Error:', error.message);
  }
}

testOpenRouter();
