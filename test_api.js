async function testFetch() {
  const url = 'http://localhost:3000/api/users?roles=OPERATOR,SUBCONTRATISTA';
  // We can't easily send the session from a node script without cookies.
  // But we can check if the API is returning 403.
  try {
    const resp = await fetch(url);
    console.log('Status:', resp.status);
    const data = await resp.json();
    console.log('Data:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

testFetch();
