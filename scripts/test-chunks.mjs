async function testChunks() {
  const routes = ['/onboarding', '/discover', '/matches', '/chats', '/profile'];
  for (const r of routes) {
    const res = await fetch(`http://localhost:3000${r}`);
    const html = await res.text();
    const scriptMatches = [...html.matchAll(/src="(\/_next\/static\/[^"]+)"/g)];
    console.log(`\nRoute ${r}: Found ${scriptMatches.length} script tags`);
    for (const m of scriptMatches) {
      const scriptUrl = `http://localhost:3000${m[1]}`;
      const sRes = await fetch(scriptUrl);
      console.log(`  ${sRes.status} -> ${m[1]}`);
      if (sRes.status !== 200) {
        console.error(`FAIL: ${scriptUrl} returned ${sRes.status}`);
        process.exit(1);
      }
    }
  }
  console.log('\nSUCCESS: All client chunks across all interactive routes loaded with 200 OK!');
}

testChunks().catch((err) => {
  console.error(err);
  process.exit(1);
});
